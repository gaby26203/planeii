import { supabase } from "@/integrations/supabase/client";

const BUCKET = "trip-page-images";

/** Peso objetivo de cada foto de la landing: ~450 KB. */
export const PAGE_IMAGE_TARGET_BYTES = 450_000;
/** Archivo más pesado que aceptamos al elegir una foto (se comprime antes de usarla). */
export const PAGE_IMAGE_MAX_INPUT_BYTES = 25 * 1024 * 1024;
/** Formatos que sabemos procesar. */
export const PAGE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const pageImageSizeLabel = (bytes: number) =>
  `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB`;

function dataUrlToBlob(dataUrl: string) {
  const [head, body] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
  const bytes = atob(body);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

const canEncode = () => typeof document !== "undefined" && typeof createImageBitmap === "function";

function encodeJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality));
}

/**
 * Baja calidad y luego tamaño lo justo hasta que la foto pese menos de `maxBytes`.
 * Si no se puede decodificar (formato raro), devuelve la foto original tal cual.
 */
export async function compressToTarget(
  source: Blob | string,
  { maxBytes = PAGE_IMAGE_TARGET_BYTES, maxSide = 1800 }: { maxBytes?: number; maxSide?: number } = {},
): Promise<Blob> {
  const blob = typeof source === "string" ? dataUrlToBlob(source) : source;
  if (!canEncode()) return blob;
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return blob;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return blob;
  }
  let scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  let best: Blob | null = null;
  for (let round = 0; round < 4; round++) {
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.6, 0.5]) {
      const out = await encodeJpeg(canvas, quality);
      if (!out) continue;
      if (!best || out.size < best.size) best = out;
      if (out.size <= maxBytes) break;
    }
    if (best && best.size <= maxBytes) break;
    scale = Math.max(0.35, scale * 0.8);
  }
  bitmap.close?.();
  return best ?? blob;
}

export async function uploadPageImage(tripId: string, source: Blob | string): Promise<string> {
  const blob = await compressToTarget(source);
  const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
  const path = `${tripId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  return `/api/public/page-image/${path}`;
}

export const hasEmbeddedImages = (doc: unknown) => JSON.stringify(doc).includes("data:image");

/** Sube cada foto embebida (data:image) y la reemplaza por su enlace. */
export async function externalizeDocumentImages<T>(tripId: string, doc: T): Promise<T> {
  if (!/data:image\/(?!svg\+xml)/.test(JSON.stringify(doc))) return doc;
  const cache = new Map<string, string>();
  const walk = async (value: unknown): Promise<unknown> => {
    if (typeof value === "string") {
      if (!value.startsWith("data:image")) return value;
      // Placeholders SVG de la plantilla neutra: livianos y no base64, se dejan tal cual.
      if (value.startsWith("data:image/svg+xml")) return value;
      if (!cache.has(value)) cache.set(value, await uploadPageImage(tripId, value));
      return cache.get(value);
    }
    if (Array.isArray(value)) return Promise.all(value.map(walk));
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) out[k] = await walk(v);
      return out;
    }
    return value;
  };
  return (await walk(doc)) as T;
}

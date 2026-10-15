// Helpers para el bucket privado `trip-covers`.
// - `coverImage` del viaje puede ser una URL externa (http/https) o un path
//   interno prefijado con `storage:` (ej. `storage:{uid}/{tripId}/1234.jpg`).
// - Para archivos internos se generan signed URLs on-demand.

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "trip-covers";
const STORAGE_PREFIX = "storage:";
const SIGNED_URL_TTL = 60 * 60 * 8; // 8 horas

export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function isStoragePath(value: string | null | undefined): value is string {
  return !!value && value.startsWith(STORAGE_PREFIX);
}

export function isExternalUrl(value: string | null | undefined): value is string {
  return !!value && /^https?:\/\//i.test(value);
}

function pathFromStorageRef(ref: string): string {
  return ref.startsWith(STORAGE_PREFIX) ? ref.slice(STORAGE_PREFIX.length) : ref;
}

export async function uploadTripCover(file: File, tripId: string): Promise<string> {
  if (!ACCEPTED_COVER_TYPES.includes(file.type)) {
    throw new Error("Formato no soportado. Usá JPG, PNG o WebP.");
  }
  if (file.size > MAX_COVER_BYTES) {
    throw new Error("La imagen supera los 5 MB.");
  }
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes.user) throw new Error("Sesión no válida.");
  const uid = userRes.user.id;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${uid}/${tripId}/${Date.now()}.${ext || "jpg"}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return `${STORAGE_PREFIX}${path}`;
}

export async function deleteTripCoverRef(ref: string | null | undefined): Promise<void> {
  if (!isStoragePath(ref)) return;
  const path = pathFromStorageRef(ref);
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch (e) {
    console.warn("[trip-cover-storage] no se pudo eliminar el archivo viejo", e);
  }
}

/** Resuelve `coverImage` a una URL usable en `<img src>`. */
export async function resolveCoverUrl(ref: string | null | undefined): Promise<string | null> {
  if (!ref) return null;
  if (isExternalUrl(ref)) return ref;
  if (!isStoragePath(ref)) return null;
  const path = pathFromStorageRef(ref);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data) return null;
  return data.signedUrl;
}

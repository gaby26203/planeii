// Helpers para adjuntos de viajeras en el bucket privado `trip-notes-docs`.
// Path: `${tripId}/viajeras/${enrolleeId}/${timestamp}-${nombre}`
// Las políticas de storage validan que el primer segmento (tripId) sea de un
// viaje del que el usuario es miembro u owner.

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "trip-notes-docs";
const SIGNED_URL_TTL = 60 * 60; // 1 hora

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB
export const ACCEPTED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

function sanitizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-80);
}

export async function uploadEnrolleeFile(
  file: File,
  tripId: string,
  enrolleeId: string,
): Promise<{ storagePath: string; fileName: string; mimeType: string; sizeBytes: number }> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error("El archivo supera los 15 MB.");
  }
  if (file.type && !ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
    throw new Error("Formato no soportado. Usá JPG, PNG, WebP o PDF.");
  }
  const path = `${tripId}/viajeras/${enrolleeId}/${Date.now()}-${sanitizeName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return {
    storagePath: path,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

export async function getEnrolleeFileUrl(
  storagePath: string,
  opts?: { download?: string },
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL, { download: opts?.download });
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteEnrolleeFile(storagePath: string): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  } catch (e) {
    console.warn("[enrollee-files] no se pudo eliminar el archivo", e);
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

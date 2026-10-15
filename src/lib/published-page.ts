import { normalizeEditorDocument, type EditorDocument } from "@/lib/trip-editor";
import { NEUTRAL_TRIP_DATA } from "@/data/neutral-trip";
import { resolveTemplateAssets } from "@/lib/trip-assets";

// Carga isomórfica (SSR + navegador) de una landing publicada, con la clave pública.
export async function fetchPublishedPage(slug: string) {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const res = await fetch(`${base}/rest/v1/trip_pages?slug=eq.${encodeURIComponent(slug)}&select=document,trip_id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`No se pudo cargar la página (${res.status})`);
  const rows = (await res.json()) as Array<{ document: unknown; trip_id: string }>;
  const row = rows[0];
  if (!row) return null;
  return {
    tripId: row.trip_id,
    document: resolveTemplateAssets(normalizeEditorDocument(row.document as EditorDocument, NEUTRAL_TRIP_DATA)),
  };
}

/** Destino real del botón Reservar en la página publicada. Conserva UTMs. */
export function bookingHrefFor(document: EditorDocument, slug: string, search = "") {
  const form = document.bookingForm;
  if (form?.mode === "internal") return `/v/${slug}/reservar${search}`;
  return form?.externalUrl?.trim() || document.trip.bookingUrl;
}

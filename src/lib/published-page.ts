import { normalizeEditorDocument, type EditorDocument } from "@/lib/trip-editor";
import { NEUTRAL_TRIP_DATA } from "@/data/neutral-trip";
import { resolveTemplateAssets } from "@/lib/trip-assets";

// Carga isomórfica (SSR + navegador) de una landing publicada, con la clave pública.
// `trip_pages` no se puede leer ni listar sin sesión: se pide una sola página por su slug exacto.
export async function fetchPublishedPage(slug: string) {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const headers: Record<string, string> = { apikey: key, Accept: "application/json" };
  // Las claves nuevas (sb_publishable_…) no son JWT y no van en Authorization.
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(
    `${base}/rest/v1/rpc/get_published_page?_slug=${encodeURIComponent(slug)}`,
    {
      headers,
    },
  );
  if (!res.ok) throw new Error(`No se pudo cargar la página (${res.status})`);
  const rows = (await res.json()) as Array<{ document: unknown; trip_id: string }>;
  const row = rows[0];
  if (!row) return null;
  return {
    tripId: row.trip_id,
    document: resolveTemplateAssets(
      normalizeEditorDocument(row.document as EditorDocument, NEUTRAL_TRIP_DATA),
    ),
  };
}

/** Destino real del botón Reservar en la página publicada. Conserva UTMs. */
export function bookingHrefFor(document: EditorDocument, slug: string, search = "") {
  const form = document.bookingForm;
  if (form?.mode === "internal") return `/v/${slug}/reservar${search}`;
  return form?.externalUrl?.trim() || document.trip.bookingUrl;
}

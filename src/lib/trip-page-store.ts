// Almacén del borrador y del historial de versiones de la página de venta.
// Usa el cliente de navegador: RLS en trip_page_drafts / trip_page_versions
// limita el acceso al equipo del viaje (dueña o miembros), igual que trip_pages.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { EditorDocument } from "@/lib/trip-editor";

export const PAGE_VERSIONS_KEPT = 20;

export type PageVersion = {
  id: string;
  publishedAt: string;
  publishedBy: string | null;
  document: EditorDocument;
};

export async function createPagePreviewSnapshot(tripId: string, document: EditorDocument): Promise<string> {
  const id = window.crypto.randomUUID();
  const { error } = await supabase
    .from("trip_page_preview_snapshots")
    .insert({ id, trip_id: tripId, document: document as unknown as Json });
  if (error) throw error;
  return id;
}

export async function loadPagePreviewSnapshot(tripId: string, snapshotId: string): Promise<EditorDocument | null> {
  const { data, error } = await supabase
    .from("trip_page_preview_snapshots")
    .select("document")
    .eq("id", snapshotId)
    .eq("trip_id", tripId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return (data?.document as unknown as EditorDocument) ?? null;
}

export async function loadPageDraft(tripId: string): Promise<EditorDocument | null> {
  const { data } = await supabase
    .from("trip_page_drafts")
    .select("document")
    .eq("trip_id", tripId)
    .maybeSingle();
  return (data?.document as unknown as EditorDocument) ?? null;
}

export async function savePageDraft(tripId: string, document: EditorDocument): Promise<void> {
  const payload = { trip_id: tripId, document: document as unknown as Json };
  const { error } = await supabase
    .from("trip_page_drafts")
    .upsert(payload, { onConflict: "trip_id" });
  if (error) throw error;
}

export async function clearPageDraft(tripId: string): Promise<void> {
  const { error } = await supabase.from("trip_page_drafts").delete().eq("trip_id", tripId);
  if (error) throw error;
}

export async function listPageVersions(tripId: string): Promise<PageVersion[]> {
  const { data } = await supabase
    .from("trip_page_versions")
    .select("id, published_at, published_by, document")
    .eq("trip_id", tripId)
    .order("published_at", { ascending: false })
    .limit(PAGE_VERSIONS_KEPT);
  return (data ?? []).map((row) => ({
    id: row.id,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    document: row.document as unknown as EditorDocument,
  }));
}

/** Registra una versión publicada y recorta el historial a las últimas N. */
export async function recordPageVersion(tripId: string, document: EditorDocument, publishedBy: string): Promise<void> {
  const { error } = await supabase
    .from("trip_page_versions")
    .insert({ trip_id: tripId, document: document as unknown as Json, published_by: publishedBy });
  if (error) throw error;
  const { data: old } = await supabase
    .from("trip_page_versions")
    .select("id")
    .eq("trip_id", tripId)
    .order("published_at", { ascending: false })
    .range(PAGE_VERSIONS_KEPT, 9999);
  const ids = (old ?? []).map((row) => row.id);
  if (ids.length > 0) await supabase.from("trip_page_versions").delete().in("id", ids);
}

// Server functions para la sección Notas de cada viaje.
// Persistencia en tablas `trip_todos`, `trip_notes`, `trip_documents`.
// RLS filtra por membresía; los handlers sólo agregan validación de forma.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const uuid = z.string().uuid();
const status = z.enum(["pendiente", "completado"]);
const kind = z.enum(["link", "file"]);

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

// ─── Types de salida ─────────────────────────────────────────────
export interface TripTodo {
  id: string;
  trip_id: string;
  created_by: string;
  title: string;
  short_description: string | null;
  status: "pendiente" | "completado";
  content: JsonValue;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author_name: string | null;
  assigned_to?: string | null;
  assignee_name?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  sort_order?: number | null;
}
export interface TripNote extends Omit<TripTodo, never> {}

export interface TripDocument {
  id: string;
  trip_id: string;
  created_by: string;
  kind: "link" | "file";
  title: string;
  short_description: string | null;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author_name: string | null;
}

// ─── Helper: mapear autor (y responsable si existe) ──────────────
async function attachAuthors<T extends { created_by: string }>(
  supabase: any,
  rows: T[],
): Promise<(T & { author_name: string | null; assignee_name?: string | null })[]> {
  if (rows.length === 0) return [];
  const ids = [
    ...new Set(
      rows
        .flatMap((r) => [r.created_by, (r as any).assigned_to as string | null])
        .filter(Boolean) as string[],
    ),
  ];
  if (ids.length === 0)
    return rows.map((r) => ({ ...r, author_name: null, assignee_name: null }));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", ids);
  const byId = new Map<string, string>();
  (profiles ?? []).forEach((p: any) =>
    byId.set(p.id, p.display_name || p.email || "Usuario"),
  );
  return rows.map((r) => ({
    ...r,
    author_name: byId.get(r.created_by) ?? null,
    assignee_name: (r as any).assigned_to
      ? byId.get((r as any).assigned_to) ?? null
      : null,
  }));
}

// ─── Responsables posibles (owner del viaje + miembros) ──────────
export const listTripAssignees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [tripRes, membersRes] = await Promise.all([
      supabase.from("trips").select("owner_id").eq("id", data.tripId).maybeSingle(),
      supabase.from("trip_members").select("user_id, role").eq("trip_id", data.tripId),
    ]);
    const entries: { userId: string; role: string }[] = [];
    if (tripRes.data?.owner_id) entries.push({ userId: tripRes.data.owner_id, role: "owner" });
    (membersRes.data ?? []).forEach((m: any) => {
      if (!entries.some((e) => e.userId === m.user_id)) {
        entries.push({ userId: m.user_id, role: m.role });
      }
    });
    if (entries.length === 0) return [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", entries.map((e) => e.userId));
    const byId = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => byId.set(p.id, p));
    return entries.map((e) => ({
      userId: e.userId,
      role: e.role,
      name:
        byId.get(e.userId)?.display_name ||
        byId.get(e.userId)?.email ||
        "Usuario",
    }));
  });


// ─── LIST ────────────────────────────────────────────────────────
export const listTripNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [todosRes, notesRes, docsRes] = await Promise.all([
      supabase.from("trip_todos").select("*").eq("trip_id", data.tripId).order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("trip_notes").select("*").eq("trip_id", data.tripId).order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("trip_documents").select("*").eq("trip_id", data.tripId).order("created_at", { ascending: false }),
    ]);
    if (todosRes.error) throw new Error(todosRes.error.message);
    if (notesRes.error) throw new Error(notesRes.error.message);
    if (docsRes.error) throw new Error(docsRes.error.message);
    const [todos, notes, documents] = await Promise.all([
      attachAuthors(supabase, todosRes.data ?? []),
      attachAuthors(supabase, notesRes.data ?? []),
      attachAuthors(supabase, docsRes.data ?? []),
    ]);
    return { todos, notes, documents } as {
      todos: TripTodo[];
      notes: TripNote[];
      documents: TripDocument[];
    };
  });

// ─── TODOS ───────────────────────────────────────────────────────
const todoInput = z.object({
  id: uuid.optional(),
  trip_id: uuid,
  title: z.string().min(1).max(300),
  short_description: z.string().max(500).nullable().optional(),
  status: status.optional(),
  content: z.any().optional(),
  is_pinned: z.boolean().optional(),
  assigned_to: uuid.nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const upsertTodo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => todoInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { data: row, error } = await supabase
        .from("trip_todos")
        .update({
          title: data.title,
          short_description: data.short_description ?? null,
          status: data.status,
          content: data.content,
          is_pinned: data.is_pinned,
          ...(data.assigned_to !== undefined ? { assigned_to: data.assigned_to } : {}),
          ...(data.start_date !== undefined ? { start_date: data.start_date } : {}),
          ...(data.due_date !== undefined ? { due_date: data.due_date } : {}),
        })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("trip_todos")
      .insert({
        trip_id: data.trip_id,
        created_by: userId,
        title: data.title,
        short_description: data.short_description ?? null,
        status: data.status ?? "pendiente",
        content: data.content ?? {},
        is_pinned: data.is_pinned ?? false,
        assigned_to: data.assigned_to ?? null,
        start_date: data.start_date ?? null,
        due_date: data.due_date ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// Reordenar TO-DOs (prioridad manual por drag & drop)
export const reorderTodos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ trip_id: uuid, ids: z.array(uuid).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await supabase
        .from("trip_todos")
        .update({ sort_order: i + 1 })
        .eq("id", data.ids[i]!)
        .eq("trip_id", data.trip_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

// Reordenar Notas (prioridad manual por drag & drop)
export const reorderNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ trip_id: uuid, ids: z.array(uuid).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await supabase
        .from("trip_notes")
        .update({ sort_order: i + 1 })
        .eq("id", data.ids[i]!)
        .eq("trip_id", data.trip_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const deleteTodo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("trip_todos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── NOTES ───────────────────────────────────────────────────────
const noteInput = todoInput;

export const upsertNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => noteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { data: row, error } = await supabase
        .from("trip_notes")
        .update({
          title: data.title,
          short_description: data.short_description ?? null,
          status: data.status,
          content: data.content,
          is_pinned: data.is_pinned,
        })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("trip_notes")
      .insert({
        trip_id: data.trip_id,
        created_by: userId,
        title: data.title,
        short_description: data.short_description ?? null,
        status: data.status ?? "pendiente",
        content: data.content ?? {},
        is_pinned: data.is_pinned ?? false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("trip_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── DOCUMENTS ───────────────────────────────────────────────────
const documentInput = z.object({
  id: uuid.optional(),
  trip_id: uuid,
  kind,
  title: z.string().min(1).max(300),
  short_description: z.string().max(500).nullable().optional(),
  url: z.string().url().nullable().optional(),
  storage_path: z.string().nullable().optional(),
  file_name: z.string().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  size_bytes: z.number().int().nonnegative().nullable().optional(),
  is_pinned: z.boolean().optional(),
});

export const upsertDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => documentInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      kind: data.kind,
      title: data.title,
      short_description: data.short_description ?? null,
      url: data.url ?? null,
      storage_path: data.storage_path ?? null,
      file_name: data.file_name ?? null,
      mime_type: data.mime_type ?? null,
      size_bytes: data.size_bytes ?? null,
      is_pinned: data.is_pinned ?? false,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("trip_documents")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("trip_documents")
      .insert({ trip_id: data.trip_id, created_by: userId, ...payload })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("trip_documents")
      .select("storage_path, kind")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabase.from("trip_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.kind === "file" && row?.storage_path) {
      await supabase.storage.from("trip-notes-docs").remove([row.storage_path]);
    }
    return { ok: true as const };
  });

// ─── PIN toggle genérico ─────────────────────────────────────────
export const togglePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      table: z.enum(["trip_todos", "trip_notes", "trip_documents"]),
      id: uuid,
      is_pinned: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from(data.table)
      .update({ is_pinned: data.is_pinned })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── Get signed download URL ─────────────────────────────────────
export const getSignedDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("trip_documents")
      .select("storage_path, file_name, kind")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (row.kind !== "file" || !row.storage_path) {
      throw new Error("El documento no tiene un archivo asociado.");
    }
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("trip-notes-docs")
      .createSignedUrl(row.storage_path, 3600, {
        download: row.file_name ?? undefined,
      });
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });

// ─── Fetch single item (para páginas individuales) ──────────────
export const getTodo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("trip_todos").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const [withAuthor] = await attachAuthors(context.supabase, [row]);
    return withAuthor as TripTodo;
  });

export const getNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("trip_notes").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const [withAuthor] = await attachAuthors(context.supabase, [row]);
    return withAuthor as TripNote;
  });

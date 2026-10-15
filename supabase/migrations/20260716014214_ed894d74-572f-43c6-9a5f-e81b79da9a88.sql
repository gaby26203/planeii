
-- ─── trip_todos ──────────────────────────────────────
CREATE TABLE public.trip_todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  short_description TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','completado')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trip_todos_trip_id_idx ON public.trip_todos(trip_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_todos TO authenticated;
GRANT ALL ON public.trip_todos TO service_role;

ALTER TABLE public.trip_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_todos_select" ON public.trip_todos FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_todos_insert" ON public.trip_todos FOR INSERT TO authenticated
  WITH CHECK ((public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid())) AND created_by = auth.uid());
CREATE POLICY "trip_todos_update" ON public.trip_todos FOR UPDATE TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid()))
  WITH CHECK (public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_todos_delete" ON public.trip_todos FOR DELETE TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid()));

CREATE TRIGGER update_trip_todos_updated_at BEFORE UPDATE ON public.trip_todos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── trip_notes ──────────────────────────────────────
CREATE TABLE public.trip_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  short_description TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','completado')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trip_notes_trip_id_idx ON public.trip_notes(trip_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_notes TO authenticated;
GRANT ALL ON public.trip_notes TO service_role;

ALTER TABLE public.trip_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_notes_select" ON public.trip_notes FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_notes_insert" ON public.trip_notes FOR INSERT TO authenticated
  WITH CHECK ((public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid())) AND created_by = auth.uid());
CREATE POLICY "trip_notes_update" ON public.trip_notes FOR UPDATE TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid()))
  WITH CHECK (public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_notes_delete" ON public.trip_notes FOR DELETE TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid()));

CREATE TRIGGER update_trip_notes_updated_at BEFORE UPDATE ON public.trip_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── trip_documents ──────────────────────────────────
CREATE TABLE public.trip_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('link','file')),
  title TEXT NOT NULL,
  short_description TEXT,
  url TEXT,
  storage_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trip_documents_trip_id_idx ON public.trip_documents(trip_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_documents TO authenticated;
GRANT ALL ON public.trip_documents TO service_role;

ALTER TABLE public.trip_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_documents_select" ON public.trip_documents FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_documents_insert" ON public.trip_documents FOR INSERT TO authenticated
  WITH CHECK ((public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid())) AND created_by = auth.uid());
CREATE POLICY "trip_documents_update" ON public.trip_documents FOR UPDATE TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid()))
  WITH CHECK (public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_documents_delete" ON public.trip_documents FOR DELETE TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()) OR public.is_trip_owner(trip_id, auth.uid()));

CREATE TRIGGER update_trip_documents_updated_at BEFORE UPDATE ON public.trip_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

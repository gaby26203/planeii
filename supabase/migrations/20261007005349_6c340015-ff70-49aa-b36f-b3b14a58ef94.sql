CREATE TABLE public.trip_page_drafts (
  id uuid not null default gen_random_uuid() primary key,
  trip_id uuid not null unique references public.trips(id) on delete cascade,
  document jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

CREATE TABLE public.trip_page_versions (
  id uuid not null default gen_random_uuid() primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  document jsonb not null,
  published_by uuid not null,
  published_at timestamp with time zone not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_page_drafts TO authenticated;
GRANT SELECT, INSERT ON public.trip_page_versions TO authenticated;
GRANT ALL ON public.trip_page_drafts TO service_role;
GRANT ALL ON public.trip_page_versions TO service_role;

ALTER TABLE public.trip_page_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_page_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_page_drafts_select" ON public.trip_page_drafts FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_page_drafts_insert" ON public.trip_page_drafts FOR INSERT TO authenticated
  WITH CHECK ((private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid())) AND trip_id IN (SELECT id FROM public.trips WHERE owner_id = auth.uid() OR private.is_trip_member(id, auth.uid())));
CREATE POLICY "trip_page_drafts_update" ON public.trip_page_drafts FOR UPDATE TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()))
  WITH CHECK (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_page_drafts_delete" ON public.trip_page_drafts FOR DELETE TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));

CREATE POLICY "trip_page_versions_select" ON public.trip_page_versions FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_page_versions_insert" ON public.trip_page_versions FOR INSERT TO authenticated
  WITH CHECK ((private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid())) AND published_by = auth.uid());

CREATE OR REPLACE FUNCTION public.update_trip_page_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_trip_page_drafts_updated_at
BEFORE UPDATE ON public.trip_page_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_trip_page_drafts_updated_at();
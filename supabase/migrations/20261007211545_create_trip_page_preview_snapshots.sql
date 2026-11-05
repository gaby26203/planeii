CREATE TABLE public.trip_page_preview_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  document jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours')
);

GRANT SELECT, INSERT, DELETE ON public.trip_page_preview_snapshots TO authenticated;
GRANT ALL ON public.trip_page_preview_snapshots TO service_role;

ALTER TABLE public.trip_page_preview_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_page_preview_snapshots_select" ON public.trip_page_preview_snapshots FOR SELECT TO authenticated
  USING ((private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid())) AND expires_at > now());
CREATE POLICY "trip_page_preview_snapshots_insert" ON public.trip_page_preview_snapshots FOR INSERT TO authenticated
  WITH CHECK (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_page_preview_snapshots_delete" ON public.trip_page_preview_snapshots FOR DELETE TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));

CREATE INDEX trip_page_preview_snapshots_trip_created_idx
  ON public.trip_page_preview_snapshots (trip_id, created_at DESC);
CREATE INDEX trip_page_preview_snapshots_expires_idx
  ON public.trip_page_preview_snapshots (expires_at);
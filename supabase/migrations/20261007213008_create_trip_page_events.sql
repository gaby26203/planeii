CREATE TABLE public.trip_page_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  event text NOT NULL,
  target text,
  country text,
  device text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.trip_page_events TO anon;
GRANT SELECT, INSERT ON public.trip_page_events TO authenticated;
GRANT ALL ON public.trip_page_events TO service_role;

ALTER TABLE public.trip_page_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_page_events_insert ON public.trip_page_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (event IN ('view', 'click'));

CREATE POLICY trip_page_events_select ON public.trip_page_events
  FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));

CREATE INDEX trip_page_events_trip_created_idx ON public.trip_page_events (trip_id, created_at DESC);
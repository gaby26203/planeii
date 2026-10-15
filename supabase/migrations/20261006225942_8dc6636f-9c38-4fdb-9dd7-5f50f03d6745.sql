CREATE TABLE public.trip_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  document jsonb NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trip_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_pages TO authenticated;
GRANT ALL ON public.trip_pages TO service_role;
ALTER TABLE public.trip_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published pages are public" ON public.trip_pages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Trip team inserts pages" ON public.trip_pages FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid())));
CREATE POLICY "Trip team updates pages" ON public.trip_pages FOR UPDATE TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()))
  WITH CHECK (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "Trip team deletes pages" ON public.trip_pages FOR DELETE TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE TRIGGER update_trip_pages_updated_at BEFORE UPDATE ON public.trip_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
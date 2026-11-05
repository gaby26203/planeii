CREATE TABLE public.trip_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  page_slug text,
  full_name text NOT NULL,
  whatsapp text NOT NULL,
  email text NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  form_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_accepted boolean NOT NULL DEFAULT false,
  consent_text text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  status text NOT NULL DEFAULT 'nueva',
  enrollee_id text,
  duplicate_of uuid REFERENCES public.trip_applications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trip_applications_trip_idx ON public.trip_applications(trip_id, created_at DESC);
GRANT SELECT, UPDATE ON public.trip_applications TO authenticated;
GRANT ALL ON public.trip_applications TO service_role;
ALTER TABLE public.trip_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY trip_applications_select ON public.trip_applications FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY trip_applications_update ON public.trip_applications FOR UPDATE TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()))
  WITH CHECK (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE TRIGGER update_trip_applications_updated_at BEFORE UPDATE ON public.trip_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.trip_application_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.trip_applications(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.trip_application_notes TO authenticated;
GRANT ALL ON public.trip_application_notes TO service_role;
ALTER TABLE public.trip_application_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY trip_application_notes_select ON public.trip_application_notes FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY trip_application_notes_insert ON public.trip_application_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()))
    AND EXISTS (SELECT 1 FROM public.trip_applications a WHERE a.id = application_id AND a.trip_id = trip_application_notes.trip_id));
CREATE POLICY trip_application_notes_delete ON public.trip_application_notes FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE TABLE public.trip_application_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.trip_applications(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  actor_id uuid DEFAULT auth.uid(),
  actor_name text,
  kind text NOT NULL,
  from_value text,
  to_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.trip_application_events TO authenticated;
GRANT ALL ON public.trip_application_events TO service_role;
ALTER TABLE public.trip_application_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY trip_application_events_select ON public.trip_application_events FOR SELECT TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY trip_application_events_insert ON public.trip_application_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()))
    AND EXISTS (SELECT 1 FROM public.trip_applications a WHERE a.id = application_id AND a.trip_id = trip_application_events.trip_id));

DROP POLICY IF EXISTS trip_page_events_insert ON public.trip_page_events;
CREATE POLICY trip_page_events_insert ON public.trip_page_events FOR INSERT TO anon, authenticated
  WITH CHECK (event = ANY (ARRAY['view','click','form_start','form_submit']));
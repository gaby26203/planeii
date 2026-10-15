CREATE TABLE public.trip_page_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  source text NOT NULL,
  reason text NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trip_page_backups TO authenticated;
GRANT ALL ON public.trip_page_backups TO service_role;
ALTER TABLE public.trip_page_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can read page backups" ON public.trip_page_backups FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.trip_members m WHERE m.trip_id = trip_page_backups.trip_id AND m.user_id = auth.uid()));
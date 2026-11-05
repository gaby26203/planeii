
CREATE TABLE public.access_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NULL,
  actor_id UUID NULL,
  actor_email TEXT NULL,
  target_user_id UUID NULL,
  target_email TEXT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX access_audit_log_trip_idx ON public.access_audit_log (trip_id, created_at DESC);
CREATE INDEX access_audit_log_target_user_idx ON public.access_audit_log (target_user_id, created_at DESC);
CREATE INDEX access_audit_log_target_email_idx ON public.access_audit_log (target_email, created_at DESC);
CREATE INDEX access_audit_log_created_at_idx ON public.access_audit_log (created_at DESC);

GRANT SELECT ON public.access_audit_log TO authenticated;
GRANT ALL ON public.access_audit_log TO service_role;

ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read access audit log"
  ON public.access_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

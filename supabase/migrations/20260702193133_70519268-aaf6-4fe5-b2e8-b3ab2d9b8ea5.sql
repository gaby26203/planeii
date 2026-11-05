
CREATE TABLE public.trip_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.trip_member_role NOT NULL,
  permissions JSONB,
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_invitations_trip ON public.trip_invitations(trip_id);
CREATE INDEX idx_trip_invitations_email ON public.trip_invitations(lower(email));
CREATE INDEX idx_trip_invitations_token ON public.trip_invitations(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_invitations TO authenticated;
GRANT ALL ON public.trip_invitations TO service_role;

ALTER TABLE public.trip_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage all invitations"
  ON public.trip_invitations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Invitees can read own invitations"
  ON public.trip_invitations
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

CREATE TRIGGER update_trip_invitations_updated_at
  BEFORE UPDATE ON public.trip_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.trip_members
  ADD COLUMN IF NOT EXISTS permissions jsonb;
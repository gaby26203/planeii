ALTER TABLE public.trip_applications
  ADD COLUMN contacted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
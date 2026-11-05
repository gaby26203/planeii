
ALTER TABLE public.trips REPLICA IDENTITY FULL;
ALTER TABLE public.trip_members REPLICA IDENTITY FULL;
ALTER TABLE public.trip_notes REPLICA IDENTITY FULL;
ALTER TABLE public.trip_todos REPLICA IDENTITY FULL;
ALTER TABLE public.trip_documents REPLICA IDENTITY FULL;
ALTER TABLE public.trip_invitations REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.trips; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_notes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_todos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_documents; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_invitations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

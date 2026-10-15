CREATE OR REPLACE FUNCTION public.cleanup_expired_trip_page_preview_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.trip_page_preview_snapshots WHERE expires_at <= now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_expired_trip_page_preview_snapshots_before_insert
BEFORE INSERT ON public.trip_page_preview_snapshots
FOR EACH STATEMENT EXECUTE FUNCTION public.cleanup_expired_trip_page_preview_snapshots();
GRANT DELETE ON public.trip_page_versions TO authenticated;

CREATE POLICY "trip_page_versions_delete" ON public.trip_page_versions FOR DELETE TO authenticated
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
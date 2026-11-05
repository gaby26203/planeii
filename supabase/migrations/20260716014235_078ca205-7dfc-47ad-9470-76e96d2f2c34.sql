
CREATE POLICY "trip_notes_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'trip-notes-docs'
    AND (
      public.is_trip_member((split_part(name, '/', 1))::uuid, auth.uid())
      OR public.is_trip_owner((split_part(name, '/', 1))::uuid, auth.uid())
    )
  );

CREATE POLICY "trip_notes_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trip-notes-docs'
    AND (
      public.is_trip_member((split_part(name, '/', 1))::uuid, auth.uid())
      OR public.is_trip_owner((split_part(name, '/', 1))::uuid, auth.uid())
    )
  );

CREATE POLICY "trip_notes_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'trip-notes-docs'
    AND (
      public.is_trip_member((split_part(name, '/', 1))::uuid, auth.uid())
      OR public.is_trip_owner((split_part(name, '/', 1))::uuid, auth.uid())
    )
  );

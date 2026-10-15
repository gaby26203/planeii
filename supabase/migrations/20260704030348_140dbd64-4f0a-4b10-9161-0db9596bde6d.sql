
DROP POLICY IF EXISTS "trip_covers_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "trip_covers_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "trip_covers_delete_owner" ON storage.objects;

CREATE POLICY "trip_covers_insert_own_folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trip-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "trip_covers_update_own_folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trip-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "trip_covers_delete_own_folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'trip-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

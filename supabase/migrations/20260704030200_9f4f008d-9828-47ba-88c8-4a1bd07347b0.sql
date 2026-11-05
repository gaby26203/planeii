
-- Storage policies for trip-covers bucket
-- Path convention: {owner_id}/{trip_id}/{filename}

CREATE POLICY "trip_covers_select_any_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'trip-covers');

CREATE POLICY "trip_covers_insert_owner"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trip-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.is_trip_owner(((storage.foldername(name))[2])::uuid, auth.uid())
);

CREATE POLICY "trip_covers_update_owner"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trip-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.is_trip_owner(((storage.foldername(name))[2])::uuid, auth.uid())
);

CREATE POLICY "trip_covers_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'trip-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.is_trip_owner(((storage.foldername(name))[2])::uuid, auth.uid())
);

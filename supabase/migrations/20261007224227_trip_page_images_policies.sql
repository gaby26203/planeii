CREATE POLICY "Trip team uploads page images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'trip-page-images' AND (private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid()) OR private.is_trip_owner(((storage.foldername(name))[1])::uuid, auth.uid())));
CREATE POLICY "Trip team reads page images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'trip-page-images' AND (private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid()) OR private.is_trip_owner(((storage.foldername(name))[1])::uuid, auth.uid())));
CREATE POLICY "Trip team deletes page images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'trip-page-images' AND (private.is_trip_member(((storage.foldername(name))[1])::uuid, auth.uid()) OR private.is_trip_owner(((storage.foldername(name))[1])::uuid, auth.uid())));
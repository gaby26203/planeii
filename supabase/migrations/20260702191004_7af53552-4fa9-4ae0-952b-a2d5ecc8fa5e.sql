-- Amplía la política de UPDATE sobre trips para permitir que también los
-- tour_leaders puedan escribir. La granularidad real (qué campos puede
-- tocar cada miembro) se aplica del lado del servidor en updateTripData,
-- validando por diff contra los permisos efectivos del miembro.
DROP POLICY IF EXISTS "Update trips as trip owner, global owner, or organizadora" ON public.trips;

CREATE POLICY "Update trips as member (server enforces field scope)"
  ON public.trips FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR has_role(auth.uid(), 'owner'::app_role)
    OR is_trip_member(id, auth.uid())
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR has_role(auth.uid(), 'owner'::app_role)
    OR is_trip_member(id, auth.uid())
  );

-- Restringe INSERT en trips: solo el owner global puede crear viajes.
DROP POLICY IF EXISTS "Authenticated users can create trips" ON public.trips;

CREATE POLICY "Only global owner can create trips"
  ON public.trips FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND has_role(auth.uid(), 'owner'::app_role)
  );
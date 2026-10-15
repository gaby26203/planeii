
-- ─── Fix 1: SECURITY DEFINER helpers should not be callable via the API ───
-- Estas funciones se usan solamente en políticas RLS; revocamos EXECUTE
-- para los roles expuestos por PostgREST. Postgres sigue pudiendo evaluarlas
-- dentro de las políticas porque el motor las llama internamente con los
-- privilegios del owner (son SECURITY DEFINER).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_trip_organizer(uuid, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_trip_owner(uuid, uuid)       FROM PUBLIC, anon, authenticated;

-- ─── Fix 2: profiles email exposure ──────────────────────────────
-- La política anterior permitía a cualquier usuario autenticado leer
-- todos los perfiles (incluido el email). Restringimos a: propio perfil,
-- owner global, o miembros de un viaje en común.

-- Helper: dos usuarios comparten al menos un viaje (por ownership o membresía)
CREATE OR REPLACE FUNCTION public.users_share_trip(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- viajes donde ambos son miembros
    SELECT 1
    FROM public.trip_members ma
    JOIN public.trip_members mb ON mb.trip_id = ma.trip_id
    WHERE ma.user_id = _user_a AND mb.user_id = _user_b
  ) OR EXISTS (
    -- uno es owner del viaje y el otro es miembro
    SELECT 1
    FROM public.trips t
    JOIN public.trip_members m ON m.trip_id = t.id
    WHERE (t.owner_id = _user_a AND m.user_id = _user_b)
       OR (t.owner_id = _user_b AND m.user_id = _user_a)
  );
$$;

-- No exponer el helper vía la Data API
REVOKE EXECUTE ON FUNCTION public.users_share_trip(uuid, uuid) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Global owners can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::public.app_role));

CREATE POLICY "Trip co-members can view each other's profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.users_share_trip(auth.uid(), id));

-- ─── Fix 3: storage.objects trip-covers SELECT ───────────────────
-- La política anterior dejaba leer cualquier archivo del bucket a
-- cualquier autenticado. La reemplazamos: solo el uploader o los
-- miembros del viaje (folder[2] = tripId) pueden leer el archivo.
DROP POLICY IF EXISTS "trip_covers_select_any_authenticated" ON storage.objects;

CREATE POLICY "trip_covers_select_uploader_or_trip_member"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'trip-covers'
    AND (
      -- 1) el uploader (dueño de la carpeta raíz {uid}/...)
      (storage.foldername(name))[1] = (auth.uid())::text
      -- 2) miembros / owner / global owner del trip {uid}/{tripId}/...
      OR (
        (storage.foldername(name))[2] IS NOT NULL
        AND (
          public.is_trip_member(((storage.foldername(name))[2])::uuid, auth.uid())
          OR public.is_trip_owner(((storage.foldername(name))[2])::uuid, auth.uid())
          OR public.has_role(auth.uid(), 'owner'::public.app_role)
        )
      )
    )
  );

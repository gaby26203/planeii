
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_trip_owner(_trip_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ select exists (select 1 from public.trips where id = _trip_id and owner_id = _user_id) $$;

CREATE OR REPLACE FUNCTION private.is_trip_organizer(_trip_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ select exists (select 1 from public.trip_members where trip_id = _trip_id and user_id = _user_id and role = 'organizadora') $$;

CREATE OR REPLACE FUNCTION private.is_trip_member(_trip_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ select exists (select 1 from public.trip_members where trip_id = _trip_id and user_id = _user_id) $$;

CREATE OR REPLACE FUNCTION private.users_share_trip(_user_a uuid, _user_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members ma
    JOIN public.trip_members mb ON mb.trip_id = ma.trip_id
    WHERE ma.user_id = _user_a AND mb.user_id = _user_b
  ) OR EXISTS (
    SELECT 1 FROM public.trips t
    JOIN public.trip_members m ON m.trip_id = t.id
    WHERE (t.owner_id = _user_a AND m.user_id = _user_b)
       OR (t.owner_id = _user_b AND m.user_id = _user_a)
  );
$$;

GRANT EXECUTE ON FUNCTION private.is_trip_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_trip_organizer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_trip_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.users_share_trip(uuid, uuid) TO authenticated;

-- profiles
DROP POLICY IF EXISTS "Trip co-members can view each other's profiles" ON public.profiles;
CREATE POLICY "Trip co-members can view each other's profiles" ON public.profiles
  FOR SELECT USING (private.users_share_trip(auth.uid(), id));

-- trip_documents
DROP POLICY IF EXISTS "trip_documents_delete" ON public.trip_documents;
DROP POLICY IF EXISTS "trip_documents_insert" ON public.trip_documents;
DROP POLICY IF EXISTS "trip_documents_select" ON public.trip_documents;
DROP POLICY IF EXISTS "trip_documents_update" ON public.trip_documents;
CREATE POLICY "trip_documents_select" ON public.trip_documents FOR SELECT
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_documents_insert" ON public.trip_documents FOR INSERT
  WITH CHECK ((private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid())) AND created_by = auth.uid());
CREATE POLICY "trip_documents_update" ON public.trip_documents FOR UPDATE
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()))
  WITH CHECK (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_documents_delete" ON public.trip_documents FOR DELETE
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));

-- trip_notes
DROP POLICY IF EXISTS "trip_notes_delete" ON public.trip_notes;
DROP POLICY IF EXISTS "trip_notes_insert" ON public.trip_notes;
DROP POLICY IF EXISTS "trip_notes_select" ON public.trip_notes;
DROP POLICY IF EXISTS "trip_notes_update" ON public.trip_notes;
CREATE POLICY "trip_notes_select" ON public.trip_notes FOR SELECT
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_notes_insert" ON public.trip_notes FOR INSERT
  WITH CHECK ((private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid())) AND created_by = auth.uid());
CREATE POLICY "trip_notes_update" ON public.trip_notes FOR UPDATE
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()))
  WITH CHECK (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_notes_delete" ON public.trip_notes FOR DELETE
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));

-- trip_todos
DROP POLICY IF EXISTS "trip_todos_delete" ON public.trip_todos;
DROP POLICY IF EXISTS "trip_todos_insert" ON public.trip_todos;
DROP POLICY IF EXISTS "trip_todos_select" ON public.trip_todos;
DROP POLICY IF EXISTS "trip_todos_update" ON public.trip_todos;
CREATE POLICY "trip_todos_select" ON public.trip_todos FOR SELECT
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_todos_insert" ON public.trip_todos FOR INSERT
  WITH CHECK ((private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid())) AND created_by = auth.uid());
CREATE POLICY "trip_todos_update" ON public.trip_todos FOR UPDATE
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()))
  WITH CHECK (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));
CREATE POLICY "trip_todos_delete" ON public.trip_todos FOR DELETE
  USING (private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid()));

-- trip_members
DROP POLICY IF EXISTS "Manage members as trip owner, global owner, or organizadora" ON public.trip_members;
DROP POLICY IF EXISTS "Remove members as trip owner, global owner, or organizadora" ON public.trip_members;
DROP POLICY IF EXISTS "Update members as trip owner, global owner, or organizadora" ON public.trip_members;
DROP POLICY IF EXISTS "View members of trips you belong to" ON public.trip_members;
CREATE POLICY "View members of trips you belong to" ON public.trip_members FOR SELECT
  USING (private.is_trip_owner(trip_id, auth.uid()) OR public.has_role(auth.uid(), 'owner'::app_role) OR private.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Manage members as trip owner, global owner, or organizadora" ON public.trip_members FOR INSERT
  WITH CHECK (private.is_trip_owner(trip_id, auth.uid()) OR public.has_role(auth.uid(), 'owner'::app_role) OR private.is_trip_organizer(trip_id, auth.uid()));
CREATE POLICY "Update members as trip owner, global owner, or organizadora" ON public.trip_members FOR UPDATE
  USING (private.is_trip_owner(trip_id, auth.uid()) OR public.has_role(auth.uid(), 'owner'::app_role) OR private.is_trip_organizer(trip_id, auth.uid()))
  WITH CHECK (private.is_trip_owner(trip_id, auth.uid()) OR public.has_role(auth.uid(), 'owner'::app_role) OR private.is_trip_organizer(trip_id, auth.uid()));
CREATE POLICY "Remove members as trip owner, global owner, or organizadora" ON public.trip_members FOR DELETE
  USING (private.is_trip_owner(trip_id, auth.uid()) OR public.has_role(auth.uid(), 'owner'::app_role) OR private.is_trip_organizer(trip_id, auth.uid()));

-- trips
DROP POLICY IF EXISTS "Update trips as member (server enforces field scope)" ON public.trips;
DROP POLICY IF EXISTS "View trips as owner, global owner, or member" ON public.trips;
CREATE POLICY "View trips as owner, global owner, or member" ON public.trips FOR SELECT
  USING ((owner_id = auth.uid()) OR public.has_role(auth.uid(), 'owner'::app_role) OR private.is_trip_member(id, auth.uid()));
CREATE POLICY "Update trips as member (server enforces field scope)" ON public.trips FOR UPDATE
  USING ((owner_id = auth.uid()) OR public.has_role(auth.uid(), 'owner'::app_role) OR private.is_trip_member(id, auth.uid()))
  WITH CHECK ((owner_id = auth.uid()) OR public.has_role(auth.uid(), 'owner'::app_role) OR private.is_trip_member(id, auth.uid()));

-- storage.objects policies
DROP POLICY IF EXISTS "trip_covers_select_uploader_or_trip_member" ON storage.objects;
CREATE POLICY "trip_covers_select_uploader_or_trip_member" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'trip-covers'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR (
        (storage.foldername(name))[2] IS NOT NULL
        AND (
          private.is_trip_member(((storage.foldername(name))[2])::uuid, auth.uid())
          OR private.is_trip_owner(((storage.foldername(name))[2])::uuid, auth.uid())
          OR public.has_role(auth.uid(), 'owner'::app_role)
        )
      )
    )
  );

DROP POLICY IF EXISTS "trip_notes_docs_select" ON storage.objects;
CREATE POLICY "trip_notes_docs_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'trip-notes-docs'
    AND (
      private.is_trip_member((split_part(name, '/', 1))::uuid, auth.uid())
      OR private.is_trip_owner((split_part(name, '/', 1))::uuid, auth.uid())
    )
  );

DROP POLICY IF EXISTS "trip_notes_docs_insert" ON storage.objects;
CREATE POLICY "trip_notes_docs_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'trip-notes-docs'
    AND (
      private.is_trip_member((split_part(name, '/', 1))::uuid, auth.uid())
      OR private.is_trip_owner((split_part(name, '/', 1))::uuid, auth.uid())
    )
  );

DROP POLICY IF EXISTS "trip_notes_docs_delete" ON storage.objects;
CREATE POLICY "trip_notes_docs_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'trip-notes-docs'
    AND (
      private.is_trip_member((split_part(name, '/', 1))::uuid, auth.uid())
      OR private.is_trip_owner((split_part(name, '/', 1))::uuid, auth.uid())
    )
  );

-- Drop old public helper functions
DROP FUNCTION IF EXISTS public.is_trip_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_trip_organizer(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_trip_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.users_share_trip(uuid, uuid);

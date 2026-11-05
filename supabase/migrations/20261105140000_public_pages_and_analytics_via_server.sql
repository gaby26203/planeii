-- Superficie pública: analítica solo desde el servidor y landings que no se pueden listar.
--
-- 1. `trip_page_events`: anon y authenticated podían insertar eventos de cualquier `trip_id`
--    directamente por PostgREST, saltando el filtro del equipo y cualquier límite de
--    `/api/public/track`. Ahora solo escribe esa ruta, con service role.
-- 2. `trip_pages`: la lectura estaba abierta a todos (`using (true)`), así que se podía listar
--    cada landing con su `owner_id` y `trip_id`. Ahora el público pide una página por su slug
--    exacto con `get_published_page`, y la tabla solo la lee el equipo del viaje o un owner.
--    El editor comprueba si un slug está libre con `is_trip_page_slug_available`, porque ya no
--    ve las páginas de otros viajes.

-- ── Analítica ────────────────────────────────────────────────────────────────
drop policy if exists "trip_page_events_insert" on public.trip_page_events;
revoke insert, update, delete on public.trip_page_events from anon, authenticated;

-- ── Landings ─────────────────────────────────────────────────────────────────
create or replace function public.get_published_page(_slug text)
returns table (trip_id uuid, document jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select p.trip_id, p.document from public.trip_pages p where p.slug = _slug limit 1
$$;

revoke all on function public.get_published_page(text) from public;
grant execute on function public.get_published_page(text) to anon, authenticated, service_role;

create or replace function public.is_trip_page_slug_available(_slug text, _trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.trip_pages p where p.slug = _slug and p.trip_id <> _trip_id
  )
$$;

revoke all on function public.is_trip_page_slug_available(text, uuid) from public;
grant execute on function public.is_trip_page_slug_available(text, uuid) to authenticated, service_role;

drop policy if exists "Published pages are public" on public.trip_pages;
create policy "Trip team or owner reads pages" on public.trip_pages
  for select to authenticated
  using (
    private.is_trip_member(trip_id, auth.uid())
    or private.is_trip_owner(trip_id, auth.uid())
    or public.has_role(auth.uid(), 'owner')
  );

revoke select on public.trip_pages from anon;

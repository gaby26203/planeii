-- El JSON del viaje (`trips.data`) solo se lee desde el servidor.
--
-- `listMyTrips` mandaba el JSON completo, con costos y montos, a cualquier miembro, aunque no
-- tuviera "Ver finanzas"; y aunque se filtrara ahí, el miembro podía pedir `data` directo por
-- PostgREST o recibirlo en cada evento de Realtime (`trips` tiene REPLICA IDENTITY FULL).
--
-- 1. authenticated conserva SELECT de todas las columnas de `trips` menos `data`. Las server
--    functions leen `data` con service role y quitan los montos a quien no tiene el permiso.
-- 2. `trips` sale de la publicación de Realtime. En su lugar, un trigger marca en
--    `trip_change_signals` qué viaje cambió, sin contenido, y el cliente escucha esa tabla
--    para volver a pedir sus viajes.

-- ── 1. Lectura de columnas ───────────────────────────────────────────────────
revoke select on public.trips from anon, authenticated;
grant select (id, owner_id, name, destination, start_date, end_date, status, created_at, updated_at)
  on public.trips to authenticated;

-- ── 2. Señales de cambio para Realtime ───────────────────────────────────────
create table if not exists public.trip_change_signals (
  trip_id uuid primary key,
  changed_at timestamptz not null default now()
);

alter table public.trip_change_signals enable row level security;

drop policy if exists "Trip team sees change signals" on public.trip_change_signals;
create policy "Trip team sees change signals" on public.trip_change_signals
  for select to authenticated
  using (
    private.is_trip_member(trip_id, auth.uid())
    or private.is_trip_owner(trip_id, auth.uid())
    or public.has_role(auth.uid(), 'owner')
  );

revoke all on public.trip_change_signals from anon, authenticated;
grant select on public.trip_change_signals to authenticated;
grant all on public.trip_change_signals to service_role;

create or replace function private.signal_trip_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trip_change_signals (trip_id, changed_at)
  values (coalesce(new.id, old.id), now())
  on conflict (trip_id) do update set changed_at = excluded.changed_at;
  return null;
end;
$$;

drop trigger if exists trips_signal_change on public.trips;
create trigger trips_signal_change
  after insert or update or delete on public.trips
  for each row execute function private.signal_trip_change();

do $$
begin
  begin
    alter publication supabase_realtime add table public.trip_change_signals;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime drop table public.trips;
  exception when undefined_object then null;
  end;
end $$;

-- Puesta en marcha fuera de Lovable.
--
-- En Lovable Cloud estos objetos se crearon con herramientas de la plataforma y no
-- quedaron en ningún archivo de migración. Sin ellos, un proyecto Supabase nuevo no
-- funciona igual que el original. Todo es idempotente.

-- 1) Buckets de Storage. Los tres son privados: las portadas usan URLs firmadas,
--    los documentos se descargan con sesión y las fotos de landing se sirven por
--    /api/public/page-image/* con service role. Límites alineados con el código:
--    portadas 5 MB (src/lib/trip-cover-storage.ts), documentos 25 MB y adjuntos
--    15 MB (mismo bucket), fotos de landing 5 MB tras compresión en el navegador.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('trip-covers', 'trip-covers', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('trip-notes-docs', 'trip-notes-docs', false, 26214400, null),
  ('trip-page-images', 'trip-page-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- 2) La política de borrado de solicitudes existe desde
--    20261009001215_allow_trip_team_delete_applications, pero la tabla solo tenía
--    GRANT SELECT, UPDATE para authenticated. Sin este GRANT el borrado falla.
grant delete on public.trip_applications to authenticated;

-- 3) El layout autenticado se suscribe a cambios de user_roles por Realtime
--    (src/routes/_authenticated/route.tsx), pero la tabla no estaba publicada.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_roles'
  ) then
    alter publication supabase_realtime add table public.user_roles;
  end if;
end $$;

-- Los viajes solo se actualizan desde el servidor.
--
-- Antes, cualquier miembro de un viaje podía actualizar la fila completa con la clave pública y
-- su sesión: cambiar `data` sin pasar por los permisos de `updateTripData`, o poner su propio
-- `owner_id` y quedar habilitado para borrarlo. Ahora `updateTripData` valida los permisos y
-- escribe con la clave de servicio, y la base no acepta UPDATE de anon ni de authenticated.
--
-- Crear (solo owner global) y borrar (owner del viaje u owner global) siguen igual.

drop policy if exists "Update trips as member (server enforces field scope)" on public.trips;

revoke update on public.trips from anon, authenticated;

-- Los miembros de un viaje solo se agregan, editan o quitan desde el servidor.
--
-- Las server functions exigen owner global y registran cada cambio en `access_audit_log`, pero
-- la RLS dejaba a las organizadoras (y a la dueña del viaje) insertar, editar permisos y borrar
-- miembros directamente con la clave pública, sin pasar por esa validación ni por la bitácora.
-- Ahora las escrituras van con service role desde `trip-members.functions.ts`,
-- `trip-invitations.functions.ts` y `createTrip`. La lectura sigue igual.

drop policy if exists "Manage members as trip owner, global owner, or organizadora" on public.trip_members;
drop policy if exists "Update members as trip owner, global owner, or organizadora" on public.trip_members;
drop policy if exists "Remove members as trip owner, global owner, or organizadora" on public.trip_members;

revoke insert, update, delete on public.trip_members from anon, authenticated;

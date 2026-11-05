-- El canal de avisos en vivo `trip-activity:<tripId>` pasa a ser privado del equipo del viaje.
--
-- Era un canal Broadcast público: quien conociera el id de un viaje podía escuchar quién guardaba
-- qué, o mandar avisos falsos ("Ana actualizó Viajeras") a quienes lo tenían abierto. Ahora el
-- cliente se une con `private: true` y Realtime solo deja escuchar o enviar a quien pase estas
-- políticas: miembros del viaje, la dueña o un owner.
--
-- Requiere Realtime Authorization, disponible en todo proyecto Supabase actual.

create or replace function private.can_use_trip_activity_topic(_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  trip uuid;
begin
  if _topic is null or _topic not like 'trip-activity:%' then
    return false;
  end if;
  begin
    trip := substr(_topic, length('trip-activity:') + 1)::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return private.is_trip_member(trip, auth.uid())
    or private.is_trip_owner(trip, auth.uid())
    or public.has_role(auth.uid(), 'owner');
end;
$$;

revoke all on function private.can_use_trip_activity_topic(text) from public;
grant execute on function private.can_use_trip_activity_topic(text) to authenticated;

drop policy if exists "Trip team receives trip activity" on realtime.messages;
create policy "Trip team receives trip activity" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and private.can_use_trip_activity_topic((select realtime.topic()))
  );

drop policy if exists "Trip team sends trip activity" on realtime.messages;
create policy "Trip team sends trip activity" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and private.can_use_trip_activity_topic((select realtime.topic()))
  );

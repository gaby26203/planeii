-- Concede el rol global `owner` a una cuenta existente.
-- Ninguna migración lo crea y la app solo permite concederlo a quien ya es owner,
-- así que el primero se inserta a mano (SQL editor de Supabase o psql).
-- Reemplazá el email antes de ejecutarlo. La cuenta debe haberse registrado antes.
insert into public.user_roles (user_id, role)
select id, 'owner'::public.app_role
from auth.users
where lower(email) = lower('tu-email@ejemplo.com')
on conflict (user_id, role) do nothing;

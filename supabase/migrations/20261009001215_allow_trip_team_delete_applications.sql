-- Permitir que la dueña y organizadoras eliminen solicitudes de su viaje
create policy "trip_applications_delete"
on public.trip_applications
for delete
to authenticated
using (private.is_trip_member(trip_id, auth.uid()) or private.is_trip_owner(trip_id, auth.uid()));

-- Si una solicitud eliminada estaba marcada como duplicado de otra, liberar la referencia
alter table public.trip_applications
drop constraint trip_applications_duplicate_of_fkey,
add constraint trip_applications_duplicate_of_fkey
foreign key (duplicate_of) references public.trip_applications(id) on delete set null;
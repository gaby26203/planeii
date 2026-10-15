
-- ============================================================
-- ENUMS
-- ============================================================
create type public.app_role as enum ('owner');
create type public.trip_member_role as enum ('organizadora', 'tour_leader');

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- USER ROLES (global — for owner)
-- ============================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- Security definer helper to avoid RLS recursion
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "Users can read own roles"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Owners can read all roles"
  on public.user_roles for select
  to authenticated
  using (public.has_role(auth.uid(), 'owner'));

create policy "Owners can manage roles"
  on public.user_roles for all
  to authenticated
  using (public.has_role(auth.uid(), 'owner'))
  with check (public.has_role(auth.uid(), 'owner'));

-- ============================================================
-- TRIPS
-- ============================================================
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  status text not null default 'planificando',
  destination text,
  start_date date,
  end_date date,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trips_owner_id_idx on public.trips(owner_id);
create index trips_status_idx on public.trips(status);

grant select, insert, update, delete on public.trips to authenticated;
grant all on public.trips to service_role;

-- ============================================================
-- TRIP MEMBERS
-- ============================================================
create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.trip_member_role not null,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create index trip_members_trip_id_idx on public.trip_members(trip_id);
create index trip_members_user_id_idx on public.trip_members(user_id);

grant select, insert, update, delete on public.trip_members to authenticated;
grant all on public.trip_members to service_role;

-- ============================================================
-- MEMBERSHIP HELPERS (security definer to avoid recursion)
-- ============================================================
create or replace function public.is_trip_member(_trip_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = _trip_id and user_id = _user_id
  )
$$;

create or replace function public.is_trip_organizer(_trip_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = _trip_id
      and user_id = _user_id
      and role = 'organizadora'
  )
$$;

create or replace function public.is_trip_owner(_trip_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trips
    where id = _trip_id and owner_id = _user_id
  )
$$;

-- ============================================================
-- RLS POLICIES: TRIPS
-- ============================================================
alter table public.trips enable row level security;

create policy "View trips as owner, global owner, or member"
  on public.trips for select
  to authenticated
  using (
    owner_id = auth.uid()
    or public.has_role(auth.uid(), 'owner')
    or public.is_trip_member(id, auth.uid())
  );

create policy "Authenticated users can create trips"
  on public.trips for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Update trips as trip owner, global owner, or organizadora"
  on public.trips for update
  to authenticated
  using (
    owner_id = auth.uid()
    or public.has_role(auth.uid(), 'owner')
    or public.is_trip_organizer(id, auth.uid())
  )
  with check (
    owner_id = auth.uid()
    or public.has_role(auth.uid(), 'owner')
    or public.is_trip_organizer(id, auth.uid())
  );

create policy "Delete trips as trip owner or global owner"
  on public.trips for delete
  to authenticated
  using (
    owner_id = auth.uid()
    or public.has_role(auth.uid(), 'owner')
  );

-- ============================================================
-- RLS POLICIES: TRIP MEMBERS
-- ============================================================
alter table public.trip_members enable row level security;

create policy "View members of trips you belong to"
  on public.trip_members for select
  to authenticated
  using (
    public.is_trip_owner(trip_id, auth.uid())
    or public.has_role(auth.uid(), 'owner')
    or public.is_trip_member(trip_id, auth.uid())
  );

create policy "Manage members as trip owner, global owner, or organizadora"
  on public.trip_members for insert
  to authenticated
  with check (
    public.is_trip_owner(trip_id, auth.uid())
    or public.has_role(auth.uid(), 'owner')
    or public.is_trip_organizer(trip_id, auth.uid())
  );

create policy "Update members as trip owner, global owner, or organizadora"
  on public.trip_members for update
  to authenticated
  using (
    public.is_trip_owner(trip_id, auth.uid())
    or public.has_role(auth.uid(), 'owner')
    or public.is_trip_organizer(trip_id, auth.uid())
  )
  with check (
    public.is_trip_owner(trip_id, auth.uid())
    or public.has_role(auth.uid(), 'owner')
    or public.is_trip_organizer(trip_id, auth.uid())
  );

create policy "Remove members as trip owner, global owner, or organizadora"
  on public.trip_members for delete
  to authenticated
  using (
    public.is_trip_owner(trip_id, auth.uid())
    or public.has_role(auth.uid(), 'owner')
    or public.is_trip_organizer(trip_id, auth.uid())
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

-- updated_at helper
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

create trigger update_trips_updated_at
  before update on public.trips
  for each row execute function public.update_updated_at_column();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name',
             new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name',
             split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any user that already exists
insert into public.profiles (id, email, display_name)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'display_name',
           u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'name',
           split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

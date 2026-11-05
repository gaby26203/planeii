GRANT EXECUTE ON FUNCTION
  public.has_role(uuid, public.app_role),
  public.is_trip_owner(uuid, uuid),
  public.is_trip_member(uuid, uuid),
  public.is_trip_organizer(uuid, uuid),
  public.users_share_trip(uuid, uuid)
TO authenticated;
export type TripAnalyticsActor = {
  userId: string;
  ownerId: string | null;
  memberships: { userId: string; role: string }[];
};

/** Only the trip owner and its organizadoras are internal analytics actors. */
export function isInternalTripAnalyticsActor(actor: TripAnalyticsActor): boolean {
  if (actor.ownerId === actor.userId) return true;
  return actor.memberships.some(
    (membership) => membership.userId === actor.userId && membership.role === "organizadora",
  );
}
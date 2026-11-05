import { describe, expect, test } from "vitest";
import { isInternalTripAnalyticsActor } from "../src/lib/trip-analytics-access";

describe("exclusión del equipo en métricas", () => {
  test("la dueña del viaje no se cuenta", () => {
    expect(
      isInternalTripAnalyticsActor({ userId: "owner", ownerId: "owner", memberships: [] }),
    ).toBe(true);
  });

  test("una organizadora de ese viaje no se cuenta", () => {
    expect(
      isInternalTripAnalyticsActor({
        userId: "organizer",
        ownerId: "owner",
        memberships: [{ userId: "organizer", role: "organizadora" }],
      }),
    ).toBe(true);
  });

  test("una tour leader sí se cuenta", () => {
    expect(
      isInternalTripAnalyticsActor({
        userId: "leader",
        ownerId: "owner",
        memberships: [{ userId: "leader", role: "tour_leader" }],
      }),
    ).toBe(false);
  });

  test("una cuenta sin acceso a ese viaje sí se cuenta", () => {
    expect(
      isInternalTripAnalyticsActor({ userId: "visitor", ownerId: null, memberships: [] }),
    ).toBe(false);
  });
});
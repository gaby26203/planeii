import { describe, expect, test } from "bun:test";
import type { TripData } from "../src/lib/finance-types";
import { filterVisibleTrips, isShowcaseTrip } from "../src/lib/presentation-mode";

const trip = (id: string, showcase?: boolean) =>
  ({ id, name: id, showcase }) as unknown as TripData;

describe("modo presentación", () => {
  const trips = {
    real: trip("real"),
    vitrina: trip("vitrina", true),
    apagado: trip("apagado", false),
  };

  test("fuera del modo se ven todos los viajes y el objeto no cambia", () => {
    expect(filterVisibleTrips(trips, false)).toBe(trips);
  });

  test("en el modo solo quedan los viajes vitrina", () => {
    expect(Object.keys(filterVisibleTrips(trips, true))).toEqual(["vitrina"]);
  });

  test("filtrar no modifica los viajes", () => {
    const visible = filterVisibleTrips(trips, true);
    expect(visible.vitrina).toBe(trips.vitrina);
    expect(Object.keys(trips)).toEqual(["real", "vitrina", "apagado"]);
  });

  test("solo showcase === true cuenta como vitrina", () => {
    expect(isShowcaseTrip(trips.vitrina)).toBe(true);
    expect(isShowcaseTrip(trips.apagado)).toBe(false);
    expect(isShowcaseTrip(undefined)).toBe(false);
  });
});

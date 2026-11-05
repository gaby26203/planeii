import { describe, expect, test } from "bun:test";
import { NEUTRAL_TRIP_DATA } from "../src/data/neutral-trip";
import { isBrandPhoto } from "../src/lib/brand-photos";
import { calculateTripFinancials } from "../src/lib/finance";
import { normalizeEditorDocument } from "../src/lib/trip-editor";
import { buildDemo } from "../scripts/demo/build";
import { DEMO_TRIPS } from "../scripts/demo/data";
import { removeSql, seedSql } from "../scripts/demo/sql";

const now = new Date("2026-11-05T12:00:00Z");
const demo = buildDemo(now);
const round2 = (n: number) => Math.round(n * 100) / 100;

describe("datos de la demo", () => {
  test("todos los viajes son vitrina y empiezan en el futuro", () => {
    expect(demo.trips.map((t) => t.id)).toEqual(DEMO_TRIPS.map((t) => t.id));
    for (const trip of demo.trips) {
      expect(trip.showcase).toBe(true);
      expect(new Date(`${trip.startDate}T00:00:00Z`).getTime()).toBeGreaterThan(now.getTime());
      expect(isBrandPhoto(trip.coverImage)).toBe(true);
    }
  });

  test("las cuotas de cada viajera suman lo que debe y respetan lo pagado", () => {
    for (const def of DEMO_TRIPS) {
      const trip = demo.trips.find((t) => t.id === def.id)!;
      expect(trip.enrollees).toHaveLength(def.travelers.length);
      trip.enrollees.forEach((enrollee, i) => {
        const plan = def.travelers[i];
        expect(enrollee.installments).toHaveLength(plan.installments);
        expect(round2(enrollee.installments.reduce((s, x) => s + x.amount, 0))).toBe(
          enrollee.totalDue,
        );
        expect(enrollee.installments.filter((x) => x.status === "pagado")).toHaveLength(plan.paid);
      });
    }
  });

  test("los cálculos financieros de la app dan números válidos", () => {
    for (const trip of demo.trips) {
      const fin = calculateTripFinancials(trip, trip.costs);
      for (const value of [
        fin.revenueCollected,
        fin.revenueCommitted,
        fin.totalCostActual,
        fin.profitActual,
      ]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(fin.revenueCollected).toBeGreaterThan(0);
      expect(fin.revenueCollected).toBeLessThanOrEqual(fin.revenueCommitted);
    }
  });

  test("las landings pasan la normalización con formulario interno y fotos de marca", () => {
    for (const page of demo.pages) {
      const doc = normalizeEditorDocument(page.document, NEUTRAL_TRIP_DATA);
      const def = DEMO_TRIPS.find((t) => t.id === page.trip_id)!;
      expect(doc.trip.title).toBe(def.landing.title);
      expect(doc.trip.brand).toBe("Chama Viaja");
      expect(doc.bookingForm?.mode).toBe("internal");
      expect(isBrandPhoto(doc.trip.heroImage.src)).toBe(true);
      expect(doc.hiddenSections).toContain("testimonials");
      expect(doc.trip.itinerary).toHaveLength(def.days);
    }
  });

  test("ninguna persona de la demo tiene datos que puedan ser reales", () => {
    const people = [
      ...demo.trips.flatMap((t) => t.enrollees.map((e) => ({ email: e.email, phone: e.phone }))),
      ...demo.applications.map((a) => ({ email: a.email, phone: a.whatsapp })),
    ];
    expect(people.length).toBeGreaterThan(0);
    for (const p of people) {
      expect(p.email).toEndWith("@example.com");
      expect(p.phone).toStartWith("+58400");
    }
    expect(new Set(people.map((p) => p.email)).size).toBe(people.length);
  });

  test("solicitudes y métricas cuadran por viaje", () => {
    const ids = demo.applications.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const def of DEMO_TRIPS) {
      const submits = demo.events.filter((e) => e.trip_id === def.id && e.event === "form_submit");
      expect(submits).toHaveLength(def.applications.length);
      expect(demo.events.some((e) => e.trip_id === def.id && e.event === "view")).toBe(true);
    }
  });
});

describe("SQL de la demo", () => {
  const sql = seedSql(demo, "Owner@Chama.com", now);

  test("verifica la cuenta owner y reemplaza los viajes de la demo", () => {
    expect(sql).toContain("lower(email) = 'owner@chama.com'");
    expect(sql.indexOf("delete from public.trips")).toBeLessThan(
      sql.indexOf("insert into public.trips"),
    );
    expect(sql.trim().startsWith("--")).toBe(true);
    expect(sql.trim().endsWith("commit;")).toBe(true);
  });

  test("escapa comillas en los textos", () => {
    expect(seedSql(demo, "o'brien@example.com", now)).toContain("'o''brien@example.com'");
  });

  test("el borrado apunta a los mismos viajes", () => {
    for (const def of DEMO_TRIPS) expect(removeSql()).toContain(def.id);
  });
});

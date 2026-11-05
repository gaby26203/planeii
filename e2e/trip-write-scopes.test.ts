import { describe, expect, test } from "bun:test";
import { defaultsForRole } from "../src/lib/trip-permissions";
import { DEFAULT_TAG_SEEDS } from "../src/lib/tags";
import { requiredWriteScopes, writeScopeError } from "../src/lib/trip-write-scopes";

// Un viaje ya completado como lo deja la hidratación del cliente.
function trip(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    name: "Caripe",
    destination: "Monagas",
    startDate: "2026-12-01",
    endDate: "2026-12-05",
    status: "planificando",
    capacity: 12,
    enrolled: 1,
    pricePerPerson: 500,
    currency: "USD",
    baseCurrency: "USD",
    coverGradient: "from-a to-b",
    itinerary: [{ id: "d1", title: "Llegada", activities: [] }],
    costs: [],
    providers: [],
    refundRules: [],
    tags: [],
    tagsInitialized: true,
    enrollees: [
      {
        id: "e1",
        name: "Ana",
        installments: [{ id: "i1", amount: 250, payments: [] }],
        extras: [],
      },
    ],
    ...overrides,
  };
}

const leader = defaultsForRole("tour_leader");
const organizer = defaultsForRole("organizadora");

describe("requiredWriteScopes", () => {
  test("sin cambios no pide nada", () => {
    expect(requiredWriteScopes(trip(), trip())).toEqual({ scopes: [], ownerOnly: [] });
  });

  test("cambiar el estado pide marcar_operativo", () => {
    const r = requiredWriteScopes(trip(), trip({ status: "confirmado" }));
    expect(r.scopes).toEqual(["marcar_operativo"]);
    expect(writeScopeError(r, leader)).toBeNull();
  });

  test("mandar el viaje a la papelera es solo del owner, aunque tenga todos los permisos", () => {
    const r = requiredWriteScopes(
      trip(),
      trip({ isDeleted: true, deletedAt: "2026-11-05T00:00:00Z", purgeAt: "2026-11-05T00:00:00Z" }),
    );
    expect(r.ownerOnly).toEqual(["la papelera"]);
    expect(writeScopeError(r, organizer)).toBe("Solo el owner puede cambiar la papelera.");
  });

  test("la portada, el país, las etiquetas y las monedas ya no pasan sin permiso", () => {
    expect(requiredWriteScopes(trip(), trip({ coverImage: "storage:x.jpg" })).scopes).toEqual([
      "editar_costos",
    ]);
    expect(requiredWriteScopes(trip(), trip({ country: "Venezuela" })).scopes).toEqual([
      "editar_costos",
    ]);
    expect(requiredWriteScopes(trip(), trip({ localCurrency: "EUR" })).scopes).toEqual([
      "editar_costos",
    ]);
    expect(
      requiredWriteScopes(trip(), trip({ tags: [{ id: "x", label: "X", colorKey: "gray" }] }))
        .scopes,
    ).toEqual(["editar_itinerario"]);
  });

  test("un campo que nadie clasificó solo lo cambia el owner", () => {
    const r = requiredWriteScopes(trip(), trip({ showcase: true }));
    expect(r.ownerOnly).toEqual(['el campo "showcase"']);
    expect(writeScopeError(r, organizer)).toContain("Solo el owner");
  });

  test("cambiar el id del blob es solo del owner", () => {
    expect(requiredWriteScopes(trip(), trip({ id: "otro" })).ownerOnly).toEqual([
      "el identificador del viaje",
    ]);
  });

  test("registrar un pago pide registrar_pagos, no gestionar_viajeras", () => {
    const paid = trip({
      enrollees: [
        {
          id: "e1",
          name: "Ana",
          installments: [{ id: "i1", amount: 250, payments: [{ id: "p1", amount: 250 }] }],
          extras: [],
        },
      ],
    });
    expect(requiredWriteScopes(trip(), paid).scopes).toEqual(["registrar_pagos"]);
  });

  test("agregar una viajera pide gestionar_viajeras", () => {
    const base = trip();
    const more = trip({
      enrolled: 2,
      enrollees: [
        ...(base.enrollees as object[]),
        { id: "e2", name: "Bea", installments: [], extras: [] },
      ],
    });
    expect(requiredWriteScopes(base, more).scopes).toEqual(["gestionar_viajeras"]);
    expect(writeScopeError(requiredWriteScopes(base, more), leader)).toBe(
      "No tienes permiso para: Gestionar viajeras. Pídele al owner que te habilite estos accesos.",
    );
  });

  test("la siembra de etiquetas al abrir un viaje viejo no cuenta como cambio", () => {
    const old = trip({ tags: undefined, tagsInitialized: undefined });
    const seeded = trip({
      tags: DEFAULT_TAG_SEEDS.map((s, i) => ({ id: `t${i}`, ...s })),
      tagsInitialized: true,
    });
    expect(requiredWriteScopes(old, seeded)).toEqual({ scopes: [], ownerOnly: [] });
  });

  test("el backfill de monedas de un viaje viejo no cuenta como cambio", () => {
    const legacy = trip({
      baseCurrency: undefined,
      costs: [{ id: "c1", name: "Hotel", amount: 100, currency: "EUR", amountUSD: 109 }],
    });
    // Lo que manda el cliente después de hidratar: campos de conversión completos.
    const hydrated = trip({
      costs: [
        {
          id: "c1",
          name: "Hotel",
          amount: 100,
          currency: "EUR",
          amountUSD: 109,
          originalAmount: 100,
          originalCurrency: "EUR",
          baseCurrency: "USD",
          rateUsed: 1.09,
          convertedAmount: 109,
        },
      ],
    });
    expect(requiredWriteScopes(legacy, hydrated)).toEqual({ scopes: [], ownerOnly: [] });
  });

  test("claves heredadas del prototipo no se confunden con reglas", () => {
    const r = requiredWriteScopes(trip(), trip({ constructor: "x", toString: "y" }));
    expect(r.scopes).toEqual([]);
    expect(r.ownerOnly).toEqual(['el campo "constructor"', 'el campo "toString"']);
  });
});

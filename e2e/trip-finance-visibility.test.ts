import { describe, expect, test } from "bun:test";
import { redactFinance, restoreHiddenFinance } from "../src/lib/trip-finance-visibility";
import { requiredWriteScopes } from "../src/lib/trip-write-scopes";

const stored = {
  id: "t1",
  name: "Caripe",
  status: "planificando",
  currency: "USD",
  baseCurrency: "USD",
  pricePerPerson: 500,
  costs: [
    {
      id: "c1",
      description: "Posada",
      notes: "<p>Pagar 50% antes del viaje</p>",
      category: "hospedaje",
      amount: 1200,
      currency: "USD",
      amountUSD: 1200,
      perPerson: false,
      itineraryDay: 1,
      originalAmount: 1200,
      originalCurrency: "USD",
      baseCurrency: "USD",
      rateUsed: 1,
      convertedAmount: 1200,
    },
  ],
  enrollees: [
    {
      id: "e1",
      name: "Ana",
      installments: [{ id: "i1", amount: 500, payments: [] }],
      extras: [{ id: "x1", name: "Tirolina", price: 40, cost: 25, installments: [] }],
    },
  ],
};

describe("redactFinance", () => {
  test("quita montos y notas de los costos, y el costo de los extras", () => {
    const r = redactFinance(stored);
    expect(r.costs[0]).toMatchObject({
      id: "c1",
      description: "Posada",
      amount: 0,
      amountUSD: 0,
      notes: "",
    });
    expect(r.costs[0]).not.toHaveProperty("originalAmount");
    expect(r.costs[0]).not.toHaveProperty("convertedAmount");
    expect(r.costs[0]).not.toHaveProperty("rateUsed");
    expect(r.enrollees[0].extras[0]).toMatchObject({ price: 40, cost: 0 });
    // Lo que se cobra desde Viajeras sigue visible.
    expect(r.pricePerPerson).toBe(500);
    expect(r.enrollees[0].installments[0].amount).toBe(500);
  });

  test("no inventa listas que el viaje no tenía", () => {
    expect(redactFinance({ id: "t1" })).toEqual({ id: "t1" });
  });

  test("no modifica el original", () => {
    redactFinance(stored);
    expect(stored.costs[0].amount).toBe(1200);
  });
});

describe("restoreHiddenFinance", () => {
  test("lo que vuelve oculto se repone y no cuenta como cambio de costos", () => {
    // Lo que manda el cliente: el viaje oculto, con el backfill de monedas del cliente encima.
    const fromClient = redactFinance(stored);
    fromClient.costs[0] = {
      ...fromClient.costs[0],
      originalAmount: 0,
      originalCurrency: "USD",
      baseCurrency: "USD",
      rateUsed: 1,
      convertedAmount: 0,
    };
    const edited = { ...fromClient, status: "confirmado" };
    const restored = restoreHiddenFinance(stored, edited);
    expect(restored.costs).toEqual(stored.costs);
    expect(restored.enrollees[0].extras[0].cost).toBe(25);
    expect(requiredWriteScopes(stored, restored).scopes).toEqual(["marcar_operativo"]);
  });

  test("un costo o extra nuevo queda como llegó", () => {
    const fromClient = redactFinance(stored);
    const added = {
      ...fromClient,
      costs: [
        ...fromClient.costs,
        { id: "c2", description: "Lancha", amount: 300, amountUSD: 300 },
      ],
    };
    const restored = restoreHiddenFinance(stored, added);
    expect(restored.costs[1]).toMatchObject({ id: "c2", amount: 300 });
    expect(requiredWriteScopes(stored, restored).scopes).toEqual(["editar_costos"]);
  });

  test("borrar un costo sigue pidiendo editar_costos", () => {
    const restored = restoreHiddenFinance(stored, { ...redactFinance(stored), costs: [] });
    expect(restored.costs).toEqual([]);
    expect(requiredWriteScopes(stored, restored).scopes).toEqual(["editar_costos"]);
  });

  test("el costo de un extra se repone por viajera y por extra", () => {
    const other = {
      ...stored,
      enrollees: [...stored.enrollees, { id: "e2", name: "Bea", extras: [{ id: "x1", cost: 0 }] }],
    };
    const restored = restoreHiddenFinance(stored, other);
    expect(restored.enrollees[0].extras[0].cost).toBe(25);
    // Misma id de extra, otra viajera: no se le copia el costo de Ana.
    expect(restored.enrollees[1].extras[0].cost).toBe(0);
  });
});

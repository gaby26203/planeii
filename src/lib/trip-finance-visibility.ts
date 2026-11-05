// Qué parte del viaje no recibe un miembro sin "Ver finanzas", y cómo se repone al guardar.
//
// Sin ese permiso, el servidor manda los costos sin montos ni notas y los extras sin su costo
// (el precio a la viajera sí, porque se cobra desde Viajeras). Al guardar, el cliente devuelve
// esos campos vacíos; `restoreHiddenFinance` los vuelve a tomar del viaje guardado antes de
// comparar permisos, así que ocultar no se confunde con borrar.

type Blob = Record<string, unknown>;

/** Campos de cada costo que se ocultan (los que hacen falta para el cálculo o son derivados). */
const COST_RESTORE_FIELDS = [
  "amount",
  "amountUSD",
  "notes",
  "originalAmount",
  "originalCurrency",
  "baseCurrency",
  "rateUsed",
  "convertedAmount",
] as const;

function asList(value: unknown): Blob[] {
  return Array.isArray(value) ? (value as Blob[]) : [];
}

function redactCost(cost: Blob): Blob {
  const { originalAmount: _o, convertedAmount: _c, rateUsed: _r, ...rest } = cost;
  return { ...rest, amount: 0, amountUSD: 0, notes: "" };
}

function redactEnrollee(enrollee: Blob): Blob {
  if (!Array.isArray(enrollee.extras)) return enrollee;
  return {
    ...enrollee,
    extras: asList(enrollee.extras).map((x) => ({ ...x, cost: 0 })),
  };
}

/** Copia del viaje sin los montos de costos ni el costo de los extras. */
export function redactFinance<T>(trip: T): T {
  if (!trip || typeof trip !== "object") return trip;
  const blob = trip as unknown as Blob;
  return {
    ...blob,
    ...(Array.isArray(blob.costs) ? { costs: asList(blob.costs).map(redactCost) } : {}),
    ...(Array.isArray(blob.enrollees)
      ? { enrollees: asList(blob.enrollees).map(redactEnrollee) }
      : {}),
  } as unknown as T;
}

/**
 * Repone en `incoming` lo que `redactFinance` ocultó, tomándolo de `stored`. Lo que no existía en
 * `stored` (un costo o extra nuevo) queda como llegó.
 */
export function restoreHiddenFinance<T>(stored: unknown, incoming: T): T {
  if (!incoming || typeof incoming !== "object") return incoming;
  const prev = (stored && typeof stored === "object" ? stored : {}) as Blob;
  const next = incoming as unknown as Blob;

  const prevCosts = new Map(asList(prev.costs).map((c) => [c.id, c]));
  const costs = asList(next.costs).map((c) => {
    const old = prevCosts.get(c.id);
    if (!old) return c;
    const merged: Blob = { ...c };
    for (const field of COST_RESTORE_FIELDS) {
      if (Object.hasOwn(old, field)) merged[field] = old[field];
      else delete merged[field];
    }
    return merged;
  });

  const prevExtras = new Map<string, Blob>();
  for (const e of asList(prev.enrollees)) {
    for (const x of asList(e.extras)) prevExtras.set(`${String(e.id)}|${String(x.id)}`, x);
  }
  const enrollees = asList(next.enrollees).map((e) => {
    if (!Array.isArray(e.extras)) return e;
    return {
      ...e,
      extras: asList(e.extras).map((x) => {
        const old = prevExtras.get(`${String(e.id)}|${String(x.id)}`);
        return old && Object.hasOwn(old, "cost") ? { ...x, cost: old.cost } : x;
      }),
    };
  });

  return {
    ...next,
    ...(Array.isArray(next.costs) ? { costs } : {}),
    ...(Array.isArray(next.enrollees) ? { enrollees } : {}),
  } as unknown as T;
}

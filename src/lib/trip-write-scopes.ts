// Qué permisos exige guardar un viaje, comparando el blob guardado con el que llega.
//
// Regla: todo campo de primer nivel tiene un dueño declarado en FIELD_SCOPES. Un campo que no
// aparece ahí (por ejemplo, uno nuevo que todavía nadie clasificó) solo lo puede cambiar el
// owner. Así un campo nuevo nunca queda abierto a miembros sin que alguien lo decida.

import { DEFAULT_TAG_SEEDS } from "./tags";
import { backfillTripCurrencyFields } from "./trip-backfill";
import type { TripData } from "./finance-types";
import { PERM_LABELS, type TripPermKey, type TripPermMap } from "./trip-permissions";

type Blob = Record<string, unknown>;

/** Campo que solo cambia el owner, con el nombre que se muestra en el error. */
const OWNER_ONLY: Record<string, string> = {
  id: "el identificador del viaje",
  isDeleted: "la papelera",
  deletedAt: "la papelera",
  purgeAt: "la papelera",
};

type FieldRule = TripPermKey | "enrollees";

const FIELD_SCOPES: Record<string, FieldRule> = {
  // Datos generales del viaje. Desde antes de esta regla piden editar_costos.
  name: "editar_costos",
  destination: "editar_costos",
  country: "editar_costos",
  isMultiDestination: "editar_costos",
  destinations: "editar_costos",
  startDate: "editar_costos",
  endDate: "editar_costos",
  coverGradient: "editar_costos",
  coverImage: "editar_costos",
  // Costos, precio y monedas.
  costs: "editar_costos",
  refundRules: "editar_costos",
  pricePerPerson: "editar_costos",
  capacity: "editar_costos",
  currency: "editar_costos",
  baseCurrency: "editar_costos",
  localCurrency: "editar_costos",
  exchangeRate: "editar_costos",
  exchangeRateUpdatedAt: "editar_costos",
  // Itinerario y sus etiquetas.
  itinerary: "editar_itinerario",
  tags: "editar_itinerario",
  tagsInitialized: "editar_itinerario",
  // Estado del viaje.
  status: "marcar_operativo",
  providers: "editar_proveedores",
  // Viajeras: se comparan una por una más abajo.
  enrollees: "enrollees",
  enrolled: "gestionar_viajeras",
};

export interface WriteScopes {
  /** Permisos de miembro que hacen falta. */
  scopes: TripPermKey[];
  /** Campos que solo puede cambiar el owner (nombres para mostrar, sin repetir). */
  ownerOnly: string[];
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function asBlob(value: unknown): Blob {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Blob) : {};
}

/**
 * Normaliza igual que la hidratación del cliente. Sin esto, un viaje viejo que el cliente
 * completó al cargarlo (monedas, conversiones) parecería un cambio de costos en cada guardado.
 */
function normalizeForDiff(value: unknown): Blob {
  const blob = asBlob(value);
  if (Object.keys(blob).length === 0) return blob;
  return backfillTripCurrencyFields(blob as unknown as TripData) as unknown as Blob;
}

/** La primera vez que se abre el viaje, el cliente siembra las etiquetas por defecto. */
function isDefaultTagSeed(oldData: Blob, newData: Blob): boolean {
  if (oldData.tagsInitialized === true || oldData.tags !== undefined) return false;
  if (newData.tagsInitialized !== true || !Array.isArray(newData.tags)) return false;
  const tags = newData.tags as Array<{ label?: unknown; colorKey?: unknown }>;
  return (
    tags.length === DEFAULT_TAG_SEEDS.length &&
    tags.every(
      (t, i) =>
        t?.label === DEFAULT_TAG_SEEDS[i].label && t?.colorKey === DEFAULT_TAG_SEEDS[i].colorKey,
    )
  );
}

function enrolleeScopes(oldList: unknown, newList: unknown, scopes: Set<TripPermKey>) {
  const oldE: Blob[] = Array.isArray(oldList) ? oldList : [];
  const newE: Blob[] = Array.isArray(newList) ? newList : [];
  const oldById = new Map(oldE.map((e) => [e?.id, e]));
  const newById = new Map(newE.map((e) => [e?.id, e]));

  const added = [...newById.keys()].some((k) => !oldById.has(k));
  const removed = [...oldById.keys()].some((k) => !newById.has(k));
  if (added || removed) scopes.add("gestionar_viajeras");

  const withoutDynamic = (e: Blob) => {
    const { installments: _i, extras: _x, ...rest } = e ?? {};
    return rest;
  };
  const withoutPayments = (list: unknown) =>
    (Array.isArray(list) ? list : []).map((i: Blob) => ({ ...i, payments: undefined }));
  const extraStructure = (list: unknown) =>
    (Array.isArray(list) ? list : []).map((x: Blob) => ({
      ...x,
      installments: withoutPayments(x?.installments),
    }));
  const installmentPayments = (list: unknown) =>
    (Array.isArray(list) ? list : []).map((i: Blob) => i?.payments ?? []);
  const extraPayments = (list: unknown) =>
    (Array.isArray(list) ? list : []).map((x: Blob) => installmentPayments(x?.installments));

  for (const [id, next] of newById) {
    const prev = oldById.get(id);
    if (!prev) continue;
    if (!same(withoutDynamic(prev), withoutDynamic(next))) scopes.add("gestionar_viajeras");
    // Cambios estructurales en cuotas: crear plan, editar montos, etc.
    if (!same(withoutPayments(prev.installments), withoutPayments(next.installments))) {
      scopes.add("gestionar_viajeras");
    }
    if (!same(installmentPayments(prev.installments), installmentPayments(next.installments))) {
      scopes.add("registrar_pagos");
    }
    if (!same(extraStructure(prev.extras), extraStructure(next.extras)))
      scopes.add("editar_extras");
    if (!same(extraPayments(prev.extras), extraPayments(next.extras)))
      scopes.add("registrar_pagos");
  }
}

/** Permisos que exige pasar de `oldValue` a `newValue`. */
export function requiredWriteScopes(oldValue: unknown, newValue: unknown): WriteScopes {
  const oldData = normalizeForDiff(oldValue);
  const newData = normalizeForDiff(newValue);
  const scopes = new Set<TripPermKey>();
  const ownerOnly = new Set<string>();
  const tagSeed = isDefaultTagSeed(oldData, newData);

  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  for (const key of keys) {
    if (same(oldData[key], newData[key])) continue;
    if (Object.hasOwn(OWNER_ONLY, key)) {
      ownerOnly.add(OWNER_ONLY[key]);
      continue;
    }
    const rule = Object.hasOwn(FIELD_SCOPES, key) ? FIELD_SCOPES[key] : undefined;
    if (!rule) {
      ownerOnly.add(`el campo "${key}"`);
    } else if (rule === "enrollees") {
      enrolleeScopes(oldData.enrollees, newData.enrollees, scopes);
    } else if (!(tagSeed && (key === "tags" || key === "tagsInitialized"))) {
      scopes.add(rule);
    }
  }
  return { scopes: [...scopes], ownerOnly: [...ownerOnly] };
}

/** Error para mostrar a quien guarda, o null si puede guardar. */
export function writeScopeError(required: WriteScopes, perms: TripPermMap | null): string | null {
  if (required.ownerOnly.length > 0) {
    return `Solo el owner puede cambiar ${required.ownerOnly.join(", ")}.`;
  }
  const missing = required.scopes.filter((s) => !perms?.[s]);
  if (missing.length === 0) return null;
  const labels = missing.map((s) => PERM_LABELS[s].title);
  return `No tienes permiso para: ${labels.join(", ")}. Pídele al owner que te habilite estos accesos.`;
}

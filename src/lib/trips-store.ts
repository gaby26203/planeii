// Store global de viajes y costos. Única fuente de verdad para los datos del
// viaje: tanto la pantalla de Costos (viajes/$tripId) como Finanzas leen y
// escriben aquí. Cualquier cambio en costos o pagos se refleja inmediatamente
// en ambas vistas.

import { create } from "zustand";
import {
  createTrip as createTripFn,
  deleteTrip as deleteTripFn,
  listMyTrips,
  updateTripData,
} from "./trips.functions";
import {
  nodesToPlainText,
  seedDefaultTags,
  normalizeTagLabel,
  isDuplicateTagLabel,
  convertTagToText,
  replaceTagId,
} from "./tags";
import type { TripTag } from "./tags";

import type {
  AppliedCredit,
  AuditAction,
  AuditEntry,
  Cancellation,
  CostItem,
  Discount,
  Enrollee,
  Extra,
  ExtraPayment,
  Installment,
  InstallmentPayment,
  InstallmentStatus,
  InstallmentCount,
  Participation,
  Provider,
  ProviderStatus,
  RefundRule,
  TripData,
} from "./finance-types";
import {
  buildCostConversion,
  computeFinalPrice,
  computePaymentNet,
  convertAmount,
  EXCHANGE_RATES,
  formatUSD,
  generateId,
  getTripBaseCurrency,
  methodSupportsFee,
  PAYMENT_METHOD_LABELS,
  suggestLocalCurrency,
} from "./finance-types";
import type { Currency } from "./finance-types";
import {
  computeParticipationPrice,
  computeSuggestedRefund,
  generateInstallments,
  installmentPaidAmount,
  installmentRemaining,
  rebalanceInstallments,
} from "./finance";

// ─── Helpers de seed ──────────────────────────────────────────
function seedEnrollee(
  id: string,
  name: string,
  email: string,
  phone: string,
  enrolledAt: string,
  total: number,
  count: InstallmentCount,
  paidPattern: boolean[],
): Enrollee {
  // Genera N cuotas distribuidas entre enrolledAt y un horizonte de 4 meses
  const start = enrolledAt;
  const [y, m, d] = enrolledAt.split("-").map(Number);
  const end = new Date(y, (m ?? 1) - 1 + 4, d ?? 1);
  const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  const installments = generateInstallments(total, count, start, endIso).map((inst, idx) => ({
    ...inst,
    status: paidPattern[idx] ? ("pagado" as const) : ("pendiente" as const),
    paidAt: paidPattern[idx] ? inst.dueDate : undefined,
  }));
  const auditLog: AuditEntry[] = [
    {
      id: `a_${id}_0`,
      at: `${enrolledAt}T09:00:00.000Z`,
      action: "inscripcion",
      summary: `Inscripción registrada · ${formatUSD(total)}`,
      details: { total, cuotas: count },
    },
    {
      id: `a_${id}_1`,
      at: `${enrolledAt}T09:01:00.000Z`,
      action: "plan_creado",
      summary: `Plan de pagos creado (${count} ${count === 1 ? "cuota" : "cuotas"})`,
    },
  ];
  paidPattern.forEach((paid, idx) => {
    if (!paid) return;
    auditLog.push({
      id: `a_${id}_p${idx}`,
      at: `${installments[idx].dueDate}T12:00:00.000Z`,
      action: "cuota_pagada",
      summary: `Cuota ${idx + 1} pagada · ${formatUSD(installments[idx].amount)}`,
    });
  });
  return {
    id,
    name,
    email,
    phone,
    enrolledAt,
    basePrice: total,
    discount: null,
    totalDue: total,
    installments,
    auditLog,
  };
}

// Helper: añade una entrada al audit log de una viajera (inmutable).
function appendAudit(
  enrollee: Enrollee,
  action: AuditAction,
  summary: string,
  details?: AuditEntry["details"],
): Enrollee {
  const entry: AuditEntry = {
    id: generateId(),
    at: new Date().toISOString(),
    action,
    summary,
    details,
  };
  return { ...enrollee, auditLog: [...(enrollee.auditLog ?? []), entry] };
}

// (Sin seed en memoria: los viajes se cargan desde Supabase al iniciar sesión.)

// ─── Multimoneda: backfill al hidratar ───────────────────────────
// Rellena los campos nuevos de trazabilidad para viajes/costos existentes
// que fueron guardados antes de la v2 de multimoneda. NO altera montos ni
// cálculos: reconstruye `originalAmount/currency`, `baseCurrency`, `rateUsed`
// y `convertedAmount` desde `amount`, `currency` y `amountUSD` usando la
// tabla estática `EXCHANGE_RATES`. Silencioso, idempotente.
export function backfillTripCurrencyFields(trip: TripData): TripData {
  const base = getTripBaseCurrency(trip);
  const local =
    trip.localCurrency ?? suggestLocalCurrency(trip.country, trip.destination) ?? undefined;
  const localRate =
    trip.exchangeRate ?? (local ? EXCHANGE_RATES[local] / EXCHANGE_RATES[base] : undefined);
  const patched: TripData = {
    ...trip,
    baseCurrency: base,
    localCurrency: local,
    exchangeRate: localRate,
    exchangeRateUpdatedAt: trip.exchangeRateUpdatedAt,
    costs: (trip.costs ?? []).map((c) => {
      // Migración silenciosa: time (legacy) → startTime.
      const startTime = c.startTime ?? c.time;
      if (c.isDraft) {
        return startTime !== c.startTime ? { ...c, startTime } : c;
      }
      const needsCurrencyBackfill = !(
        c.originalAmount != null &&
        c.convertedAmount != null &&
        c.rateUsed != null
      );
      if (!needsCurrencyBackfill && startTime === c.startTime) return c;
      const orig = c.amount;
      const origCur = c.currency;
      // Tasa histórica implícita: convertedAmount = orig * rate(base per orig).
      // Se calcula desde EXCHANGE_RATES (vía USD como pivot).
      const fromUsd = EXCHANGE_RATES[origCur] ?? 1;
      const toUsd = EXCHANGE_RATES[base] ?? 1;
      const rate = toUsd > 0 ? fromUsd / toUsd : 1;
      const converted = Math.round(orig * rate * 100) / 100;
      return {
        ...c,
        startTime,
        ...(needsCurrencyBackfill
          ? {
              originalAmount: c.originalAmount ?? orig,
              originalCurrency: c.originalCurrency ?? origCur,
              baseCurrency: c.baseCurrency ?? base,
              rateUsed: c.rateUsed ?? rate,
              convertedAmount: c.convertedAmount ?? converted,
            }
          : {}),
      };
    }),
  };
  return patched;
}

interface TripsState {
  trips: Record<string, TripData>;
  hydrated: boolean;
  hydrating: boolean;
  saveError: string | null;

  // ─── Sincronización con Supabase ──────────────────────────────
  /** Carga los viajes visibles al usuario. Idempotente salvo `force`. */
  hydrateFromSupabase: (opts?: { force?: boolean }) => Promise<void>;
  /** Limpia el store (usar en sign-out). */
  resetTrips: () => void;
  /** Crea un viaje (persistencia inmediata + optimista en el store). */
  createTrip: (trip: TripData) => Promise<void>;
  /** Elimina un viaje definitivamente (hard delete, no papelera). */
  deleteTrip: (tripId: string) => Promise<void>;
  /**
   * Duplica un viaje. Copia estructura reutilizable (itinerario, costos,
   * proveedores, reglas, config de moneda, cover, capacidad, precio). NO copia
   * viajeras, inscripciones, pagos, miembros, invitaciones ni datos de papelera.
   * Genera nuevos IDs para toda entidad hija. Devuelve el id del nuevo viaje.
   */
  duplicateTrip: (tripId: string, opts?: { copyDates?: boolean }) => Promise<string | null>;
  /** Mueve un viaje a la papelera (soft delete). Recuperable por 7 días. */
  trashTrip: (tripId: string) => Promise<void>;
  /** Restaura un viaje desde la papelera. */
  restoreTrip: (tripId: string) => Promise<void>;
  /** Purga definitivamente un viaje (hard delete). Usar desde la papelera. */
  purgeTrip: (tripId: string) => Promise<void>;

  /** Actualiza campos meta del viaje (nombre, destino, país, fechas, capacidad, precio). */
  updateTripMeta: (
    tripId: string,
    patch: Partial<
      Pick<
        TripData,
        | "name"
        | "destination"
        | "country"
        | "startDate"
        | "endDate"
        | "capacity"
        | "pricePerPerson"
        | "currency"
        | "status"
        | "baseCurrency"
        | "localCurrency"
        | "exchangeRate"
        | "exchangeRateUpdatedAt"
        | "coverImage"
      >
    >,
  ) => void;
  /**
   * Actualiza la configuración de moneda del viaje. Puede recalcular los
   * costos ya cargados (rompe trazabilidad histórica; audit implícito).
   * - `recalc=false` (default seguro): solo cambia la config; los costos
   *   ya cargados conservan su `rateUsed` / `convertedAmount`.
   * - `recalc=true`: recalcula `convertedAmount` y `amountUSD` de todos los
   *   costos NO draft usando la nueva tasa; actualiza `rateUsed` y
   *   `baseCurrency` en cada uno.
   */
  setTripCurrencyConfig: (
    tripId: string,
    config: { baseCurrency: Currency; localCurrency: Currency | null; exchangeRate: number | null },
    options?: { recalcExistingCosts?: boolean },
  ) => void;

  // Acciones sobre costos
  addCost: (
    tripId: string,
    cost: Omit<CostItem, "id" | "createdAt"> & { id?: string; createdAt?: number },
  ) => void;

  updateCost: (tripId: string, costId: string, patch: Partial<CostItem>) => void;
  removeCost: (tripId: string, costId: string) => void;
  /** Reemplaza el arreglo completo de costos del viaje (usado por undo/redo). */
  setCosts: (tripId: string, costs: CostItem[]) => void;
  setCostItineraryDay: (tripId: string, costId: string, day: number | null) => void;
  setItineraryDayCity: (tripId: string, day: number, city: string) => void;

  // Acciones sobre tags del itinerario
  seedTagsIfNeeded: (tripId: string) => void;
  addTag: (tripId: string, label: string, colorKey: import("./tags").TagColorKey) => import("./tags").TripTag | null;
  updateTag: (tripId: string, tagId: string, patch: Partial<Pick<import("./tags").TripTag, "label" | "colorKey">>) => boolean;
  /**
   * Elimina un tag del catálogo. `mode = "toText"` convierte todas las
   * ocurrencias del tag en texto plano usando el label actual.
   * `mode = "replace"` sustituye por otro tag existente.
   */
  removeTag: (
    tripId: string,
    tagId: string,
    mode: { kind: "toText" } | { kind: "replace"; withTagId: string },
  ) => void;

  // Acciones sobre proveedores
  addProvider: (
    tripId: string,
    provider: Omit<Provider, "id" | "createdAt"> & { id?: string; createdAt?: number },
  ) => void;
  updateProvider: (tripId: string, providerId: string, patch: Partial<Provider>) => void;
  removeProvider: (tripId: string, providerId: string) => void;
  setProviderStatus: (tripId: string, providerId: string, status: ProviderStatus) => void;

  // Acciones sobre viajeras / cuotas
  setPaymentPlan: (tripId: string, enrolleeId: string, installments: Installment[]) => void;
  updateInstallment: (
    tripId: string,
    enrolleeId: string,
    installmentId: string,
    patch: Partial<Installment>,
  ) => void;
  toggleInstallmentPaid: (tripId: string, enrolleeId: string, installmentId: string) => void;
  /** Registra un abono parcial. Si suma cubre el total, marca la cuota como pagada. */
  addInstallmentPayment: (
    tripId: string,
    enrolleeId: string,
    installmentId: string,
    payment: {
      amount: number;
      paidAt: string;
      notes?: string;
      method?: import("./finance-types").PaymentMethod;
      feePercent?: number;
      feeFixed?: number;
      feeDescription?: string;
    },
  ) => void;
  /** Elimina un abono individual. Recalcula el status de la cuota. */
  removeInstallmentPayment: (
    tripId: string,
    enrolleeId: string,
    installmentId: string,
    paymentId: string,
  ) => void;
  /**
   * Edita un abono existente: método, %, fijo, fecha, notas y MONTO.
   * Si cambia el monto, redistribuye el delta exactamente igual que
   * `addInstallmentPayment`: el cuota target se cierra al nuevo total pagado;
   * el excedente reduce/elimina cuotas pendientes posteriores (o queda como
   * sobrepago); el faltante bumpea la última pendiente posterior (o queda
   * como saldo sin asignar). Recalcula comisión y neto.
   */
  updateInstallmentPayment: (
    tripId: string,
    enrolleeId: string,
    installmentId: string,
    paymentId: string,
    patch: {
      amount?: number;
      method?: import("./finance-types").PaymentMethod;
      feePercent?: number;
      feeFixed?: number;
      feeDescription?: string;
      paidAt?: string;
      notes?: string;
    },
  ) => void;
  /**
   * Caso especial: cuota marcada como pagada (status="pagado") pero SIN abonos
   * registrados (orphan paid — viene de toggleInstallmentPaid antiguo o data
   * histórica). Crea un abono sintético por el monto completo de la cuota con
   * el método/fecha/notas elegidos. NO redistribuye delta (la cuota ya estaba
   * cerrada al monto correcto). Si la cuota ya tiene abonos, no hace nada.
   */
  attachOrphanPaidMethod: (
    tripId: string,
    enrolleeId: string,
    installmentId: string,
    payment: {
      paidAt: string;
      notes?: string;
      method?: import("./finance-types").PaymentMethod;
      feePercent?: number;
      feeFixed?: number;
      feeDescription?: string;
    },
  ) => void;
  /**
   * Resuelve el saldo sin asignar de una viajera. `create_installment` crea
   * una nueva cuota pendiente con el monto/fecha indicados (defaults: monto
   * = saldo actual, fecha = hoy). `dismiss` deja el saldo registrado para
   * resolverlo manualmente más tarde.
   */
  resolveUnassignedBalance: (
    tripId: string,
    enrolleeId: string,
    action: "create_installment" | "dismiss",
    payload?: { amount?: number; dueDate?: string },
  ) => void;
  /**
   * Resuelve un sobrepago de la viajera.
   * - `refunded`: limpia el monto (se devolvió). Audit: sobrepago_devuelto.
   * - `acknowledge`: deja el monto como crédito a favor; silencia el banner
   *   pero el monto sigue visible en métricas. Audit: sobrepago_credito.
   *   Si más adelante el sobrepago crece, el aviso vuelve a aparecer.
   */
  resolveOverpayment: (
    tripId: string,
    enrolleeId: string,
    action: "refunded" | "acknowledge",
    notes?: string,
  ) => void;
  /**
   * Aplica un crédito a favor de una viajera (origen) a otra inscripción
   * (destino, puede ser otro viaje del mismo email o cualquier inscripción
   * elegida manualmente). Reduce `overpayment` del origen en `amount`,
   * descuenta `amount` del `totalDue` del destino y rebalancea las cuotas
   * pendientes del destino. Registra `appliedCredits[]` en destino y audit
   * (`credito_aplicado` en origen, `credito_recibido` en destino).
   * Devuelve true si se aplicó, false si origen/destino no existen o el
   * monto es inválido / mayor al disponible.
   */
  applyCreditToTrip: (
    sourceTripId: string,
    sourceEnrolleeId: string,
    destinationTripId: string,
    destinationEnrolleeId: string,
    amount: number,
    notes?: string,
  ) => boolean;
  /**
   * Reserva el crédito para el próximo viaje al que se inscriba la viajera
   * (matching automático por email en `addEnrollee`). Reduce `overpayment`
   * del origen, marca `reservedCreditForFutureTrip`. Audit: `credito_reservado`.
   */
  reserveCreditForFuture: (
    tripId: string,
    enrolleeId: string,
    amount: number,
    notes?: string,
  ) => boolean;
  /**
   * Revierte un crédito previamente aplicado al destino. Suma el monto de
   * vuelta al `overpayment` del origen (reactivando `acknowledged`), aumenta
   * el `totalDue` del destino y rebalancea sus cuotas pendientes. Elimina la
   * entrada de `appliedCredits[]`. Audit: `credito_revertido` en ambos lados.
   * Devuelve true si se revirtió, false si origen/destino/credit no existen.
   */
  revertAppliedCredit: (
    destinationTripId: string,
    destinationEnrolleeId: string,
    appliedCreditId: string,
    notes?: string,
  ) => boolean;
  /**
   * Aplica o quita un descuento. Recalcula totalDue (= finalPrice) y rebalancea
   * las cuotas PENDIENTES para que la suma del plan = nuevo totalDue. Las
   * cuotas pagadas se preservan intactas.
   */
  setDiscount: (tripId: string, enrolleeId: string, discount: Discount | null) => void;

  // Cancelación / participación / reglas de devolución
  setRefundRules: (tripId: string, rules: RefundRule[]) => void;
  cancelEnrollee: (tripId: string, enrolleeId: string, cancellation: Cancellation) => void;
  reactivateEnrollee: (tripId: string, enrolleeId: string) => void;
  setParticipation: (
    tripId: string,
    enrolleeId: string,
    participation: Participation | null,
  ) => void;
  /** Helper: sugiere devolución según reglas + fecha + pagado. */
  suggestRefund: (
    tripId: string,
    enrolleeId: string,
    cancelledAt: string,
  ) => { amount: number; ruleId?: string; percent: number };

  // Gestión manual de viajeras
  addEnrollee: (
    tripId: string,
    data: { name: string; email: string; phone: string; enrolledAt: string },
  ) => string | null;
  updateEnrolleeContact: (
    tripId: string,
    enrolleeId: string,
    patch: { name?: string; email?: string; phone?: string },
  ) => void;
  /** Actualiza logística (vuelos / seguro) de una viajera. Audit: logistica_editada. */
  setEnrolleeLogistics: (
    tripId: string,
    enrolleeId: string,
    patch: Partial<import("./finance-types").EnrolleeLogistics>,
    summary?: string,
  ) => void;
  /** Agrega un adjunto ya subido al storage. Audit: adjunto_agregado. */
  addEnrolleeAttachment: (
    tripId: string,
    enrolleeId: string,
    attachment: Omit<import("./finance-types").EnrolleeAttachment, "id" | "uploadedAt">,
  ) => void;
  /** Quita un adjunto del registro de la viajera. Audit: adjunto_eliminado. */
  removeEnrolleeAttachment: (tripId: string, enrolleeId: string, attachmentId: string) => void;
  removeEnrollee: (tripId: string, enrolleeId: string) => void;
  setEnrolleeNotes: (tripId: string, enrolleeId: string, notes: string) => void;

  // ─── Extras (servicios adicionales por viajera) ───────────────
  /**
   * Crea un Extra para una viajera con un plan de cuotas. Si `paymentMode`
   * es "unico" se ignora `installments` y se genera 1 cuota por el total.
   * Audit: extra_creado.
   */
  addExtra: (
    tripId: string,
    enrolleeId: string,
    data: {
      name: string;
      price: number;
      cost: number;
      date?: string;
      paymentMode: import("./finance-types").ExtraPaymentMode;
      /** Solo se respeta si paymentMode="cuotas". Cada cuota: { amount, dueDate, method?, notes? }. */
      installments?: Array<{
        amount: number;
        dueDate: string;
        method?: import("./finance-types").PaymentMethod;
        notes?: string;
      }>;
      /** Solo aplica a "unico": marcar la cuota como pagada al crear. */
      markPaid?: boolean;
      /** Fecha de vencimiento de la cuota única (solo paymentMode="unico"). */
      dueDate?: string;
      /** Método de pago de la cuota única cuando markPaid=true. */
      method?: import("./finance-types").PaymentMethod;
      /** Notas opcionales asociadas a la cuota única. */
      notes?: string;
      /** Comisión % de la cuota única (solo si method genera fee). */
      feePercent?: number;
      /** Comisión fija de la cuota única (solo si method genera fee). */
      feeFixed?: number;
      /** Descripción / referencia del método/comisión. */
      feeDescription?: string;
    },
  ) => void;
  /**
   * Actualiza nombre/precio/costo/fecha del Extra. NO modifica el plan de
   * cuotas: si cambia el `price`, las cuotas pendientes se rebalancean
   * proporcionalmente para que la suma siga igualando el price.
   * Audit: extra_editado.
   */
  updateExtra: (
    tripId: string,
    enrolleeId: string,
    extraId: string,
    patch: { name?: string; price?: number; cost?: number; date?: string | null },
  ) => void;
  /** Reemplaza completo el plan de cuotas de un Extra. El total debe igualar `price`.
   *  Audit: extra_editado. */
  replaceExtraInstallments: (
    tripId: string,
    enrolleeId: string,
    extraId: string,
    installments: Array<{
      id?: string;
      amount: number;
      dueDate: string;
      status?: "pendiente" | "pagado";
      paidAt?: string;
      method?: import("./finance-types").PaymentMethod;
      notes?: string;
      feePercent?: number;
      feeFixed?: number;
      feeDescription?: string;
      feeAmount?: number;
      netAmount?: number;
    }>,
    paymentMode?: import("./finance-types").ExtraPaymentMode,
  ) => void;
  /** Elimina un Extra. Audit: extra_eliminado. */
  removeExtra: (tripId: string, enrolleeId: string, extraId: string) => void;
  /**
   * Marca una cuota del extra como pagada. Audit: extra_pagado.
   * `paidAt` default = hoy. Método default = "transferencia".
   */
  markExtraInstallmentPaid: (
    tripId: string,
    enrolleeId: string,
    extraId: string,
    installmentId: string,
    payload?: {
      paidAt?: string;
      method?: import("./finance-types").PaymentMethod;
      notes?: string;
      /** Comisión % (solo si method genera fee). */
      feePercent?: number;
      /** Comisión fija (solo si method genera fee). */
      feeFixed?: number;
      /** Descripción / referencia del método/comisión. */
      feeDescription?: string;
    },
  ) => void;
  /** Revierte el pago de una cuota del extra (vuelve a pendiente). Audit: extra_pago_revertido. */
  revertExtraInstallment: (
    tripId: string,
    enrolleeId: string,
    extraId: string,
    installmentId: string,
  ) => void;
}

function mapEnrollee(trip: TripData, enrolleeId: string, fn: (e: Enrollee) => Enrollee): TripData {
  return {
    ...trip,
    enrollees: trip.enrollees.map((e) => (e.id === enrolleeId ? fn(e) : e)),
  };
}

export const useTripsStore = create<TripsState>()((set, get) => ({
  trips: {},
  hydrated: false,
  hydrating: false,
  saveError: null,

  hydrateFromSupabase: async (opts) => {
    const force = opts?.force === true;
    if (get().hydrating) return;
    if (!force && get().hydrated) return;
    set({ hydrating: true, saveError: null });
    try {
      const rows = await listMyTrips();
      const trips: Record<string, TripData> = {};
      for (const row of rows) {
        if (row?.data && typeof row.data === "object") {
          const td = row.data as unknown as TripData;
          trips[row.id] = backfillTripCurrencyFields({
            ...td,
            id: row.id,
            // Fallback a columnas de la tabla si el blob no las trae
            name: td.name ?? (row as any).name ?? "Viaje sin nombre",
            destination: td.destination ?? (row as any).destination ?? "",
            startDate: td.startDate ?? (row as any).startDate ?? "",
            endDate: td.endDate ?? (row as any).endDate ?? "",
            status: td.status ?? (row as any).status ?? "planificacion",
          } as TripData);
        }
      }
      // Auto-purge de viajes en papelera cuyo purgeAt ya venció.
      const nowMs = Date.now();
      const toPurge: string[] = [];
      for (const [id, t] of Object.entries(trips)) {
        if (t.isDeleted && t.purgeAt) {
          const p = Date.parse(t.purgeAt);
          if (!isNaN(p) && p <= nowMs) {
            toPurge.push(id);
          }
        }
      }
      for (const id of toPurge) delete trips[id];
      // En re-hidrataciones por Realtime, preservar el estado local de los
      // viajes cuyo guardado está en cola — el servidor aún no vio nuestros
      // cambios, así que la versión remota está desactualizada para ellos.
      if (force) {
        const localTrips = get().trips;
        for (const id of Object.keys(localTrips)) {
          if (hasPendingSave(id)) {
            trips[id] = localTrips[id];
          }
        }
      }
      set({ trips, hydrated: true, hydrating: false });
      // Fire-and-forget hard delete de los expirados. No bloquea la UI.
      for (const id of toPurge) {
        deleteTripFn({ data: { id } }).catch((e) =>
          console.error("[trips-store] auto-purge falló", id, e),
        );
      }
    } catch (e) {
      console.error("[trips-store] hydrateFromSupabase falló", e);
      set({
        hydrating: false,
        saveError: e instanceof Error ? e.message : "Error al cargar viajes",
      });
    }
  },

  resetTrips: () => set({ trips: {}, hydrated: false, hydrating: false, saveError: null }),

  createTrip: async (trip) => {
    set((state) => ({ trips: { ...state.trips, [trip.id]: trip } }));
    try {
      const emptyToNull = (v: string | null | undefined) => (v && v.trim() ? v : null);
      await createTripFn({
        data: {
          id: trip.id,
          name: trip.name,
          destination: emptyToNull(trip.destination),
          startDate: emptyToNull(trip.startDate),
          endDate: emptyToNull(trip.endDate),
          status: emptyToNull(trip.status),
          data: trip as unknown as Record<string, unknown>,
        },
      });
    } catch (e) {
      console.error("[trips-store] createTrip falló", e);
      // Rollback optimista
      set((state) => {
        const { [trip.id]: _, ...rest } = state.trips;
        return { trips: rest, saveError: e instanceof Error ? e.message : "Error al crear viaje" };
      });
      throw e;
    }
  },

  duplicateTrip: async (tripId, opts) => {
    const source = get().trips[tripId];
    if (!source) return null;
    const newId = generateId();
    const nowMs = Date.now();
    const costIdMap = new Map<string, string>();
    const newCosts = (source.costs ?? []).map((c) => {
      const nid = generateId();
      costIdMap.set(c.id, nid);
      return { ...c, id: nid, createdAt: nowMs };
    });
    const newProviders = (source.providers ?? []).map((p) => {
      const legacyIds = p.linkedCostIds && p.linkedCostIds.length > 0
        ? p.linkedCostIds
        : (p.linkedCostId ? [p.linkedCostId] : []);
      const mappedIds = legacyIds
        .map((id) => costIdMap.get(id) ?? id)
        .filter((id): id is string => !!id);
      return {
        ...p,
        id: generateId(),
        createdAt: nowMs,
        status: "pendiente" as ProviderStatus,
        linkedCostIds: mappedIds,
        linkedCostId: mappedIds[0] ?? null,
      };
    });
    const newRules = (source.refundRules ?? []).map((r) => ({ ...r, id: generateId() }));
    const newItinerary = (source.itinerary ?? []).map((d) => ({
      ...d,
      activities: [...(d.activities ?? [])],
    }));
    const copyDates = opts?.copyDates ?? true;
    const clone: TripData = {
      ...source,
      id: newId,
      name: `${source.name} (copia)`,
      status: "planificando",
      startDate: copyDates ? source.startDate : null,
      endDate: copyDates ? source.endDate : null,
      enrolled: 0,
      enrollees: [],
      itinerary: newItinerary,
      costs: newCosts,
      providers: newProviders,
      refundRules: newRules,
      isDeleted: undefined,
      deletedAt: undefined,
      purgeAt: undefined,
    };
    await get().createTrip(clone);
    return newId;
  },

  trashTrip: async (tripId) => {
    const trip = get().trips[tripId];
    if (!trip) return;
    const now = new Date();
    const purge = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const next: TripData = {
      ...trip,
      isDeleted: true,
      deletedAt: now.toISOString(),
      purgeAt: purge.toISOString(),
    };
    set((state) => ({ trips: { ...state.trips, [tripId]: next } }));
    try {
      await saveTripNow(tripId);
    } catch (e) {
      // rollback
      set((state) => ({ trips: { ...state.trips, [tripId]: trip } }));
      throw e;
    }
  },

  restoreTrip: async (tripId) => {
    const trip = get().trips[tripId];
    if (!trip) return;
    const next: TripData = {
      ...trip,
      isDeleted: undefined,
      deletedAt: undefined,
      purgeAt: undefined,
    };
    set((state) => ({ trips: { ...state.trips, [tripId]: next } }));
    try {
      await saveTripNow(tripId);
    } catch (e) {
      set((state) => ({ trips: { ...state.trips, [tripId]: trip } }));
      throw e;
    }
  },

  purgeTrip: async (tripId) => {
    await get().deleteTrip(tripId);
  },

  deleteTrip: async (tripId) => {
    const prev = get().trips[tripId];
    set((state) => {
      const { [tripId]: _, ...rest } = state.trips;
      return { trips: rest };
    });
    try {
      await deleteTripFn({ data: { id: tripId } });
    } catch (e) {
      console.error("[trips-store] deleteTrip falló", e);
      if (prev) set((state) => ({ trips: { ...state.trips, [tripId]: prev } }));
      throw e;
    }
  },

  updateTripMeta: (tripId, patch) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      const nextTrip: TripData = { ...trip, ...patch };
      // Si cambia el precio del viaje, recalculamos basePrice/totalDue de
      // cada viajera activa: heredan el nuevo precio, respetando descuento,
      // participación y créditos ya aplicados. No tocamos las cuotas
      // existentes ni lo ya pagado; la alerta de "Suma cuotas ≠ total"
      // avisará si el plan queda desalineado.
      const newPrice = patch.pricePerPerson;
      if (typeof newPrice === "number" && Number.isFinite(newPrice)) {
        const round2 = (n: number) => Math.round(n * 100) / 100;
        nextTrip.enrollees = trip.enrollees.map((e) => {
          if (e.status === "cancelada") return e;
          const finalPrice = computeFinalPrice(newPrice, e.discount);
          const effective = computeParticipationPrice(finalPrice, e.participation);
          const creditsApplied = round2(
            (e.appliedCredits ?? []).reduce((s, c) => s + (c.amount ?? 0), 0),
          );
          const newTotal = round2(Math.max(0, effective - creditsApplied));
          if (e.basePrice === newPrice && e.totalDue === newTotal) return e;
          return appendAudit(
            { ...e, basePrice: newPrice, totalDue: newTotal },
            "inscripcion",
            `Precio del viaje actualizado · nuevo total ${formatUSD(newTotal)}`,
            { precio_viaje: newPrice, total_nuevo: newTotal },
          );
        });
      }
      return { trips: { ...state.trips, [tripId]: nextTrip } };
    }),

  setTripCurrencyConfig: (tripId, config, options) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      const now = new Date().toISOString();
      const prevBase = getTripBaseCurrency(trip);
      const nextBase = config.baseCurrency;
      const baseChanged = prevBase !== nextBase;
      const next: TripData = {
        ...trip,
        currency: config.baseCurrency,
        baseCurrency: config.baseCurrency,
        localCurrency: config.localCurrency ?? undefined,
        exchangeRate: config.exchangeRate ?? undefined,
        exchangeRateUpdatedAt: now,
      };
      // Si cambió la moneda base, convertimos `pricePerPerson` desde la
      // base anterior a la nueva para que la utilidad y el margen sigan
      // siendo comparables. Se usa la tasa del viaje si aplica y, como
      // fallback, la tabla global via USD (misma lógica que los costos).
      if (baseChanged && typeof trip.pricePerPerson === "number" && trip.pricePerPerson > 0) {
        const { amount: nextPrice } = convertAmount(trip.pricePerPerson, prevBase, nextBase, next);
        next.pricePerPerson = Math.round(nextPrice * 100) / 100;
      }
      if (options?.recalcExistingCosts) {
        // Reconvierte cada costo NO-draft usando la nueva configuración de
        // moneda base/local/tasa a través del helper único
        // `buildCostConversion`, que ya cubre todos los casos (base==local,
        // origen==base, cross vía USD). Esto garantiza consistencia con la
        // creación/edición manual de costos.
        next.costs = (trip.costs ?? []).map((c) => {
          if (c.isDraft) return c;
          const orig = c.originalAmount ?? c.amount;
          const origCur = (c.originalCurrency ?? c.currency) as Currency;
          const conv = buildCostConversion(orig, origCur, next);
          return {
            ...c,
            amount: conv.amount,
            currency: conv.currency,
            amountUSD: conv.amountUSD,
            originalAmount: conv.originalAmount,
            originalCurrency: conv.originalCurrency,
            baseCurrency: conv.baseCurrency,
            rateUsed: conv.rateUsed,
            convertedAmount: conv.convertedAmount,
          };
        });
      }
      return { trips: { ...state.trips, [tripId]: next } };
    }),

  addCost: (tripId, cost) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      const newCost: CostItem = {
        id: cost.id ?? generateId(),
        createdAt: cost.createdAt ?? Date.now(),
        description: cost.description,
        notes: cost.notes,
        category: cost.category,
        amount: cost.amount,
        currency: cost.currency,
        amountUSD: cost.amountUSD,
        perPerson: cost.perPerson,
        itineraryDay: cost.itineraryDay,
        time: cost.time,
        startTime: cost.startTime,
        endTime: cost.endTime,
        isDraft: cost.isDraft,
        included: cost.included,
        originalAmount: cost.originalAmount,
        originalCurrency: cost.originalCurrency,
        baseCurrency: cost.baseCurrency,
        rateUsed: cost.rateUsed,
        convertedAmount: cost.convertedAmount,
      };
      return {
        trips: { ...state.trips, [tripId]: { ...trip, costs: [...trip.costs, newCost] } },
      };
    }),

  updateCost: (tripId, costId, patch) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      const tags = trip.tags ?? [];
      return {
        trips: {
          ...state.trips,
          [tripId]: {
            ...trip,
            costs: trip.costs.map((c) => {
              if (c.id !== costId) return c;
              const merged = { ...c, ...patch };
              // Si el patch trae descriptionNodes, derivo `description` desde ahí.
              if ("descriptionNodes" in patch) {
                const nodes = patch.descriptionNodes;
                if (nodes && nodes.length > 0) {
                  merged.description = nodesToPlainText(nodes, tags);
                } else {
                  merged.descriptionNodes = undefined;
                }
              }
              return merged;
            }),
          },
        },
      };
    }),

  removeCost: (tripId, costId) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: { ...trip, costs: trip.costs.filter((c) => c.id !== costId) },
        },
      };
    }),

  setCosts: (tripId, costs) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: { ...state.trips, [tripId]: { ...trip, costs: [...costs] } },
      };
    }),

  setCostItineraryDay: (tripId, costId, day) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: {
            ...trip,
            costs: trip.costs.map((c) => (c.id === costId ? { ...c, itineraryDay: day } : c)),
          },
        },
      };
    }),

  setItineraryDayCity: (tripId, day, city) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      const trimmed = city.trim();
      const existing = trip.itinerary ?? [];
      const has = existing.some((d) => d.day === day);
      const nextItinerary = has
        ? existing.map((d) => (d.day === day ? { ...d, city: trimmed || undefined } : d))
        : [
            ...existing,
            { day, title: "", description: "", activities: [], city: trimmed || undefined },
          ].sort((a, b) => a.day - b.day);
      return {
        trips: {
          ...state.trips,
          [tripId]: { ...trip, itinerary: nextItinerary },
        },
      };
    }),

  // ─── Tags del itinerario ────────────────────────────
  seedTagsIfNeeded: (tripId) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      if (trip.tagsInitialized) return state;
      if (trip.tags !== undefined) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: { ...trip, tags: seedDefaultTags(), tagsInitialized: true },
        },
      };
    }),

  addTag: (tripId, label, colorKey) => {
    const state = get();
    const trip = state.trips[tripId];
    if (!trip) return null;
    const tags = trip.tags ?? [];
    if (isDuplicateTagLabel(tags, label)) return null;
    const clean = normalizeTagLabel(label);
    if (!clean) return null;
    const newTag: TripTag = { id: generateId(), label: clean, colorKey };
    set({
      trips: {
        ...state.trips,
        [tripId]: { ...trip, tags: [...tags, newTag], tagsInitialized: true },
      },
    });
    return newTag;
  },

  updateTag: (tripId, tagId, patch) => {
    const state = get();
    const trip = state.trips[tripId];
    if (!trip) return false;
    const tags = trip.tags ?? [];
    const nextLabel =
      patch.label !== undefined ? normalizeTagLabel(patch.label) : undefined;
    if (nextLabel !== undefined) {
      if (!nextLabel) return false;
      if (isDuplicateTagLabel(tags, nextLabel, tagId)) return false;
    }
    const nextTags = tags.map((t) =>
      t.id === tagId
        ? {
            ...t,
            label: nextLabel !== undefined ? nextLabel : t.label,
            colorKey: patch.colorKey ?? t.colorKey,
          }
        : t,
    );
    // Recalcular `description` (texto plano) de todos los costos que usan este tag.
    const nextCosts = trip.costs.map((c) => {
      if (!c.descriptionNodes) return c;
      const uses = c.descriptionNodes.some(
        (n) => n.type === "tag" && n.tagId === tagId,
      );
      if (!uses) return c;
      // También actualizo fallbackLabel para mantenerlo al día.
      const newTag = nextTags.find((t) => t.id === tagId);
      const nodes = c.descriptionNodes.map((n) =>
        n.type === "tag" && n.tagId === tagId
          ? { ...n, fallbackLabel: newTag?.label ?? n.fallbackLabel }
          : n,
      );
      return { ...c, descriptionNodes: nodes, description: nodesToPlainText(nodes, nextTags) };
    });
    set({
      trips: {
        ...state.trips,
        [tripId]: { ...trip, tags: nextTags, costs: nextCosts },
      },
    });
    return true;
  },

  removeTag: (tripId, tagId, mode) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      const tags = trip.tags ?? [];
      const target = tags.find((t) => t.id === tagId);
      if (!target) return state;
      const nextTags = tags.filter((t) => t.id !== tagId);
      const nextCosts = trip.costs.map((c) => {
        if (!c.descriptionNodes) return c;
        const uses = c.descriptionNodes.some(
          (n) => n.type === "tag" && n.tagId === tagId,
        );
        if (!uses) return c;
        let nodes = c.descriptionNodes;
        if (mode.kind === "toText") {
          nodes = convertTagToText(nodes, tagId, target.label);
        } else {
          const to = nextTags.find((t) => t.id === mode.withTagId);
          if (!to) {
            // Fallback: si el "reemplazar por" ya no existe → convertir a texto.
            nodes = convertTagToText(nodes, tagId, target.label);
          } else {
            nodes = replaceTagId(nodes, tagId, to.id, to.label);
          }
        }
        return { ...c, descriptionNodes: nodes, description: nodesToPlainText(nodes, nextTags) };
      });
      return {
        trips: {
          ...state.trips,
          [tripId]: { ...trip, tags: nextTags, tagsInitialized: true, costs: nextCosts },
        },
      };
    }),

  // ─── Proveedores ─────────────────────────────────────
  addProvider: (tripId, provider) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      const providedIds = provider.linkedCostIds && provider.linkedCostIds.length > 0
        ? provider.linkedCostIds
        : (provider.linkedCostId ? [provider.linkedCostId] : []);
      const newProvider: Provider = {
        id: provider.id ?? generateId(),
        createdAt: provider.createdAt ?? Date.now(),
        name: provider.name,
        category: provider.category,
        status: provider.status,
        contactName: provider.contactName,
        contactPhone: provider.contactPhone,
        contactEmail: provider.contactEmail,
        reservationCode: provider.reservationCode,
        serviceDate: provider.serviceDate,
        notes: provider.notes,
        linkedCostIds: providedIds,
        linkedCostId: providedIds[0] ?? null,
      };
      return {
        trips: {
          ...state.trips,
          [tripId]: { ...trip, providers: [...(trip.providers ?? []), newProvider] },
        },
      };
    }),

  updateProvider: (tripId, providerId, patch) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: {
            ...trip,
            providers: (trip.providers ?? []).map((p) => {
              if (p.id !== providerId) return p;
              const merged = { ...p, ...patch };
              // Mantener sincronizado el campo legacy `linkedCostId`.
              if ("linkedCostIds" in patch) {
                merged.linkedCostId = (patch.linkedCostIds ?? [])[0] ?? null;
              } else if ("linkedCostId" in patch) {
                const single = patch.linkedCostId;
                merged.linkedCostIds = single ? [single] : [];
              }
              return merged;
            }),
          },
        },
      };
    }),

  removeProvider: (tripId, providerId) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: {
            ...trip,
            providers: (trip.providers ?? []).filter((p) => p.id !== providerId),
          },
        },
      };
    }),

  setProviderStatus: (tripId, providerId, status) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: {
            ...trip,
            providers: (trip.providers ?? []).map((p) =>
              p.id === providerId ? { ...p, status } : p,
            ),
          },
        },
      };
    }),

  setPaymentPlan: (tripId, enrolleeId, installments) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const wasEmpty = (e.installments ?? []).length === 0;
            const total = installments.reduce((s, i) => s + i.amount, 0);
            return appendAudit(
              { ...e, installments },
              wasEmpty ? "plan_creado" : "plan_reemplazado",
              `${wasEmpty ? "Plan creado" : "Plan reemplazado"} · ${installments.length} ${installments.length === 1 ? "cuota" : "cuotas"} · ${formatUSD(total)}`,
              { cuotas: installments.length, total },
            );
          }),
        },
      };
    }),

  updateInstallment: (tripId, enrolleeId, installmentId, patch) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const prev = e.installments.find((i) => i.id === installmentId);
            const next = e.installments.map((i) =>
              i.id === installmentId ? { ...i, ...patch } : i,
            );
            const updated = { ...e, installments: next };
            if (!prev) return updated;
            const idx = e.installments.findIndex((i) => i.id === installmentId) + 1;
            const changes: string[] = [];
            if (patch.amount !== undefined && patch.amount !== prev.amount) {
              changes.push(`monto ${formatUSD(prev.amount)} → ${formatUSD(patch.amount)}`);
            }
            if (patch.dueDate !== undefined && patch.dueDate !== prev.dueDate) {
              changes.push(`vence ${prev.dueDate} → ${patch.dueDate}`);
            }
            if (changes.length === 0) return updated;
            return appendAudit(
              updated,
              "cuota_editada",
              `Cuota ${idx} editada · ${changes.join(", ")}`,
            );
          }),
        },
      };
    }),

  toggleInstallmentPaid: (tripId, enrolleeId, installmentId) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const idx = e.installments.findIndex((i) => i.id === installmentId);
            if (idx < 0) return e;
            const target = e.installments[idx];
            const wasFullyPaid = target.status === "pagado";
            const today = new Date().toISOString().slice(0, 10);
            const next = e.installments.map((i) => {
              if (i.id !== installmentId) return i;
              if (wasFullyPaid) {
                // Revertir cuota completa: limpia abonos y vuelve a pendiente
                return { ...i, status: "pendiente" as const, paidAt: undefined, payments: [] };
              }
              // Marcar pagada: registra un abono "saldo" si quedaba remanente
              const remaining = installmentRemaining(i);
              const payments = i.payments ?? [];
              const completedPayments =
                remaining > 0
                  ? [
                      ...payments,
                      {
                        id: generateId(),
                        amount: remaining,
                        paidAt: today,
                        method: "transferencia" as const,
                        notes: "Saldo · marcada como pagada",
                      },
                    ]
                  : payments;
              return {
                ...i,
                status: "pagado" as const,
                paidAt: today,
                payments: completedPayments,
              };
            });
            return appendAudit(
              { ...e, installments: next },
              wasFullyPaid ? "cuota_revertida" : "cuota_pagada",
              wasFullyPaid
                ? `Cuota ${idx + 1} marcada como pendiente · ${formatUSD(target.amount)}`
                : `Cuota ${idx + 1} pagada · ${formatUSD(target.amount)}`,
            );
          }),
        },
      };
    }),

  addInstallmentPayment: (tripId, enrolleeId, installmentId, payment) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const startIdx = e.installments.findIndex((i) => i.id === installmentId);
            if (startIdx < 0) return e;
            if (payment.amount <= 0) return e;

            const round2 = (n: number) => Math.round(n * 100) / 100;
            const next = [...e.installments];
            const target = next[startIdx];
            if (target.status === "pagado") return e;

            // ─── 1) Cerrar la cuota objetivo al monto realmente pagado ───
            // Cualquier abono cierra la cuota: el `amount` se BUMPEA (o REDUCE)
            // al monto realmente pagado y queda en status="pagado".
            // El delta (positivo o negativo) se redistribuye en el paso 2.
            const targetPrevPaid = (target.payments ?? []).reduce((s, p) => s + p.amount, 0);
            const { feeAmount, netAmount } = computePaymentNet(
              payment.amount,
              payment.method,
              payment.feePercent,
              payment.feeFixed,
            );
            const supportsFee = methodSupportsFee(payment.method);
            const newPayments = [
              ...(target.payments ?? []),
              {
                id: generateId(),
                amount: round2(payment.amount),
                paidAt: payment.paidAt,
                notes: payment.notes,
                method: payment.method,
                feePercent: supportsFee ? payment.feePercent : undefined,
                feeFixed: supportsFee ? payment.feeFixed : undefined,
                feeDescription: payment.feeDescription?.trim()
                  ? payment.feeDescription.trim()
                  : undefined,
                feeAmount: feeAmount > 0 ? feeAmount : undefined,
                netAmount: feeAmount > 0 ? netAmount : undefined,
              },
            ];
            const newTotalPaid = round2(targetPrevPaid + payment.amount);
            const oldAmount = target.amount;
            const originalAmount = target.originalAmount ?? oldAmount;
            const newTargetAmount = newTotalPaid;
            const delta = round2(newTargetAmount - oldAmount);

            next[startIdx] = {
              ...target,
              amount: newTargetAmount,
              originalAmount: newTargetAmount !== originalAmount ? originalAmount : undefined,
              payments: newPayments,
              status: "pagado",
              paidAt: payment.paidAt,
            };

            // ─── 2a) Excedente (delta > 0): reducir última pendiente ───
            const adjustments: { idx: number; before: number; after: number; removed: boolean }[] =
              [];
            let surplus = delta > 0 ? delta : 0;
            while (surplus > 0.005) {
              let lastIdx = -1;
              for (let i = next.length - 1; i >= 0; i--) {
                if (i === startIdx) continue;
                const inst = next[i];
                if (inst.status !== "pendiente") continue;
                if ((inst.payments?.length ?? 0) > 0) continue;
                if (inst.amount <= 0) continue;
                lastIdx = i;
                break;
              }
              if (lastIdx < 0) break;

              const inst = next[lastIdx];
              const reduceBy = round2(Math.min(surplus, inst.amount));
              const newAmount = round2(inst.amount - reduceBy);

              if (newAmount <= 0.005) {
                adjustments.push({
                  idx: lastIdx + 1,
                  before: inst.amount,
                  after: 0,
                  removed: true,
                });
                next.splice(lastIdx, 1);
              } else {
                next[lastIdx] = {
                  ...inst,
                  amount: newAmount,
                  originalAmount: inst.originalAmount ?? inst.amount,
                };
                adjustments.push({
                  idx: lastIdx + 1,
                  before: inst.amount,
                  after: newAmount,
                  removed: false,
                });
              }
              surplus = round2(surplus - reduceBy);
            }

            // ─── 2b) Faltante (delta < 0): trasladar a última pendiente ───
            let shortfall = delta < 0 ? round2(-delta) : 0;
            let unassignedDelta = 0;
            if (shortfall > 0.005) {
              // Solo trasladar a una pendiente POSTERIOR a la cuota actual.
              // Si la cuota actual es la última pendiente (o no hay pendientes
              // después), el faltante queda como saldo sin asignar.
              let lastIdx = -1;
              for (let i = next.length - 1; i > startIdx; i--) {
                const inst = next[i];
                if (inst.status !== "pendiente") continue;
                lastIdx = i;
                break;
              }
              if (lastIdx >= 0) {
                const inst = next[lastIdx];
                const before = inst.amount;
                const after = round2(before + shortfall);
                next[lastIdx] = {
                  ...inst,
                  amount: after,
                  originalAmount: inst.originalAmount ?? before,
                };
                adjustments.push({ idx: lastIdx + 1, before, after, removed: false });
                shortfall = 0;
              } else {
                unassignedDelta = shortfall;
                shortfall = 0;
              }
            }

            // ─── 3) Sobrepago no asignado / faltante sin cuota ───
            const newOverpayment =
              surplus > 0.005 ? round2((e.overpayment ?? 0) + surplus) : e.overpayment;
            const newUnassignedBalance =
              unassignedDelta > 0.005
                ? round2((e.unassignedBalance ?? 0) + unassignedDelta)
                : e.unassignedBalance;

            // ─── 4) Audit log ───
            // Si el sobrepago crece, re-emitir el aviso (limpiar acknowledged).
            const overpaymentGrew = surplus > 0.005;
            let updatedEnrollee: Enrollee = {
              ...e,
              installments: next,
              overpayment: newOverpayment,
              overpaymentAcknowledged: overpaymentGrew ? false : e.overpaymentAcknowledged,
              unassignedBalance: newUnassignedBalance,
            };

            const methodLabel = payment.method
              ? PAYMENT_METHOD_LABELS[payment.method]
              : "Transferencia";
            const methodPart =
              feeAmount > 0
                ? `${methodLabel} (comisión ${formatUSD(feeAmount)} → neto ${formatUSD(netAmount)})`
                : methodLabel;
            const parts: string[] = [
              `Cuota ${startIdx + 1} · abono ${formatUSD(payment.amount)} · ${methodPart} · cerrada en ${formatUSD(newTargetAmount)}`,
            ];
            if (delta !== 0) {
              parts.push(
                delta > 0
                  ? `monto subió ${formatUSD(oldAmount)} → ${formatUSD(newTargetAmount)}`
                  : `monto bajó ${formatUSD(oldAmount)} → ${formatUSD(newTargetAmount)}`,
              );
            }
            if (adjustments.length > 0) {
              const detail = adjustments
                .map((a) =>
                  a.removed
                    ? `cuota ${a.idx} eliminada (era ${formatUSD(a.before)})`
                    : `cuota ${a.idx}: ${formatUSD(a.before)} → ${formatUSD(a.after)}`,
                )
                .join(", ");
              parts.push(detail);
            }
            if (surplus > 0.005) {
              parts.push(`sobrepago ${formatUSD(surplus)} pendiente de asignar`);
            }
            if (unassignedDelta > 0.005) {
              parts.push(`faltante ${formatUSD(unassignedDelta)} sin cuota asignada`);
            }

            updatedEnrollee = appendAudit(updatedEnrollee, "cuota_pagada", parts.join(" · "), {
              abono: payment.amount,
              metodo: payment.method ?? "transferencia",
              comision: feeAmount > 0 ? feeAmount : 0,
              neto: feeAmount > 0 ? netAmount : payment.amount,
              cuotaOrigen: startIdx + 1,
              deltaMonto: delta,
              cuotasAjustadas: adjustments.length,
              sobrepago: surplus > 0.005 ? surplus : 0,
              faltanteSinAsignar: unassignedDelta > 0.005 ? unassignedDelta : 0,
            });

            return updatedEnrollee;
          }),
        },
      };
    }),

  resolveUnassignedBalance: (tripId, enrolleeId, action, payload) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const current = e.unassignedBalance ?? 0;
            if (current <= 0.005) return e;
            if (action === "dismiss") {
              return appendAudit(
                e,
                "nota_editada",
                `Saldo sin asignar conservado · ${formatUSD(current)}`,
              );
            }
            const amount = Math.max(0, Math.round((payload?.amount ?? current) * 100) / 100);
            if (amount <= 0) return e;
            const today = new Date().toISOString().slice(0, 10);
            const dueDate = payload?.dueDate ?? today;
            const newInst: Installment = {
              id: generateId(),
              dueDate,
              amount,
              status: "pendiente",
            };
            const remainingAfter = Math.max(0, Math.round((current - amount) * 100) / 100);
            const updated: Enrollee = {
              ...e,
              installments: [...e.installments, newInst],
              unassignedBalance: remainingAfter > 0.005 ? remainingAfter : undefined,
            };
            return appendAudit(
              updated,
              "plan_creado",
              `Cuota ${updated.installments.length} creada por faltante · ${formatUSD(amount)} · vence ${dueDate}`,
              { amount, dueDate, restanteSinAsignar: remainingAfter },
            );
          }),
        },
      };
    }),

  resolveOverpayment: (tripId, enrolleeId, action, notes) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const current = e.overpayment ?? 0;
            if (current <= 0.005) return e;
            if (action === "refunded") {
              const updated: Enrollee = {
                ...e,
                overpayment: undefined,
                overpaymentAcknowledged: undefined,
              };
              return appendAudit(
                updated,
                "sobrepago_devuelto",
                `Sobrepago ${formatUSD(current)} devuelto a la viajera${notes ? ` · ${notes}` : ""}`,
                { monto: current, nota: notes ?? null },
              );
            }
            // acknowledge: silenciar banner, conservar monto como crédito
            const updated: Enrollee = { ...e, overpaymentAcknowledged: true };
            return appendAudit(
              updated,
              "sobrepago_credito",
              `Sobrepago ${formatUSD(current)} dejado como crédito a favor${notes ? ` · ${notes}` : ""}`,
              { monto: current, nota: notes ?? null },
            );
          }),
        },
      };
    }),

  applyCreditToTrip: (
    sourceTripId,
    sourceEnrolleeId,
    destinationTripId,
    destinationEnrolleeId,
    amount,
    notes,
  ) => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const requested = round2(amount);
    if (requested <= 0.005) return false;
    const state = get();
    const src = state.trips[sourceTripId];
    const dst = state.trips[destinationTripId];
    if (!src || !dst) return false;
    const srcEnrollee = src.enrollees.find((e) => e.id === sourceEnrolleeId);
    const dstEnrollee = dst.enrollees.find((e) => e.id === destinationEnrolleeId);
    if (!srcEnrollee || !dstEnrollee) return false;
    const available = srcEnrollee.overpayment ?? 0;
    if (available <= 0.005 || requested > available + 0.005) return false;
    const applied = round2(Math.min(requested, available));

    // ── Origen: descontar overpayment ──
    const remainingOver = round2(available - applied);
    const updatedSrc: Enrollee = {
      ...srcEnrollee,
      overpayment: remainingOver > 0.005 ? remainingOver : undefined,
      overpaymentAcknowledged:
        remainingOver > 0.005 ? srcEnrollee.overpaymentAcknowledged : undefined,
    };
    const auditedSrc = appendAudit(
      updatedSrc,
      "credito_aplicado",
      `Crédito ${formatUSD(applied)} aplicado a ${dstEnrollee.name} (${dst.name})${notes ? ` · ${notes}` : ""}`,
      {
        monto: applied,
        destino_viaje: dst.name,
        destino_viajera: dstEnrollee.name,
        saldo_credito_restante: remainingOver,
        nota: notes ?? null,
      },
    );

    // ── Destino: descontar totalDue + rebalancear cuotas pendientes ──
    const newTotalDue = round2(Math.max(0, dstEnrollee.totalDue - applied));
    const rebalanced = rebalanceInstallments(dstEnrollee.installments, newTotalDue);
    const credit: AppliedCredit = {
      id: generateId(),
      amount: applied,
      sourceTripId,
      sourceTripName: src.name,
      sourceEnrolleeId,
      sourceEnrolleeName: srcEnrollee.name,
      appliedAt: new Date().toISOString(),
      notes,
    };
    const updatedDst: Enrollee = {
      ...dstEnrollee,
      totalDue: newTotalDue,
      installments: rebalanced,
      appliedCredits: [...(dstEnrollee.appliedCredits ?? []), credit],
    };
    const auditedDst = appendAudit(
      updatedDst,
      "credito_recibido",
      `Crédito ${formatUSD(applied)} recibido desde ${srcEnrollee.name} (${src.name}) · totalDue ${formatUSD(dstEnrollee.totalDue)} → ${formatUSD(newTotalDue)}`,
      {
        monto: applied,
        origen_viaje: src.name,
        origen_viajera: srcEnrollee.name,
        total_anterior: dstEnrollee.totalDue,
        total_nuevo: newTotalDue,
        nota: notes ?? null,
      },
    );

    if (sourceTripId === destinationTripId) {
      set({
        trips: {
          ...state.trips,
          [sourceTripId]: {
            ...src,
            enrollees: src.enrollees.map((e) => {
              if (e.id === sourceEnrolleeId) return auditedSrc;
              if (e.id === destinationEnrolleeId) return auditedDst;
              return e;
            }),
          },
        },
      });
    } else {
      set({
        trips: {
          ...state.trips,
          [sourceTripId]: {
            ...src,
            enrollees: src.enrollees.map((e) => (e.id === sourceEnrolleeId ? auditedSrc : e)),
          },
          [destinationTripId]: {
            ...dst,
            enrollees: dst.enrollees.map((e) => (e.id === destinationEnrolleeId ? auditedDst : e)),
          },
        },
      });
    }
    return true;
  },

  reserveCreditForFuture: (tripId, enrolleeId, amount, notes) => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const requested = round2(amount);
    if (requested <= 0.005) return false;
    const state = get();
    const trip = state.trips[tripId];
    if (!trip) return false;
    const enrollee = trip.enrollees.find((e) => e.id === enrolleeId);
    if (!enrollee) return false;
    const available = enrollee.overpayment ?? 0;
    if (available <= 0.005 || requested > available + 0.005) return false;
    const applied = round2(Math.min(requested, available));
    const remainingOver = round2(available - applied);
    const prevReserved = enrollee.reservedCreditForFutureTrip?.amount ?? 0;
    const newReservedAmount = round2(prevReserved + applied);

    const updated: Enrollee = {
      ...enrollee,
      overpayment: remainingOver > 0.005 ? remainingOver : undefined,
      overpaymentAcknowledged: remainingOver > 0.005 ? enrollee.overpaymentAcknowledged : undefined,
      reservedCreditForFutureTrip: {
        amount: newReservedAmount,
        reservedAt: new Date().toISOString(),
      },
    };
    const audited = appendAudit(
      updated,
      "credito_reservado",
      `Crédito ${formatUSD(applied)} reservado para próximo viaje${notes ? ` · ${notes}` : ""}`,
      {
        monto: applied,
        total_reservado: newReservedAmount,
        nota: notes ?? null,
      },
    );
    set({
      trips: {
        ...state.trips,
        [tripId]: mapEnrollee(trip, enrolleeId, () => audited),
      },
    });
    return true;
  },

  revertAppliedCredit: (destinationTripId, destinationEnrolleeId, appliedCreditId, notes) => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const state = get();
    const dst = state.trips[destinationTripId];
    if (!dst) return false;
    const dstEnrollee = dst.enrollees.find((e) => e.id === destinationEnrolleeId);
    if (!dstEnrollee) return false;
    const credit = (dstEnrollee.appliedCredits ?? []).find((c) => c.id === appliedCreditId);
    if (!credit) return false;
    const amount = round2(credit.amount);
    if (amount <= 0.005) return false;

    // ── Destino: aumentar totalDue, rebalancear cuotas, quitar credit ──
    const newTotalDue = round2(dstEnrollee.totalDue + amount);
    const rebalanced = rebalanceInstallments(dstEnrollee.installments, newTotalDue);
    const remainingCredits = (dstEnrollee.appliedCredits ?? []).filter(
      (c) => c.id !== appliedCreditId,
    );
    const updatedDst: Enrollee = {
      ...dstEnrollee,
      totalDue: newTotalDue,
      installments: rebalanced,
      appliedCredits: remainingCredits.length > 0 ? remainingCredits : undefined,
    };
    const auditedDst = appendAudit(
      updatedDst,
      "credito_revertido",
      `Crédito ${formatUSD(amount)} revertido (origen: ${credit.sourceEnrolleeName} · ${credit.sourceTripName}) · totalDue ${formatUSD(dstEnrollee.totalDue)} → ${formatUSD(newTotalDue)}${notes ? ` · ${notes}` : ""}`,
      {
        monto: amount,
        origen_viaje: credit.sourceTripName,
        origen_viajera: credit.sourceEnrolleeName,
        total_anterior: dstEnrollee.totalDue,
        total_nuevo: newTotalDue,
        nota: notes ?? null,
      },
    );

    // ── Origen: devolver al overpayment + acknowledged ──
    const src = state.trips[credit.sourceTripId];
    const srcEnrollee = src?.enrollees.find((e) => e.id === credit.sourceEnrolleeId);
    let updatedSrc: Enrollee | null = null;
    if (srcEnrollee) {
      const prevOver = srcEnrollee.overpayment ?? 0;
      const newOver = round2(prevOver + amount);
      const restored: Enrollee = {
        ...srcEnrollee,
        overpayment: newOver,
        overpaymentAcknowledged: true,
      };
      updatedSrc = appendAudit(
        restored,
        "credito_revertido",
        `Crédito ${formatUSD(amount)} devuelto desde ${dstEnrollee.name} (${dst.name})${notes ? ` · ${notes}` : ""}`,
        {
          monto: amount,
          destino_viaje: dst.name,
          destino_viajera: dstEnrollee.name,
          saldo_credito_nuevo: newOver,
          nota: notes ?? null,
        },
      );
    }

    if (src && updatedSrc && credit.sourceTripId === destinationTripId) {
      set({
        trips: {
          ...state.trips,
          [destinationTripId]: {
            ...dst,
            enrollees: dst.enrollees.map((e) => {
              if (e.id === destinationEnrolleeId) return auditedDst;
              if (e.id === credit.sourceEnrolleeId) return updatedSrc!;
              return e;
            }),
          },
        },
      });
    } else {
      const next: Record<string, TripData> = {
        ...state.trips,
        [destinationTripId]: {
          ...dst,
          enrollees: dst.enrollees.map((e) => (e.id === destinationEnrolleeId ? auditedDst : e)),
        },
      };
      if (src && updatedSrc) {
        next[credit.sourceTripId] = {
          ...src,
          enrollees: src.enrollees.map((e) => (e.id === credit.sourceEnrolleeId ? updatedSrc! : e)),
        };
      }
      set({ trips: next });
    }
    return true;
  },

  removeInstallmentPayment: (tripId, enrolleeId, installmentId, paymentId) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const idx = e.installments.findIndex((i) => i.id === installmentId);
            if (idx < 0) return e;
            const target = e.installments[idx];
            const payments = target.payments ?? [];
            const removed = payments.find((p) => p.id === paymentId);
            if (!removed) return e;

            // 1) Quitar el abono de la cuota origen.
            const newPayments = payments.filter((p) => p.id !== paymentId);
            const newPaid = newPayments.reduce((s, p) => s + p.amount, 0);
            const completes = newPaid + 0.005 >= target.amount;
            const lastPayment = newPayments
              .slice()
              .sort((a, b) => a.paidAt.localeCompare(b.paidAt))[newPayments.length - 1];
            const updatedTarget: Installment = {
              ...target,
              payments: newPayments,
              status: newPayments.length === 0 ? "pendiente" : completes ? "pagado" : "parcial",
              paidAt: completes && lastPayment ? lastPayment.paidAt : undefined,
            };

            // 2) Revertir reducciones originadas desde este abono → restaurar amount.
            const restoredIdxs: number[] = [];
            const next = e.installments.map((inst, i) => {
              if (i === idx) return updatedTarget;
              const reductions = inst.reductions ?? [];
              const matching = reductions.filter((r) => r.fromPaymentId === paymentId);
              if (matching.length === 0) return inst;
              const remainingReductions = reductions.filter((r) => r.fromPaymentId !== paymentId);
              const restoredAmount = matching.reduce((s, r) => s + r.amount, 0);
              const newAmount = Math.round((inst.amount + restoredAmount) * 100) / 100;
              const keepOriginal = remainingReductions.length > 0;
              const hadPayments = (inst.payments?.length ?? 0) > 0;
              restoredIdxs.push(i + 1);
              return {
                ...inst,
                amount: newAmount,
                originalAmount: keepOriginal ? inst.originalAmount : undefined,
                reductions: keepOriginal ? remainingReductions : undefined,
                status: !hadPayments && newAmount > 0.005 ? "pendiente" : inst.status,
                paidAt: !hadPayments && newAmount > 0.005 ? undefined : inst.paidAt,
              };
            });

            const removedMethodLabel = removed.method
              ? PAYMENT_METHOD_LABELS[removed.method]
              : "Transferencia";
            const removedFee = removed.feeAmount ?? 0;
            const removedSuffix =
              removedFee > 0
                ? ` (${removedMethodLabel}, comisión ${formatUSD(removedFee)} revertida)`
                : ` (${removedMethodLabel})`;
            const summary =
              restoredIdxs.length > 0
                ? `Cuota ${idx + 1} · abono ${formatUSD(removed.amount)}${removedSuffix} eliminado · monto restaurado en cuota${restoredIdxs.length > 1 ? "s" : ""} ${restoredIdxs.join(", ")}`
                : `Cuota ${idx + 1} · abono ${formatUSD(removed.amount)}${removedSuffix} eliminado (${removed.paidAt})`;

            return appendAudit({ ...e, installments: next }, "abono_revertido", summary, {
              abono: removed.amount,
              metodo: removed.method ?? "transferencia",
              comisionRevertida: removedFee,
              fecha: removed.paidAt,
              cuotasRestauradas: restoredIdxs.length,
            });
          }),
        },
      };
    }),

  updateInstallmentPayment: (tripId, enrolleeId, installmentId, paymentId, patch) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const round2 = (n: number) => Math.round(n * 100) / 100;
            const startIdx = e.installments.findIndex((i) => i.id === installmentId);
            if (startIdx < 0) return e;
            const next = [...e.installments];
            const target = next[startIdx];
            const payments = target.payments ?? [];
            const current = payments.find((p) => p.id === paymentId);
            if (!current) return e;

            // ─── 1) Resolver nuevos campos del abono ───
            const newMethod = patch.method ?? current.method ?? "transferencia";
            const supportsFee = methodSupportsFee(newMethod);
            const newPercent = supportsFee
              ? (patch.feePercent ?? current.feePercent ?? 0)
              : undefined;
            const newFixed = supportsFee ? (patch.feeFixed ?? current.feeFixed ?? 0) : undefined;
            const newDescription =
              patch.feeDescription !== undefined
                ? patch.feeDescription.trim() || undefined
                : current.feeDescription;
            const newPaidAt = patch.paidAt ?? current.paidAt;
            const newNotes = patch.notes !== undefined ? patch.notes : current.notes;

            // Monto: si llega y es válido (> 0), aplicar; si no, mantener.
            const requestedAmount =
              typeof patch.amount === "number" && patch.amount > 0
                ? round2(patch.amount)
                : current.amount;
            const amountDelta = round2(requestedAmount - current.amount);

            const { feeAmount, netAmount } = computePaymentNet(
              requestedAmount,
              newMethod,
              newPercent,
              newFixed,
            );

            const updatedPayment = {
              ...current,
              amount: requestedAmount,
              method: newMethod,
              feePercent: newPercent,
              feeFixed: newFixed,
              feeDescription: newDescription,
              feeAmount: feeAmount > 0 ? feeAmount : undefined,
              netAmount: feeAmount > 0 ? netAmount : undefined,
              paidAt: newPaidAt,
              notes: newNotes || undefined,
            };

            const newPayments = payments.map((p) => (p.id === paymentId ? updatedPayment : p));

            // ─── 2) Si el monto NO cambió, comportamiento original ───
            if (Math.abs(amountDelta) <= 0.005) {
              const sorted = [...newPayments].sort((a, b) => a.paidAt.localeCompare(b.paidAt));
              const lastPaidAt =
                target.status === "pagado" && sorted.length > 0
                  ? sorted[sorted.length - 1].paidAt
                  : target.paidAt;
              next[startIdx] = { ...target, payments: newPayments, paidAt: lastPaidAt };

              const oldMethodLabel = current.method
                ? PAYMENT_METHOD_LABELS[current.method]
                : "Transferencia";
              const newMethodLabel = PAYMENT_METHOD_LABELS[newMethod];
              const methodChanged = (current.method ?? "transferencia") !== newMethod;
              const feeChanged = (current.feeAmount ?? 0) !== feeAmount;
              const summaryParts: string[] = [
                `Cuota ${startIdx + 1} · abono ${formatUSD(current.amount)} editado`,
              ];
              if (methodChanged) summaryParts.push(`método ${oldMethodLabel} → ${newMethodLabel}`);
              if (feeChanged) {
                summaryParts.push(
                  feeAmount > 0
                    ? `comisión ${formatUSD(feeAmount)} → neto ${formatUSD(netAmount)}`
                    : `sin comisión · neto ${formatUSD(current.amount)}`,
                );
              }
              if (!methodChanged && !feeChanged) summaryParts.push("datos actualizados");

              return appendAudit(
                { ...e, installments: next },
                "abono_registrado",
                summaryParts.join(" · "),
                {
                  abono: current.amount,
                  metodo: newMethod,
                  comision: feeAmount,
                  neto: feeAmount > 0 ? netAmount : current.amount,
                },
              );
            }

            // ─── 3) Cambio de monto: redistribuir delta (mismo algoritmo que addInstallmentPayment) ───
            const newTotalPaid = round2(newPayments.reduce((s, p) => s + p.amount, 0));
            const oldAmount = target.amount;
            const originalAmount = target.originalAmount ?? oldAmount;
            const newTargetAmount = newTotalPaid;
            const targetDelta = round2(newTargetAmount - oldAmount);

            // Recalcular status del target en función del nuevo total.
            const newStatus: InstallmentStatus =
              newTotalPaid <= 0.005
                ? "pendiente"
                : newTotalPaid + 0.005 >= newTargetAmount
                  ? "pagado"
                  : "parcial";

            next[startIdx] = {
              ...target,
              amount: newTargetAmount,
              originalAmount: newTargetAmount !== originalAmount ? originalAmount : undefined,
              payments: newPayments,
              status: newStatus,
              paidAt: newStatus === "pagado" ? newPaidAt : undefined,
            };

            // 3a) Excedente (delta > 0): reducir/eliminar pendientes posteriores
            const adjustments: { idx: number; before: number; after: number; removed: boolean }[] =
              [];
            let surplus = targetDelta > 0 ? targetDelta : 0;
            while (surplus > 0.005) {
              let lastIdx = -1;
              for (let i = next.length - 1; i >= 0; i--) {
                if (i === startIdx) continue;
                const inst = next[i];
                if (inst.status !== "pendiente") continue;
                if ((inst.payments?.length ?? 0) > 0) continue;
                if (inst.amount <= 0) continue;
                lastIdx = i;
                break;
              }
              if (lastIdx < 0) break;

              const inst = next[lastIdx];
              const reduceBy = round2(Math.min(surplus, inst.amount));
              const newAmount = round2(inst.amount - reduceBy);

              if (newAmount <= 0.005) {
                adjustments.push({
                  idx: lastIdx + 1,
                  before: inst.amount,
                  after: 0,
                  removed: true,
                });
                next.splice(lastIdx, 1);
              } else {
                next[lastIdx] = {
                  ...inst,
                  amount: newAmount,
                  originalAmount: inst.originalAmount ?? inst.amount,
                };
                adjustments.push({
                  idx: lastIdx + 1,
                  before: inst.amount,
                  after: newAmount,
                  removed: false,
                });
              }
              surplus = round2(surplus - reduceBy);
            }

            // 3b) Faltante (delta < 0): bumpear última pendiente posterior
            let shortfall = targetDelta < 0 ? round2(-targetDelta) : 0;
            let unassignedDelta = 0;
            if (shortfall > 0.005) {
              // Buscar pendiente para absorber. Idealmente posterior al startIdx;
              // si no hay, intentar ANTERIOR pendiente (caso edge cuando el target
              // es la última cuota); si tampoco, queda como saldo sin asignar.
              let pickIdx = -1;
              for (let i = next.length - 1; i > startIdx; i--) {
                if (next[i].status !== "pendiente") continue;
                pickIdx = i;
                break;
              }
              if (pickIdx < 0) {
                for (let i = next.length - 1; i >= 0; i--) {
                  if (i === startIdx) continue;
                  const inst = next[i];
                  if (inst.status !== "pendiente") continue;
                  if ((inst.payments?.length ?? 0) > 0) continue;
                  pickIdx = i;
                  break;
                }
              }
              if (pickIdx >= 0) {
                const inst = next[pickIdx];
                const before = inst.amount;
                const after = round2(before + shortfall);
                next[pickIdx] = {
                  ...inst,
                  amount: after,
                  originalAmount: inst.originalAmount ?? before,
                };
                adjustments.push({ idx: pickIdx + 1, before, after, removed: false });
                shortfall = 0;
              } else {
                unassignedDelta = shortfall;
                shortfall = 0;
              }
            }

            // 3c) Sobrepago / saldo sin asignar
            const newOverpayment =
              surplus > 0.005 ? round2((e.overpayment ?? 0) + surplus) : e.overpayment;
            const newUnassignedBalance =
              unassignedDelta > 0.005
                ? round2((e.unassignedBalance ?? 0) + unassignedDelta)
                : e.unassignedBalance;
            const overpaymentGrew = surplus > 0.005;

            let updatedEnrollee: Enrollee = {
              ...e,
              installments: next,
              overpayment: newOverpayment,
              overpaymentAcknowledged: overpaymentGrew ? false : e.overpaymentAcknowledged,
              unassignedBalance: newUnassignedBalance,
            };

            // 3d) Audit
            const methodLabel = PAYMENT_METHOD_LABELS[newMethod];
            const methodPart =
              feeAmount > 0
                ? `${methodLabel} (comisión ${formatUSD(feeAmount)} → neto ${formatUSD(netAmount)})`
                : methodLabel;
            const parts: string[] = [
              `Cuota ${startIdx + 1} · abono editado ${formatUSD(current.amount)} → ${formatUSD(requestedAmount)} · ${methodPart}`,
            ];
            if (targetDelta !== 0) {
              parts.push(
                targetDelta > 0
                  ? `cuota subió ${formatUSD(oldAmount)} → ${formatUSD(newTargetAmount)}`
                  : `cuota bajó ${formatUSD(oldAmount)} → ${formatUSD(newTargetAmount)}`,
              );
            }
            if (adjustments.length > 0) {
              const detail = adjustments
                .map((a) =>
                  a.removed
                    ? `cuota ${a.idx} eliminada (era ${formatUSD(a.before)})`
                    : `cuota ${a.idx}: ${formatUSD(a.before)} → ${formatUSD(a.after)}`,
                )
                .join(", ");
              parts.push(detail);
            }
            if (surplus > 0.005) {
              parts.push(`sobrepago ${formatUSD(surplus)} pendiente de asignar`);
            }
            if (unassignedDelta > 0.005) {
              parts.push(`faltante ${formatUSD(unassignedDelta)} sin cuota asignada`);
            }

            updatedEnrollee = appendAudit(updatedEnrollee, "abono_registrado", parts.join(" · "), {
              abonoAnterior: current.amount,
              abonoNuevo: requestedAmount,
              metodo: newMethod,
              comision: feeAmount,
              neto: feeAmount > 0 ? netAmount : requestedAmount,
              cuotaOrigen: startIdx + 1,
            });

            return updatedEnrollee;
          }),
        },
      };
    }),

  attachOrphanPaidMethod: (tripId, enrolleeId, installmentId, payment) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const idx = e.installments.findIndex((i) => i.id === installmentId);
            if (idx < 0) return e;
            const target = e.installments[idx];
            if (target.status !== "pagado") return e;
            if ((target.payments?.length ?? 0) > 0) return e;
            if (target.amount <= 0) return e;

            const round2 = (n: number) => Math.round(n * 100) / 100;
            const method = payment.method ?? "transferencia";
            const supportsFee = methodSupportsFee(method);
            const { feeAmount, netAmount } = computePaymentNet(
              target.amount,
              method,
              payment.feePercent,
              payment.feeFixed,
            );
            const newPayment = {
              id: generateId(),
              amount: round2(target.amount),
              paidAt: payment.paidAt,
              notes: payment.notes,
              method,
              feePercent: supportsFee ? payment.feePercent : undefined,
              feeFixed: supportsFee ? payment.feeFixed : undefined,
              feeDescription: payment.feeDescription?.trim()
                ? payment.feeDescription.trim()
                : undefined,
              feeAmount: feeAmount > 0 ? feeAmount : undefined,
              netAmount: feeAmount > 0 ? netAmount : undefined,
            };

            const next = e.installments.map((inst, i) =>
              i === idx ? { ...inst, payments: [newPayment], paidAt: payment.paidAt } : inst,
            );

            const methodLabel = PAYMENT_METHOD_LABELS[method];
            const summary =
              feeAmount > 0
                ? `Cuota ${idx + 1} · método asignado: ${methodLabel} (comisión ${formatUSD(feeAmount)} → neto ${formatUSD(netAmount)})`
                : `Cuota ${idx + 1} · método asignado: ${methodLabel}`;

            return appendAudit({ ...e, installments: next }, "abono_registrado", summary, {
              abono: target.amount,
              metodo: method,
              comision: feeAmount,
              neto: feeAmount > 0 ? netAmount : target.amount,
            });
          }),
        },
      };
    }),

  setDiscount: (tripId, enrolleeId, discount) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const basePrice = e.basePrice ?? trip.pricePerPerson ?? e.totalDue ?? 0;
            const newDiscount = discount;
            const finalPrice = computeFinalPrice(basePrice, newDiscount);
            const newTotal = computeParticipationPrice(finalPrice, e.participation);
            const newInstallments = rebalanceInstallments(e.installments ?? [], newTotal);
            const had = !!e.discount;
            const action: AuditAction = !discount
              ? "descuento_removido"
              : had
                ? "descuento_editado"
                : "descuento_aplicado";
            const summary = !discount
              ? `Descuento removido · nuevo total ${formatUSD(newTotal)}`
              : `${had ? "Descuento editado" : "Descuento aplicado"} · ${
                  discount.mode === "percent" ? `${discount.value}%` : formatUSD(discount.value)
                } · nuevo total ${formatUSD(newTotal)}`;
            return appendAudit(
              {
                ...e,
                basePrice,
                discount: newDiscount,
                totalDue: newTotal,
                installments: newInstallments,
              },
              action,
              summary,
              { total: newTotal },
            );
          }),
        },
      };
    }),

  setRefundRules: (tripId, rules) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return { trips: { ...state.trips, [tripId]: { ...trip, refundRules: rules } } };
    }),

  cancelEnrollee: (tripId, enrolleeId, cancellation) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) =>
            appendAudit(
              { ...e, status: "cancelada", cancellation },
              "cancelacion",
              `Cancelación · devuelto ${formatUSD(cancellation.refundedAmount)} · retenido ${formatUSD(cancellation.retainedAmount)}`,
              {
                sugerido: cancellation.suggestedRefund,
                devuelto: cancellation.refundedAmount,
                retenido: cancellation.retainedAmount,
              },
            ),
          ),
        },
      };
    }),

  reactivateEnrollee: (tripId, enrolleeId) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) =>
            appendAudit(
              { ...e, status: "activa", cancellation: null },
              "reactivacion",
              "Reactivación de la inscripción",
            ),
          ),
        },
      };
    }),

  setParticipation: (tripId, enrolleeId, participation) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const basePrice = e.basePrice ?? trip.pricePerPerson ?? e.totalDue ?? 0;
            const finalPrice = computeFinalPrice(basePrice, e.discount);
            const newTotal = computeParticipationPrice(finalPrice, participation);
            const newInstallments = rebalanceInstallments(e.installments ?? [], newTotal);
            const had = e.participation?.mode === "parcial";
            const action: AuditAction =
              !participation || participation.mode === "completa"
                ? "participacion_removida"
                : had
                  ? "participacion_editada"
                  : "participacion_aplicada";
            let detail = "";
            if (participation?.mode === "parcial") {
              if (participation.kind === "dias") {
                detail = `${participation.daysIncluded}/${participation.totalDays} días`;
              } else if (participation.kind === "tramo") {
                detail = participation.segmentLabel ?? "tramo";
              }
              if (participation.manualPrice !== undefined) {
                detail += ` · precio manual ${formatUSD(participation.manualPrice)}`;
              }
            }
            const summary =
              action === "participacion_removida"
                ? `Participación completa · total ${formatUSD(newTotal)}`
                : `${had ? "Participación editada" : "Participación parcial aplicada"} · ${detail} · total ${formatUSD(newTotal)}`;
            return appendAudit(
              {
                ...e,
                participation,
                basePrice,
                totalDue: newTotal,
                installments: newInstallments,
              },
              action,
              summary,
              { total: newTotal },
            );
          }),
        },
      };
    }),

  suggestRefund: (tripId, enrolleeId, cancelledAt) => {
    const trip = get().trips[tripId];
    if (!trip) return { amount: 0, percent: 0 };
    const e = trip.enrollees.find((x: Enrollee) => x.id === enrolleeId);
    if (!e) return { amount: 0, percent: 0 };
    const paid = (e.installments ?? []).reduce(
      (s: number, i: Installment) => s + installmentPaidAmount(i),
      0,
    );
    return computeSuggestedRefund(paid, cancelledAt, trip.startDate ?? "", trip.refundRules);
  },

  addEnrollee: (tripId, data) => {
    const state = get();
    const trip = state.trips[tripId];
    if (!trip) return null;
    const id = generateId();
    const total = trip.pricePerPerson;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // ─── Detectar crédito reservado por email en otros viajes ───
    // Buscamos cualquier inscripción previa (otro viaje) con el mismo email
    // y `reservedCreditForFutureTrip` activo. Sumamos todos los disponibles
    // (pueden venir de varios viajes) y los aplicamos automáticamente.
    const normalizedEmail = data.email.trim().toLowerCase();
    type ReservedSource = {
      tripId: string;
      tripName: string;
      enrolleeId: string;
      enrolleeName: string;
      amount: number;
    };
    const reservedSources: ReservedSource[] = [];
    if (normalizedEmail) {
      for (const t of Object.values(state.trips)) {
        for (const e of t.enrollees) {
          if (e.email.trim().toLowerCase() !== normalizedEmail) continue;
          const reserved = e.reservedCreditForFutureTrip?.amount ?? 0;
          if (reserved > 0.005) {
            reservedSources.push({
              tripId: t.id,
              tripName: t.name,
              enrolleeId: e.id,
              enrolleeName: e.name,
              amount: round2(reserved),
            });
          }
        }
      }
    }
    const totalReserved = round2(reservedSources.reduce((s, r) => s + r.amount, 0));
    // El crédito no puede dejar el total en negativo.
    const creditApplied = round2(Math.min(totalReserved, total));
    const newTotalDue = round2(total - creditApplied);

    const auditEntries: AuditEntry[] = [
      {
        id: generateId(),
        at: new Date().toISOString(),
        action: "inscripcion",
        summary: `Inscripción manual registrada · ${formatUSD(total)}`,
        details: { total },
      },
    ];
    const appliedCredits: AppliedCredit[] = [];
    if (creditApplied > 0.005) {
      // Distribuimos el crédito aplicado entre las fuentes en orden, hasta agotar.
      let remaining = creditApplied;
      for (const src of reservedSources) {
        if (remaining <= 0.005) break;
        const take = round2(Math.min(src.amount, remaining));
        appliedCredits.push({
          id: generateId(),
          amount: take,
          sourceTripId: src.tripId,
          sourceTripName: src.tripName,
          sourceEnrolleeId: src.enrolleeId,
          sourceEnrolleeName: src.enrolleeName,
          appliedAt: new Date().toISOString(),
          notes: "Crédito reservado aplicado automáticamente al inscribirse",
        });
        remaining = round2(remaining - take);
      }
      auditEntries.push({
        id: generateId(),
        at: new Date().toISOString(),
        action: "credito_recibido",
        summary: `Crédito reservado ${formatUSD(creditApplied)} aplicado automáticamente · totalDue ${formatUSD(total)} → ${formatUSD(newTotalDue)}`,
        details: {
          monto: creditApplied,
          total_anterior: total,
          total_nuevo: newTotalDue,
          fuentes: appliedCredits.length,
        },
      });
    }

    const newEnrollee: Enrollee = {
      id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      enrolledAt: data.enrolledAt,
      basePrice: total,
      discount: null,
      totalDue: newTotalDue,
      installments: [],
      status: "activa",
      appliedCredits: appliedCredits.length > 0 ? appliedCredits : undefined,
      auditLog: auditEntries,
    };

    // Construir el nuevo state: agregar enrollee y limpiar/decrementar
    // los reservedCreditForFutureTrip de las fuentes consumidas.
    const consumedByEnrollee = new Map<string, number>();
    let remainingToConsume = creditApplied;
    for (const src of reservedSources) {
      if (remainingToConsume <= 0.005) break;
      const take = round2(Math.min(src.amount, remainingToConsume));
      consumedByEnrollee.set(`${src.tripId}::${src.enrolleeId}`, take);
      remainingToConsume = round2(remainingToConsume - take);
    }

    const newTrips = { ...state.trips };
    for (const t of Object.values(state.trips)) {
      let mutated = false;
      const newEnrollees = t.enrollees.map((e) => {
        const key = `${t.id}::${e.id}`;
        const consumed = consumedByEnrollee.get(key);
        if (!consumed) return e;
        mutated = true;
        const prevAmount = e.reservedCreditForFutureTrip?.amount ?? 0;
        const remaining = round2(prevAmount - consumed);
        const updated: Enrollee = {
          ...e,
          reservedCreditForFutureTrip:
            remaining > 0.005
              ? {
                  amount: remaining,
                  reservedAt: e.reservedCreditForFutureTrip?.reservedAt ?? new Date().toISOString(),
                }
              : undefined,
        };
        return appendAudit(
          updated,
          "credito_aplicado",
          `Crédito reservado ${formatUSD(consumed)} aplicado a ${data.name} (${trip.name})`,
          {
            monto: consumed,
            destino_viaje: trip.name,
            destino_viajera: data.name,
            saldo_credito_restante: remaining,
          },
        );
      });
      if (mutated) {
        newTrips[t.id] = { ...t, enrollees: newEnrollees };
      }
    }
    // Insertar la nueva enrollee en el trip destino (puede haber sido mutado arriba si origen===destino).
    const destTrip = newTrips[tripId];
    newTrips[tripId] = {
      ...destTrip,
      enrollees: [...destTrip.enrollees, newEnrollee],
    };

    set({ trips: newTrips });
    return id;
  },

  setEnrolleeLogistics: (tripId, enrolleeId, patch, summary) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const next = { ...(e.logistics ?? {}), ...patch };
            return appendAudit(
              { ...e, logistics: next },
              "logistica_editada",
              summary ?? "Logística editada",
            );
          }),
        },
      };
    }),

  addEnrolleeAttachment: (tripId, enrolleeId, attachment) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const logistics = e.logistics ?? {};
            const entry = {
              ...attachment,
              id: generateId(),
              uploadedAt: new Date().toISOString(),
            };
            return appendAudit(
              {
                ...e,
                logistics: { ...logistics, attachments: [...(logistics.attachments ?? []), entry] },
              },
              "adjunto_agregado",
              `Archivo agregado · ${entry.title}`,
            );
          }),
        },
      };
    }),

  removeEnrolleeAttachment: (tripId, enrolleeId, attachmentId) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const logistics = e.logistics ?? {};
            const found = (logistics.attachments ?? []).find((a) => a.id === attachmentId);
            if (!found) return e;
            return appendAudit(
              {
                ...e,
                logistics: {
                  ...logistics,
                  attachments: (logistics.attachments ?? []).filter((a) => a.id !== attachmentId),
                },
              },
              "adjunto_eliminado",
              `Archivo eliminado · ${found.title}`,
            );
          }),
        },
      };
    }),

  updateEnrolleeContact: (tripId, enrolleeId, patch) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const changes: string[] = [];
            if (patch.name !== undefined && patch.name !== e.name)
              changes.push(`nombre "${e.name}" → "${patch.name}"`);
            if (patch.email !== undefined && patch.email !== e.email)
              changes.push("email actualizado");
            if (patch.phone !== undefined && patch.phone !== e.phone)
              changes.push("teléfono actualizado");
            const updated = { ...e, ...patch };
            if (changes.length === 0) return updated;
            return appendAudit(
              updated,
              "contacto_editado",
              `Contacto editado · ${changes.join(", ")}`,
            );
          }),
        },
      };
    }),

  removeEnrollee: (tripId, enrolleeId) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: { ...trip, enrollees: trip.enrollees.filter((e) => e.id !== enrolleeId) },
        },
      };
    }),

  setEnrolleeNotes: (tripId, enrolleeId, notes) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const prev = (e.notes ?? "").trim();
            const next = notes.trim();
            if (prev === next) return { ...e, notes };
            const action = !prev ? "Nota agregada" : !next ? "Nota eliminada" : "Nota editada";
            return appendAudit({ ...e, notes }, "nota_editada", action);
          }),
        },
      };
    }),

  // ─── Extras ──────────────────────────────────────────────
  addExtra: (tripId, enrolleeId, data) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const price = Math.max(0, round2(data.price));
      const cost = Math.max(0, round2(data.cost));
      const today = new Date().toISOString().slice(0, 10);
      const date = data.date && data.date.trim() ? data.date : undefined;
      const paymentMode = data.paymentMode;
      // Construir el plan de cuotas
      let installments: import("./finance-types").ExtraInstallment[];
      if (paymentMode === "unico") {
        const due = data.dueDate?.trim() || date || today;
        const method = data.markPaid ? (data.method ?? "transferencia") : undefined;
        const supportsFee = data.markPaid && methodSupportsFee(method);
        const { feeAmount, netAmount } = supportsFee
          ? computePaymentNet(price, method, data.feePercent, data.feeFixed)
          : { feeAmount: 0, netAmount: price };
        installments = [
          {
            id: generateId(),
            amount: price,
            dueDate: due,
            status: data.markPaid ? "pagado" : "pendiente",
            paidAt: data.markPaid ? today : undefined,
            method,
            notes: data.notes?.trim() ? data.notes.trim() : undefined,
            feePercent: supportsFee ? Math.max(0, data.feePercent ?? 0) : undefined,
            feeFixed: supportsFee ? Math.max(0, data.feeFixed ?? 0) : undefined,
            feeDescription:
              data.markPaid && data.feeDescription?.trim() ? data.feeDescription.trim() : undefined,
            feeAmount: data.markPaid ? feeAmount : undefined,
            netAmount: data.markPaid ? netAmount : undefined,
          },
        ];
      } else {
        const raw = (data.installments ?? []).filter((i) => i.amount > 0 || i.dueDate);
        if (raw.length === 0) {
          // Fallback: 1 cuota con todo el monto.
          installments = [
            { id: generateId(), amount: price, dueDate: date || today, status: "pendiente" },
          ];
        } else {
          // Normaliza montos para que la suma iguale price (último absorbe rounding)
          const sum = round2(raw.reduce((s, i) => s + Math.max(0, i.amount), 0));
          const delta = round2(price - sum);
          installments = raw.map((i, idx) => ({
            id: generateId(),
            amount:
              idx === raw.length - 1
                ? round2(Math.max(0, i.amount) + delta)
                : round2(Math.max(0, i.amount)),
            dueDate: i.dueDate,
            status: "pendiente" as const,
            notes: i.notes?.trim() ? i.notes.trim() : undefined,
          }));
        }
      }
      const newExtra: Extra = {
        id: generateId(),
        name: data.name.trim(),
        price,
        cost,
        date,
        paymentMode,
        installments,
        createdAt: new Date().toISOString(),
      };
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const updated: Enrollee = { ...e, extras: [...(e.extras ?? []), newExtra] };
            const planSummary =
              paymentMode === "unico"
                ? data.markPaid
                  ? "pago único pagado"
                  : "pago único pendiente"
                : `${installments.length} cuotas`;
            return appendAudit(
              updated,
              "extra_creado",
              `Extra "${newExtra.name}" creado · ${planSummary} · precio ${formatUSD(price)} · costo ${formatUSD(cost)} · profit ${formatUSD(price - cost)}`,
              {
                extra: newExtra.name,
                precio: price,
                costo: cost,
                profit: round2(price - cost),
                modo: paymentMode,
              },
            );
          }),
        },
      };
    }),

  updateExtra: (tripId, enrolleeId, extraId, patch) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      const round2 = (n: number) => Math.round(n * 100) / 100;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const extras = e.extras ?? [];
            const idx = extras.findIndex((x) => x.id === extraId);
            if (idx < 0) return e;
            const prev = extras[idx];
            const newPrice =
              patch.price !== undefined ? Math.max(0, round2(patch.price)) : prev.price;
            const newCost = patch.cost !== undefined ? Math.max(0, round2(patch.cost)) : prev.cost;
            const newName = patch.name !== undefined ? patch.name.trim() : prev.name;
            const newDate =
              patch.date === null
                ? undefined
                : patch.date !== undefined
                  ? patch.date.trim() || undefined
                  : prev.date;
            // Si cambia el precio, rebalancear cuotas pendientes.
            let installments = prev.installments;
            if (newPrice !== prev.price && installments.length > 0) {
              const paidSum = round2(
                installments.reduce((s, i) => s + (i.status === "pagado" ? i.amount : 0), 0),
              );
              const remainingTarget = round2(Math.max(0, newPrice - paidSum));
              const pendingIndexes = installments
                .map((i, j) => ({ i, j }))
                .filter((x) => x.i.status === "pendiente");
              if (pendingIndexes.length === 0) {
                // Todo pagado: agregamos una nueva cuota pendiente o la última cuota mantiene el delta (preferimos no romper el modelo: log y dejar igual).
                if (remainingTarget > 0.005) {
                  installments = [
                    ...installments,
                    {
                      id: generateId(),
                      amount: remainingTarget,
                      dueDate: newDate || new Date().toISOString().slice(0, 10),
                      status: "pendiente",
                    },
                  ];
                }
              } else {
                const pendingSum = pendingIndexes.reduce((s, x) => s + x.i.amount, 0);
                if (pendingSum <= 0.005) {
                  // Distribuir parejo
                  const each = round2(remainingTarget / pendingIndexes.length);
                  installments = installments.map((inst, idx2) => {
                    const found = pendingIndexes.findIndex((x) => x.j === idx2);
                    if (found < 0) return inst;
                    const isLast = found === pendingIndexes.length - 1;
                    const amount = isLast
                      ? round2(remainingTarget - each * (pendingIndexes.length - 1))
                      : each;
                    return { ...inst, amount };
                  });
                } else {
                  // Distribuir proporcional
                  installments = installments.map((inst, idx2) => {
                    const found = pendingIndexes.findIndex((x) => x.j === idx2);
                    if (found < 0) return inst;
                    const isLast = found === pendingIndexes.length - 1;
                    if (isLast) {
                      // Último absorbe el delta
                      const otherSum = pendingIndexes
                        .filter((_, k) => k !== pendingIndexes.length - 1)
                        .reduce((s, x) => {
                          const ratio = x.i.amount / pendingSum;
                          return s + round2(remainingTarget * ratio);
                        }, 0);
                      return { ...inst, amount: round2(Math.max(0, remainingTarget - otherSum)) };
                    }
                    const ratio = inst.amount / pendingSum;
                    return { ...inst, amount: round2(remainingTarget * ratio) };
                  });
                }
              }
            }
            const next: Extra = {
              ...prev,
              name: newName,
              price: newPrice,
              cost: newCost,
              date: newDate,
              installments,
            };
            const updatedExtras = extras.map((x, i) => (i === idx ? next : x));
            const updated: Enrollee = { ...e, extras: updatedExtras };
            const changes: string[] = [];
            if (next.name !== prev.name) changes.push(`nombre "${prev.name}"→"${next.name}"`);
            if (next.price !== prev.price)
              changes.push(`precio ${formatUSD(prev.price)}→${formatUSD(next.price)}`);
            if (next.cost !== prev.cost)
              changes.push(`costo ${formatUSD(prev.cost)}→${formatUSD(next.cost)}`);
            if (next.date !== prev.date)
              changes.push(`fecha ${prev.date ?? "—"}→${next.date ?? "—"}`);
            if (changes.length === 0) return updated;
            return appendAudit(
              updated,
              "extra_editado",
              `Extra "${next.name}" editado · ${changes.join(" · ")}`,
              {
                extra: next.name,
                precio: next.price,
                costo: next.cost,
                profit: round2(next.price - next.cost),
              },
            );
          }),
        },
      };
    }),

  replaceExtraInstallments: (tripId, enrolleeId, extraId, plan, paymentMode) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      const round2 = (n: number) => Math.round(n * 100) / 100;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const extras = e.extras ?? [];
            const idx = extras.findIndex((x) => x.id === extraId);
            if (idx < 0) return e;
            const prev = extras[idx];
            const installments: import("./finance-types").ExtraInstallment[] = plan.map((p) => {
              const amount = round2(Math.max(0, p.amount));
              const status = p.status ?? "pendiente";
              const method = p.method;
              const supportsFee = status === "pagado" && methodSupportsFee(method);
              const feePercent = supportsFee ? Math.max(0, p.feePercent ?? 0) : undefined;
              const feeFixed = supportsFee ? Math.max(0, p.feeFixed ?? 0) : undefined;
              let feeAmount: number | undefined;
              let netAmount: number | undefined;
              if (status === "pagado") {
                if (supportsFee) {
                  const r = computePaymentNet(amount, method, feePercent, feeFixed);
                  feeAmount = r.feeAmount;
                  netAmount = r.netAmount;
                } else {
                  feeAmount = 0;
                  netAmount = amount;
                }
              }
              return {
                id: p.id ?? generateId(),
                amount,
                dueDate: p.dueDate,
                status,
                paidAt: p.paidAt,
                method,
                notes: p.notes,
                feePercent,
                feeFixed,
                feeDescription: p.feeDescription?.trim() ? p.feeDescription.trim() : undefined,
                feeAmount,
                netAmount,
              };
            });
            const next: Extra = {
              ...prev,
              paymentMode: paymentMode ?? (installments.length <= 1 ? "unico" : "cuotas"),
              installments,
            };
            const updatedExtras = extras.map((x, i) => (i === idx ? next : x));
            const updated: Enrollee = { ...e, extras: updatedExtras };
            return appendAudit(
              updated,
              "extra_editado",
              `Plan de cuotas del extra "${next.name}" actualizado (${installments.length} ${installments.length === 1 ? "cuota" : "cuotas"})`,
              { extra: next.name, cuotas: installments.length },
            );
          }),
        },
      };
    }),

  removeExtra: (tripId, enrolleeId, extraId) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const extras = e.extras ?? [];
            const target = extras.find((x) => x.id === extraId);
            if (!target) return e;
            const remaining = extras.filter((x) => x.id !== extraId);
            const updated: Enrollee = {
              ...e,
              extras: remaining.length > 0 ? remaining : undefined,
            };
            return appendAudit(
              updated,
              "extra_eliminado",
              `Extra "${target.name}" eliminado · precio ${formatUSD(target.price)}`,
              { extra: target.name, precio: target.price },
            );
          }),
        },
      };
    }),

  markExtraInstallmentPaid: (tripId, enrolleeId, extraId, installmentId, payload) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      const today = new Date().toISOString().slice(0, 10);
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const extras = e.extras ?? [];
            const idx = extras.findIndex((x) => x.id === extraId);
            if (idx < 0) return e;
            const target = extras[idx];
            const instIdx = target.installments.findIndex((i) => i.id === installmentId);
            if (instIdx < 0) return e;
            const inst = target.installments[instIdx];
            if (inst.status === "pagado") return e;
            const method = payload?.method ?? "transferencia";
            const supportsFee = methodSupportsFee(method);
            const { feeAmount, netAmount } = supportsFee
              ? computePaymentNet(inst.amount, method, payload?.feePercent, payload?.feeFixed)
              : { feeAmount: 0, netAmount: inst.amount };
            const updatedInst: import("./finance-types").ExtraInstallment = {
              ...inst,
              status: "pagado",
              paidAt: payload?.paidAt ?? today,
              method,
              notes: payload?.notes ?? inst.notes,
              feePercent: supportsFee ? Math.max(0, payload?.feePercent ?? 0) : undefined,
              feeFixed: supportsFee ? Math.max(0, payload?.feeFixed ?? 0) : undefined,
              feeDescription: payload?.feeDescription?.trim()
                ? payload.feeDescription.trim()
                : undefined,
              feeAmount,
              netAmount,
            };
            const next: Extra = {
              ...target,
              installments: target.installments.map((i, k) => (k === instIdx ? updatedInst : i)),
            };
            const updatedExtras = extras.map((x, i) => (i === idx ? next : x));
            const updated: Enrollee = { ...e, extras: updatedExtras };
            const cuotaLabel =
              target.paymentMode === "unico"
                ? "Pago único"
                : `Cuota ${instIdx + 1}/${target.installments.length}`;
            return appendAudit(
              updated,
              "extra_pagado",
              `${cuotaLabel} pagada · extra "${target.name}" · ${formatUSD(updatedInst.amount)} · ${PAYMENT_METHOD_LABELS[updatedInst.method ?? "transferencia"]}${updatedInst.notes ? ` · ${updatedInst.notes}` : ""}`,
              {
                extra: target.name,
                monto: updatedInst.amount,
                metodo: updatedInst.method ?? "transferencia",
              },
            );
          }),
        },
      };
    }),

  revertExtraInstallment: (tripId, enrolleeId, extraId, installmentId) =>
    set((state) => {
      const trip = state.trips[tripId];
      if (!trip) return state;
      return {
        trips: {
          ...state.trips,
          [tripId]: mapEnrollee(trip, enrolleeId, (e) => {
            const extras = e.extras ?? [];
            const idx = extras.findIndex((x) => x.id === extraId);
            if (idx < 0) return e;
            const target = extras[idx];
            const instIdx = target.installments.findIndex((i) => i.id === installmentId);
            if (instIdx < 0) return e;
            const inst = target.installments[instIdx];
            if (inst.status !== "pagado") return e;
            const updatedInst: import("./finance-types").ExtraInstallment = {
              ...inst,
              status: "pendiente",
              paidAt: undefined,
              method: undefined,
              feePercent: undefined,
              feeFixed: undefined,
              feeDescription: undefined,
              feeAmount: undefined,
              netAmount: undefined,
            };
            const next: Extra = {
              ...target,
              installments: target.installments.map((i, k) => (k === instIdx ? updatedInst : i)),
            };
            const updatedExtras = extras.map((x, i) => (i === idx ? next : x));
            const updated: Enrollee = { ...e, extras: updatedExtras };
            const cuotaLabel =
              target.paymentMode === "unico"
                ? "Pago único"
                : `Cuota ${instIdx + 1}/${target.installments.length}`;
            return appendAudit(
              updated,
              "extra_pago_revertido",
              `${cuotaLabel} revertida · extra "${target.name}" · ${formatUSD(inst.amount)}`,
              { extra: target.name, monto: inst.amount },
            );
          }),
        },
      };
    }),
}));

// ─── Auto-save debounced a Supabase ─────────────────────────────
// Cada cambio en `trips` (después de la hidratación inicial) se persiste
// llamando `updateTripData` con el blob completo del viaje modificado.
// Se debouncea por trip para agrupar ráfagas de mutaciones.
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Serializa los guardados por viaje. Como se persiste el blob completo, dos
// requests concurrentes podían terminar fuera de orden y una versión antigua
// sobrescribía horas recién editadas.
const saveQueues = new Map<string, Promise<void>>();

function hasPendingSave(tripId: string): boolean {
  return saveTimers.has(tripId) || saveQueues.has(tripId);
}

async function persistTrip(trip: TripData) {
  await updateTripData({
    data: {
      id: trip.id,
      name: trip.name,
      destination: trip.destination ?? null,
      startDate: trip.startDate ?? null,
      endDate: trip.endDate ?? null,
      status: trip.status ?? null,
      data: trip as unknown as Record<string, unknown>,
    },
  });
}

function enqueueLatestTripSave(tripId: string): Promise<void> {
  const previous = saveQueues.get(tripId) ?? Promise.resolve();
  const queued = previous
    .catch(() => undefined)
    .then(async () => {
      const latestTrip = useTripsStore.getState().trips[tripId];
      if (!latestTrip) return;
      await persistTrip(latestTrip);
      // Aviso en vivo a las demás organizadoras que tienen el viaje abierto.
      if (typeof window !== "undefined") {
        void import("@/hooks/use-trip-activity")
          .then((m) => m.notifyTripActivity(tripId))
          .catch(() => undefined);
      }
    });


  saveQueues.set(tripId, queued);
  void queued.then(
    () => {
      if (saveQueues.get(tripId) === queued) saveQueues.delete(tripId);
    },
    () => {
      if (saveQueues.get(tripId) === queued) saveQueues.delete(tripId);
    },
  );
  return queued;
}

/**
 * Persiste inmediatamente un viaje a Supabase, cancelando cualquier auto-save
 * pendiente. Devuelve una promesa que resuelve cuando el guardado termina.
 */
export async function saveTripNow(tripId: string): Promise<void> {
  const timer = saveTimers.get(tripId);
  if (timer) {
    clearTimeout(timer);
    saveTimers.delete(tripId);
  }
  try {
    await enqueueLatestTripSave(tripId);
  } catch (e) {
    useTripsStore.setState({
      saveError: e instanceof Error ? e.message : "Error al guardar",
    });
    throw e;
  }
}

if (typeof window !== "undefined") {
  const scheduleSave = (tripId: string) => {
    const existing = saveTimers.get(tripId);
    if (existing) clearTimeout(existing);
    saveTimers.set(
      tripId,
      setTimeout(async () => {
        try {
          saveTimers.delete(tripId);
          await enqueueLatestTripSave(tripId);
        } catch (e) {
          console.error("[trips-store] auto-save falló", tripId, e);
          useTripsStore.setState({
            saveError: e instanceof Error ? e.message : "Error al guardar",
          });
        }
      }, 800),
    );
  };

  let prevTrips: Record<string, TripData> = useTripsStore.getState().trips;
  useTripsStore.subscribe((state) => {
    if (!state.hydrated) {
      prevTrips = state.trips;
      return;
    }
    const next = state.trips;
    for (const id of Object.keys(next)) {
      if (next[id] !== prevTrips[id]) {
        scheduleSave(id);
      }
    }
    prevTrips = next;
  });
}

export function useTripsRecord() {
  return useTripsStore((s) => s.trips);
}

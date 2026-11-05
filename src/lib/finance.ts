// Cálculos financieros centralizados. Única fuente de verdad para totales,
// utilidad y punto de equilibrio. Tanto la sección Costos del viaje como la
// página Finanzas consumen estas funciones.

import type {
  CostItem,
  Enrollee,
  Installment,
  InstallmentCount,
  PaymentStatus,
  Participation,
  RefundRule,
  TripData,
} from "./finance-types";
import {
  computeDiscountAmount,
  computeFinalPrice,
  costBaseAmount,
  extraPaidAmount,
  extraPaidNet,
  extraTotalFees,
  extraProfit,
  paymentFeeAmount,
  paymentNetAmount,
} from "./finance-types";

// ─── Participación parcial ───────────────────────────────────
export function computeParticipationPrice(
  finalPrice: number,
  participation: Participation | null | undefined,
): number {
  if (!participation || participation.mode === "completa") return finalPrice;
  if (typeof participation.manualPrice === "number" && participation.manualPrice >= 0) {
    return Math.round(participation.manualPrice * 100) / 100;
  }
  if (participation.kind === "dias" && participation.totalDays && participation.totalDays > 0) {
    const ratio = Math.min(1, Math.max(0, (participation.daysIncluded ?? 0) / participation.totalDays));
    return Math.round(finalPrice * ratio * 100) / 100;
  }
  return finalPrice;
}

// ─── Política de devolución ──────────────────────────────────
export function computeSuggestedRefund(
  amountPaid: number,
  cancelledAt: string,
  tripStart: string,
  rules: RefundRule[] | undefined,
): { amount: number; ruleId?: string; percent: number } {
  if (!rules || rules.length === 0) return { amount: 0, percent: 0 };
  const cancelDate = new Date(cancelledAt);
  const startDate = new Date(tripStart);
  const diffDays = Math.floor((startDate.getTime() - cancelDate.getTime()) / (1000 * 60 * 60 * 24));
  const sorted = [...rules].sort((a, b) => b.daysBefore - a.daysBefore);
  const match = sorted.find((r) => diffDays >= r.daysBefore);
  if (!match) return { amount: 0, percent: 0 };
  const amount = Math.round(amountPaid * (match.percent / 100) * 100) / 100;
  return { amount, ruleId: match.id, percent: match.percent };
}

// ─── Helper: monto efectivamente abonado en una cuota ──────────────
/**
 * Suma de pagos parciales registrados. Si la cuota está en status="pagado"
 * y no hay desglose de payments, se considera pagada por completo.
 */
export function installmentPaidAmount(installment: Installment): number {
  const payments = installment.payments ?? [];
  if (payments.length === 0) {
    return installment.status === "pagado" ? installment.amount : 0;
  }
  const sum = payments.reduce((s, p) => s + p.amount, 0);
  return Math.min(installment.amount, Math.round(sum * 100) / 100);
}

/** Suma neta cobrada (descontando comisiones de plataforma) por una cuota. */
export function installmentNetAmount(installment: Installment): number {
  const payments = installment.payments ?? [];
  if (payments.length === 0) {
    return installment.status === "pagado" ? installment.amount : 0;
  }
  const sum = payments.reduce((s, p) => s + paymentNetAmount(p), 0);
  return Math.round(sum * 100) / 100;
}

/** Suma de comisiones (Stripe u otros) absorbidas por la organizadora. */
export function installmentFeesAmount(installment: Installment): number {
  const payments = installment.payments ?? [];
  if (payments.length === 0) return 0;
  const sum = payments.reduce((s, p) => s + paymentFeeAmount(p), 0);
  return Math.round(sum * 100) / 100;
}

/** Saldo restante de una cuota (= amount - lo abonado). */
export function installmentRemaining(installment: Installment): number {
  return Math.max(0, Math.round((installment.amount - installmentPaidAmount(installment)) * 100) / 100);
}

// ─── Helper: detectar cuotas vencidas ─────────────────────────────
/**
 * Una cuota está vencida si NO está totalmente pagada y su dueDate < hoy.
 * Una cuota con abonos parciales (status="parcial") sigue contando como
 * vencida si pasó la fecha — no está resuelta hasta cubrir el total.
 */
export function isOverdue(installment: Installment): boolean {
  if (installment.status === "pagado") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(installment.dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

// ─── Derivaciones de pago (puras) ─────────────────────────────────
// Toda la información de pagos se DERIVA de las cuotas de cada viajera.
// No se almacena `amountPaid` ni `paymentStatus`: se computa en cada render.

export interface EnrolleeFinancials {
  basePrice: number;
  discountAmount: number;
  finalPrice: number;        // tras descuento
  effectivePrice: number;    // tras descuento + participación parcial
  totalDue: number;
  amountPaid: number;        // bruto cobrado a la viajera
  /** Suma de comisiones (Stripe u otros) absorbidas por la organizadora. */
  totalFees: number;
  /** Neto efectivamente recibido = amountPaid - totalFees. */
  amountPaidNet: number;
  amountPending: number;
  paidCount: number;
  pendingCount: number;
  totalCount: number;
  status: PaymentStatus;
  nextDue: Installment | null;
  isCancelled: boolean;
  refundedAmount: number;
  retainedAmount: number;
}

export function getBasePrice(e: Enrollee, tripPrice: number): number {
  return e.basePrice ?? tripPrice ?? e.totalDue ?? 0;
}

export function deriveEnrolleeFinancials(e: Enrollee, tripPrice = 0): EnrolleeFinancials {
  const installments = e.installments ?? [];
  const fullyPaid = installments.filter((i) => i.status === "pagado");
  const notFullyPaid = installments.filter((i) => i.status !== "pagado");
  const amountPaid = installments.reduce((s, i) => s + installmentPaidAmount(i), 0);
  const totalFees = Math.round(
    installments.reduce((s, i) => s + installmentFeesAmount(i), 0) * 100,
  ) / 100;
  const amountPaidNet = Math.round((amountPaid - totalFees) * 100) / 100;
  const unassignedBalance = e.unassignedBalance ?? 0;
  const amountPending =
    notFullyPaid.reduce((s, i) => s + installmentRemaining(i), 0) + unassignedBalance;
  const basePrice = getBasePrice(e, tripPrice);
  const discountAmount = computeDiscountAmount(basePrice, e.discount);
  const finalPrice = computeFinalPrice(basePrice, e.discount);
  const effectivePrice = computeParticipationPrice(finalPrice, e.participation);
  const totalDue = e.totalDue || effectivePrice || amountPaid + amountPending;
  const totalCount = installments.length;
  const paidCount = fullyPaid.length;

  let status: PaymentStatus;
  if (totalCount === 0 && unassignedBalance <= 0) status = "pendiente";
  else if (paidCount === totalCount && unassignedBalance <= 0.005) status = "pagado";
  else if (amountPaid > 0) status = "parcial";
  else status = "pendiente";

  const nextDue =
    notFullyPaid.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;

  const isCancelled = e.status === "cancelada";
  const refundedAmount = e.cancellation?.refundedAmount ?? 0;
  const retainedAmount = isCancelled
    ? Math.max(0, Math.round((amountPaid - refundedAmount) * 100) / 100)
    : 0;

  return {
    basePrice,
    discountAmount,
    finalPrice,
    effectivePrice,
    totalDue,
    amountPaid,
    totalFees,
    amountPaidNet,
    amountPending,
    paidCount,
    pendingCount: notFullyPaid.length,
    totalCount,
    status,
    nextDue,
    isCancelled,
    refundedAmount,
    retainedAmount,
  };
}

/**
 * Diagnóstico de coherencia entre el plan de cuotas y el totalDue de la
 * viajera. Devuelve `ok=true` cuando no hay desalineación relevante o cuando
 * el chequeo no aplica (viajera cancelada / sin cuotas).
 *
 * - `sumInstallments`: suma de los montos brutos de todas las cuotas.
 * - `totalDue`: total a cobrar derivado (respeta descuento, participación
 *   parcial y créditos aplicados desde otros viajes).
 * - `diff`: `totalDue - sumInstallments`. Positivo = faltan cuotas por
 *   cubrir; negativo = las cuotas superan al total.
 */
export interface InstallmentPlanMismatch {
  ok: boolean;
  applies: boolean;
  sumInstallments: number;
  totalDue: number;
  diff: number;
}

export function getInstallmentPlanMismatch(
  enrollee: Enrollee,
  tripPrice = 0,
): InstallmentPlanMismatch {
  const installments = enrollee.installments ?? [];
  const isCancelled = enrollee.status === "cancelada";
  const applies = !isCancelled && installments.length > 0;
  const fin = deriveEnrolleeFinancials(enrollee, tripPrice);
  const sumInstallments =
    Math.round(installments.reduce((s, i) => s + (i.amount ?? 0), 0) * 100) / 100;
  const totalDue = Math.round(fin.totalDue * 100) / 100;
  const diff = Math.round((totalDue - sumInstallments) * 100) / 100;
  const ok = !applies || Math.abs(diff) <= 0.01;
  return { ok, applies, sumInstallments, totalDue, diff };
}



export interface EnrolleesAggregate {
  count: number;             // solo activas
  cancelledCount: number;
  fullyPaid: number;
  withPending: number;
  totalCollected: number;    // BRUTO recibido (activas + canceladas)
  /** Suma de comisiones (Stripe u otros). */
  totalFees: number;
  /** Neto efectivamente recibido = totalCollected - totalFees. */
  totalCollectedNet: number;
  totalPending: number;      // por cobrar (solo activas)
  totalCommitted: number;    // precio efectivo activas
  totalDiscount: number;
  totalBase: number;
  totalRefunded: number;
  totalRetained: number;
  /** Ingreso neto = neto cobrado - devuelto. */
  netRevenue: number;
  /** Total cobrado NETO de extras (USD, ya descontadas comisiones absorbidas). */
  extrasCollected: number;
  /** Total cobrado BRUTO de extras (antes de comisiones). */
  extrasGross: number;
  /** Suma de comisiones absorbidas en extras. */
  extrasFees: number;
  /** Profit total de extras = sum(price − cost − fees). */
  extrasProfit: number;
  /** Saldo pendiente de extras (bruto). */
  extrasPending: number;
  /** Cantidad de extras (todas las viajeras). */
  extrasCount: number;
  /** Costo total de proveedores de extras = sum(extras[].cost). */
  extrasCost: number;
}

export function aggregateEnrollees(enrollees: Enrollee[], tripPrice = 0): EnrolleesAggregate {
  let collected = 0;
  let collectedNet = 0;
  let fees = 0;
  let pending = 0;
  let committed = 0;
  let discount = 0;
  let base = 0;
  let fullyPaid = 0;
  let withPending = 0;
  let cancelledCount = 0;
  let totalRefunded = 0;
  let totalRetained = 0;
  let activeCount = 0;
  let extrasCollected = 0;
  let extrasFees = 0;
  let extrasGross = 0;
  let extrasProfitSum = 0;
  let extrasPending = 0;
  let extrasCount = 0;
  let extrasCostSum = 0;
  for (const e of enrollees) {
    const f = deriveEnrolleeFinancials(e, tripPrice);
    collected += f.amountPaid;
    collectedNet += f.amountPaidNet;
    fees += f.totalFees;
    // Extras: independientes del estado (activa/cancelada). Cuentan siempre.
    for (const x of e.extras ?? []) {
      extrasCount++;
      const paidGross = extraPaidAmount(x);
      const paidNet = extraPaidNet(x);
      extrasGross += paidGross;
      extrasCollected += paidNet;
      extrasFees += extraTotalFees(x);
      extrasProfitSum += extraProfit(x);
      extrasPending += Math.max(0, x.price - paidGross);
      extrasCostSum += Math.max(0, x.cost ?? 0);
    }
    if (f.isCancelled) {
      cancelledCount++;
      totalRefunded += f.refundedAmount;
      totalRetained += f.retainedAmount;
      continue;
    }
    activeCount++;
    // "Por cobrar" a nivel de viaje: usamos totalDue − pagado (nunca negativo).
    // Así incluye a viajeras "sin plan todavía" (installments = []), donde
    // f.amountPending es 0 pero la tarjeta muestra $0/$X y el resumen debe
    // reflejar esos $X pendientes. Coincide con lo que ve la organizadora.
    pending += Math.max(0, f.totalDue - f.amountPaid);
    committed += f.effectivePrice;
    discount += f.discountAmount;
    base += f.basePrice;
    if (f.status === "pagado" && f.totalCount > 0) fullyPaid++;
    else withPending++;
  }
  const totalFees = Math.round(fees * 100) / 100;
  const totalCollectedNet = Math.round(collectedNet * 100) / 100;
  const netRevenue = Math.round((totalCollectedNet - totalRefunded) * 100) / 100;
  return {
    count: activeCount,
    cancelledCount,
    fullyPaid,
    withPending,
    totalCollected: collected,
    totalFees,
    totalCollectedNet,
    totalPending: pending,
    totalCommitted: committed,
    totalDiscount: discount,
    totalBase: base,
    totalRefunded,
    totalRetained,
    netRevenue,
    extrasCollected: Math.round(extrasCollected * 100) / 100,
    extrasGross: Math.round(extrasGross * 100) / 100,
    extrasFees: Math.round(extrasFees * 100) / 100,
    extrasProfit: Math.round(extrasProfitSum * 100) / 100,
    extrasPending: Math.round(extrasPending * 100) / 100,
    extrasCount,
    extrasCost: Math.round(extrasCostSum * 100) / 100,
  };
}

/**
 * Reajusta cuotas pendientes para que la suma del plan iguale `newTotal`.
 * - Preserva todas las cuotas pagadas (montos y fechas).
 * - Distribuye el delta proporcionalmente entre las cuotas pendientes.
 * - Si todas las cuotas están pagadas, devuelve el plan sin cambios (no se
 *   puede ajustar; el usuario debe revertir un pago primero).
 * - Si el remanente es <= 0 (descuento ≥ lo no pagado), las pendientes se
 *   ponen en 0.
 */
export function rebalanceInstallments(
  installments: Installment[],
  newTotal: number,
): Installment[] {
  if (installments.length === 0) return installments;
  // Cuotas "bloqueadas" (no se rebalancean): pagadas o con abonos parciales.
  const locked = installments.filter((i) => i.status !== "pendiente");
  const pending = installments.filter((i) => i.status === "pendiente");
  const lockedSum = locked.reduce((s, i) => s + i.amount, 0);
  if (pending.length === 0) return installments;
  const remaining = Math.max(0, Math.round((newTotal - lockedSum) * 100) / 100);
  const pendingSum = pending.reduce((s, i) => s + i.amount, 0);
  let adjusted: Installment[];
  if (pendingSum === 0) {
    // Distribuye en partes iguales si todas estaban en 0.
    const per = Math.round((remaining / pending.length) * 100) / 100;
    adjusted = pending.map((i) => ({ ...i, amount: per }));
  } else {
    const ratio = remaining / pendingSum;
    adjusted = pending.map((i) => ({ ...i, amount: Math.round(i.amount * ratio * 100) / 100 }));
  }
  // Ajuste de redondeo en la última pendiente.
  const newPendingSum = adjusted.reduce((s, i) => s + i.amount, 0);
  const diff = Math.round((remaining - newPendingSum) * 100) / 100;
  if (adjusted.length > 0) {
    adjusted[adjusted.length - 1] = {
      ...adjusted[adjusted.length - 1],
      amount: Math.round((adjusted[adjusted.length - 1].amount + diff) * 100) / 100,
    };
  }
  // Reconstruye en el orden original.
  const adjustedById = new Map(adjusted.map((i) => [i.id, i]));
  return installments.map((i) => adjustedById.get(i.id) ?? i);
}

/**
 * Genera N cuotas iguales con fechas distribuidas uniformemente entre
 * `from` y `to` (inclusive de ambos extremos en el caso 1: solo una fecha
 * en `from`). Usado como punto de partida; el usuario puede editar.
 */
export function generateInstallments(
  total: number,
  count: InstallmentCount,
  from: string,
  to: string,
): Installment[] {
  const per = Math.round((total / count) * 100) / 100;
  // Ajuste de redondeo: la última cuota absorbe la diferencia.
  const amounts = Array(count).fill(per);
  const sum = amounts.reduce((s, n) => s + n, 0);
  const diff = Math.round((total - sum) * 100) / 100;
  amounts[amounts.length - 1] = Math.round((amounts[amounts.length - 1] + diff) * 100) / 100;

  const dates = distributeDates(from, to, count);
  return amounts.map((amount, i) => ({
    id: `i_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
    dueDate: dates[i],
    amount,
    status: "pendiente" as const,
  }));
}

function distributeDates(from: string, to: string, count: number): string[] {
  if (count <= 1) return [from];
  const start = parseISO(from).getTime();
  const end = parseISO(to).getTime();
  const span = end - start;
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, i) => toISO(new Date(start + step * i)));
}

function parseISO(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Cálculos del viaje ──────────────────────────────────────────


export interface TripFinancials {
  totalFixed: number;
  variableUnit: number;
  totalVariableActual: number;
  totalVariableMax: number;
  totalTeam: number;
  totalNotIncluded: number;
  /** Estimado por persona de gastos NO incluidos (traveler-should-bring). */
  notIncludedPerPerson: number;

  totalCostActual: number;
  totalCostMax: number;

  revenueCommitted: number;
  revenueCollected: number;        // BRUTO cobrado
  /** Comisiones de plataformas de pago (Stripe etc.) absorbidas por la organizadora. */
  revenueFees: number;
  /** Neto cobrado = revenueCollected - revenueFees. */
  revenueCollectedNet: number;
  revenueRefunded: number;
  revenueRetained: number;
  revenueNet: number;              // neto - devuelto
  revenueActual: number;
  revenueMax: number;

  profitActual: number;
  profitMax: number;
  marginActual: number;
  marginMax: number;
  /** Utilidad consolidada = profitActual + extrasProfit. */
  profitWithExtras: number;
  /** Margen consolidado sobre (revenueNet + extrasRevenue). Informativo. */
  marginWithExtras: number;

  costPerPerson: number;
  profitPerPerson: number;

  breakEven: number;
  breakEvenReached: boolean;

  /**
   * Base sobre la que se proyectan costos por-persona y costos variables.
   * - "capacidad" → usa `trip.capacity` (planificación, default).
   * - "inscriptas" → usa el conteo real de enrollees activas (viaje cerrado).
   */
  projectionMode: "capacidad" | "inscriptas";
  /** Número usado como divisor/multiplicador de proyección (capacity o enrolled). */
  projectionBasis: number;

  activeCount: number;
  cancelledCount: number;

  // ─── Extras (separados del viaje base) ───
  /** Bruto cobrado en extras (independiente del revenue del viaje base). */
  extrasRevenue: number;
  /** Profit acumulado de extras = sum(price - cost). */
  extrasProfit: number;
  /** Saldo pendiente de cobro de extras. */
  extrasPending: number;
  /** Cantidad total de extras registrados. */
  extrasCount: number;
  /** Costo total de proveedores de extras = sum(extras[].cost). */
  extrasCost: number;
  /** Costo consolidado = totalCostActual + extrasCost. */
  totalCostWithExtras: number;
}

/**
 * Calcula todos los indicadores financieros de un viaje a partir de sus costos.
 * Esta función es PURA: mismo input → mismo output. No tiene side effects.
 */
export function calculateTripFinancials(trip: TripData, costs: CostItem[]): TripFinancials {
  // Un costo se considera "no incluido en el paquete" si:
  //   - está marcado explícitamente included === false (nuevo flag), o
  //   - conserva la categoría legacy "no_incluido".
  // Estos costos NO participan en la utilidad ni en el punto de equilibrio:
  // representan gastos personales estimados que la viajera debe traer.
  const isNotIncluded = (c: CostItem) =>
    c.included === false || c.category === "no_incluido";
  const fixed = costs.filter((c) => c.category === "fijo" && !isNotIncluded(c));
  const variable = costs.filter((c) => c.category === "variable" && !isNotIncluded(c));
  const team = costs.filter((c) => c.category === "equipo" && !isNotIncluded(c));
  const notIncluded = costs.filter(isNotIncluded);

  const capacity = trip.capacity;
  const price = trip.pricePerPerson;

  const enrolleesAgg = aggregateEnrollees(trip.enrollees ?? [], price);
  const hasEnrolleeData = (trip.enrollees ?? []).length > 0;
  const enrolled = hasEnrolleeData ? enrolleesAgg.count : trip.enrolled;

  // Base de proyección: cuando el viaje está "cerrado" y hay inscriptas
  // reales, todo lo que se proyectaba sobre capacidad pasa a proyectarse
  // sobre inscriptas reales — sin tocar el campo VIAJERAS. En cualquier otro
  // estado (planificando, abierto, completo, en_curso) seguimos usando
  // capacity para que las cifras sean estables durante la planificación.
  const isClosed = trip.status === "cerrado";
  const projectionMode: "capacidad" | "inscriptas" =
    isClosed && enrolled > 0 ? "inscriptas" : "capacidad";
  const projectionBasis = projectionMode === "inscriptas" ? enrolled : capacity;

  // Divisor para prorratear ítems que representan "total de grupo" hacia una
  // base por-persona (y viceversa).
  const divisor = projectionBasis > 0 ? projectionBasis : (enrolled > 0 ? enrolled : 1);

  // Normalizadores que respetan el flag `perPerson` del ítem:
  //  - perPerson=true → el monto ya está en base unitaria (por viajera).
  //  - perPerson=false → el monto representa el total del grupo.
  // Esto evita multiplicar/dividir de más ante datos legacy o ediciones
  // que dejen `perPerson` desalineado con `category`.
  const perPersonAmount = (c: CostItem): number => {
    const base = costBaseAmount(c, trip);
    if (c.perPerson) return base;
    return divisor > 0 ? base / divisor : 0;
  };
  const groupAmount = (c: CostItem): number => {
    const base = costBaseAmount(c, trip);
    if (c.perPerson) return base * divisor;
    return base;
  };

  const totalFixed = fixed.reduce((s, c) => s + groupAmount(c), 0);
  const variableUnit = variable.reduce((s, c) => s + perPersonAmount(c), 0);
  const totalTeam = team.reduce((s, c) => s + groupAmount(c), 0);
  const totalNotIncluded = notIncluded.reduce((s, c) => s + groupAmount(c), 0);

  // Los variables se proyectan sobre la base activa (capacidad o inscriptas).
  // `totalVariableMax` sigue anclado a capacidad porque representa el techo
  // "si se llenara el grupo".
  const totalVariableActual = variableUnit * projectionBasis;
  const totalVariableMax = variableUnit * capacity;

  const totalCostActual = totalFixed + totalVariableActual + totalTeam;
  const totalCostMax = totalFixed + totalVariableMax + totalTeam;

  // Métricas de ingreso separadas
  const revenueCommitted = hasEnrolleeData ? enrolleesAgg.totalCommitted : price * enrolled;
  const revenueCollected = enrolleesAgg.totalCollected;
  const revenueRefunded = enrolleesAgg.totalRefunded;
  const revenueRetained = enrolleesAgg.totalRetained;
  const revenueFees = enrolleesAgg.totalFees;
  const revenueCollectedNet = enrolleesAgg.totalCollectedNet;
  const revenueNet = enrolleesAgg.netRevenue;
  const revenueActual = revenueCommitted; // compat retro
  const revenueMax = price * capacity;

  // Utilidad refleja la realidad: lo NETO cobrado - devoluciones - costos.
  // Cuando no hay enrollees registradas, fallback al cálculo comprometido.
  const profitBase = hasEnrolleeData ? revenueNet : revenueCommitted;
  const profitActual = profitBase - totalCostActual;
  const profitMax = revenueMax - totalCostMax;

  const marginRef = hasEnrolleeData ? revenueNet : revenueCommitted;
  const marginActual = marginRef > 0 ? (profitActual / marginRef) * 100 : 0;
  const marginMax = revenueMax > 0 ? (profitMax / revenueMax) * 100 : 0;

  const costPerPersonRaw =
    divisor > 0 ? (totalFixed + totalTeam) / divisor + variableUnit : 0;
  const costPerPerson = Math.round(costPerPersonRaw * 100) / 100;
  const profitPerPerson = Math.round((price - costPerPersonRaw) * 100) / 100;

  const netPerPerson = price - variableUnit;
  const fixedPlusTeam = totalFixed + totalTeam;
  const breakEven = netPerPerson > 0 ? Math.ceil(fixedPlusTeam / netPerPerson) : Infinity;
  const breakEvenReached = enrolled >= breakEven;

  // Estimado por persona de "no incluido":
  // - Los ítems perPerson ya son costo unitario, se suman directo.
  // - Los ítems no-perPerson se prorratean entre el divisor (viajeras activas
  //   o capacidad si aún no hay inscriptas).
  const notIncludedPerPerson = notIncluded.reduce((sum, c) => {
    const base = costBaseAmount(c, trip);
    if (c.perPerson) return sum + base;
    return sum + (divisor > 0 ? base / divisor : 0);
  }, 0);

  return {
    totalFixed,
    variableUnit,
    totalVariableActual,
    totalVariableMax,
    totalTeam,
    totalNotIncluded,
    notIncludedPerPerson: Math.round(notIncludedPerPerson * 100) / 100,
    totalCostActual,
    totalCostMax,
    revenueCommitted,
    revenueCollected,
    revenueFees,
    revenueCollectedNet,
    revenueRefunded,
    revenueRetained,
    revenueNet,
    revenueActual,
    revenueMax,
    profitActual,
    profitMax,
    marginActual,
    marginMax,
    profitWithExtras: Math.round((profitActual + enrolleesAgg.extrasProfit) * 100) / 100,
    marginWithExtras: (() => {
      const denom = (hasEnrolleeData ? revenueNet : revenueCommitted) + enrolleesAgg.extrasCollected;
      return denom > 0 ? ((profitActual + enrolleesAgg.extrasProfit) / denom) * 100 : 0;
    })(),
    costPerPerson,
    profitPerPerson,
    breakEven,
    breakEvenReached,
    projectionMode,
    projectionBasis,
    activeCount: enrolleesAgg.count,
    cancelledCount: enrolleesAgg.cancelledCount,
    extrasRevenue: enrolleesAgg.extrasCollected,
    extrasProfit: enrolleesAgg.extrasProfit,
    extrasPending: enrolleesAgg.extrasPending,
    extrasCount: enrolleesAgg.extrasCount,
    extrasCost: enrolleesAgg.extrasCost,
    totalCostWithExtras: Math.round((totalCostActual + enrolleesAgg.extrasCost) * 100) / 100,
  };
}

export interface ScenarioFinancials {
  people: number;
  revenue: number;
  totalCost: number;
  profit: number;
  margin: number;
  costPerPerson: number;
  breakEven: number;
  breakEvenReached: boolean;
}

/**
 * Simula los indicadores con un número arbitrario de personas (no muta datos).
 */
export function simulateScenario(
  trip: TripData,
  costs: CostItem[],
  people: number,
): ScenarioFinancials {
  const base = calculateTripFinancials(trip, costs);
  const p = Math.max(0, people);
  const revenue = p * trip.pricePerPerson;
  const totalCost = base.totalFixed + base.totalTeam + base.variableUnit * p;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const costPerPerson = p > 0 ? (base.totalFixed + base.totalTeam) / p + base.variableUnit : 0;
  return {
    people: p,
    revenue,
    totalCost,
    profit,
    margin,
    costPerPerson,
    breakEven: base.breakEven,
    breakEvenReached: p >= base.breakEven,
  };
}

// Tipos y constantes financieras compartidas entre Costos (viajes.$tripId) y Finanzas.
// Esta es la única fuente de verdad para tipos de costo, monedas y conversión a USD.

export type TripStatus = "planificando" | "abierto" | "completo" | "en_curso" | "cerrado";
export type CostCategory = "fijo" | "variable" | "equipo" | "no_incluido";
export type Currency = "USD" | "MXN" | "EUR" | "MAD" | "IDR" | "COP" | "PEN" | "ARS" | "THB";
export type PaymentStatus = "pendiente" | "parcial" | "pagado";
export type InstallmentStatus = "pendiente" | "parcial" | "pagado";
/**
 * @deprecated Se mantiene solo para compatibilidad de seeds y firmas viejas.
 * El modelo nuevo (v2) permite cualquier número de cuotas vía CRUD manual.
 */
export type InstallmentCount = 1 | 3 | 4 | 6;
export type DiscountType = "early_bird" | "group" | "manual";
export type DiscountMode = "percent" | "fixed";
/**
 * Modalidad de pago de la viajera.
 * - "completo": un único pago (1 cuota equivalente al total).
 * - "cuotas": pagos divididos en N cuotas editables manualmente.
 * Default cuando no está definido: derivar de installments.length (1 = completo, >1 = cuotas).
 */
export type PaymentMode = "completo" | "cuotas";

export interface Discount {
  type: DiscountType;
  mode: DiscountMode;
  /** Si mode=percent: 0-100. Si mode=fixed: monto en USD. */
  value: number;
  notes?: string;
}

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  early_bird: "Early Bird",
  group: "Descuento por grupo",
  manual: "Descuento manual",
};

/**
 * Calcula el monto del descuento (en USD) a partir del precio base.
 * Acotado entre 0 y basePrice.
 */
export function computeDiscountAmount(basePrice: number, discount: Discount | null | undefined): number {
  if (!discount || basePrice <= 0) return 0;
  const raw =
    discount.mode === "percent"
      ? (basePrice * Math.max(0, discount.value)) / 100
      : Math.max(0, discount.value);
  return Math.min(basePrice, Math.round(raw * 100) / 100);
}

/** Precio final = base - descuento (mínimo 0). */
export function computeFinalPrice(basePrice: number, discount: Discount | null | undefined): number {
  return Math.max(0, Math.round((basePrice - computeDiscountAmount(basePrice, discount)) * 100) / 100);
}

/**
 * Método con el que la viajera realizó el pago.
 * - "stripe" (y futuros gateways) puede llevar comisión absorbida por la
 *   organizadora; los demás métodos no tienen fee.
 */
export type PaymentMethod = "transferencia" | "efectivo" | "tarjeta" | "stripe" | "otro";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  stripe: "Stripe",
  otro: "Otro",
};

/**
 * Métodos que pueden tener comisión absorbida por la organizadora.
 * - "stripe": presets fijos (doméstica/internacional) o personalizado.
 * - "otro": comisión libre con descripción (ej: MercadoPago, PayPal, otra pasarela).
 */
export function methodSupportsFee(method: PaymentMethod | undefined): boolean {
  return method === "stripe" || method === "otro";
}

export interface InstallmentPayment {
  id: string;
  /** BRUTO — monto pagado por la viajera (USD, > 0). */
  amount: number;
  paidAt: string;     // ISO date YYYY-MM-DD
  notes?: string;
  /** Default "transferencia" si no está presente (datos viejos). */
  method?: PaymentMethod;
  /** Comisión porcentual aplicada (ej 2.9, 4.4). Solo si method genera fee. */
  feePercent?: number;
  /** Comisión fija aplicada en USD (ej 0.30). Solo si method genera fee. */
  feeFixed?: number;
  /**
   * Descripción libre asociada al pago/método (ej "MercadoPago 4.99%",
   * "Banco Galicia · CBU 1234", "Stripe ref #abc"). Disponible para cualquier
   * método; se muestra como subtítulo en la columna Método de pago.
   */
  feeDescription?: string;
  /** Comisión total en USD = amount * pct/100 + fixed. Calculado al guardar. */
  feeAmount?: number;
  /** Monto neto recibido por la organizadora = amount - feeAmount. */
  netAmount?: number;
}

/**
 * Calcula la comisión y el neto de un pago. Para métodos sin fee o sin datos
 * de comisión, devuelve `feeAmount=0` y `netAmount=amount`.
 */
export function computePaymentNet(
  amount: number,
  method: PaymentMethod | undefined,
  feePercent: number | undefined,
  feeFixed: number | undefined,
): { feeAmount: number; netAmount: number } {
  if (!methodSupportsFee(method)) {
    return { feeAmount: 0, netAmount: Math.round(amount * 100) / 100 };
  }
  const pct = Math.max(0, feePercent ?? 0);
  const fixed = Math.max(0, feeFixed ?? 0);
  const fee = Math.round(((amount * pct) / 100 + fixed) * 100) / 100;
  const capped = Math.min(fee, Math.max(0, amount));
  const net = Math.round((amount - capped) * 100) / 100;
  return { feeAmount: capped, netAmount: net };
}

/** Helper: lee el neto de un pago ya persistido (con fallback a amount). */
export function paymentNetAmount(p: InstallmentPayment): number {
  if (typeof p.netAmount === "number") return p.netAmount;
  return p.amount;
}

/** Helper: lee la comisión de un pago ya persistido (con fallback a 0). */
export function paymentFeeAmount(p: InstallmentPayment): number {
  return typeof p.feeAmount === "number" ? p.feeAmount : 0;
}

/**
 * @deprecated (modelo v1). Reducción aplicada a una cuota por sobrepago de
 * una cuota anterior. En v2 esto se reemplaza por el ajuste directo de la
 * última cuota pendiente. La migración v1→v2 colapsa estas reducciones en
 * el `amount` vigente y descarta el array.
 */
export interface InstallmentReduction {
  id: string;
  fromInstallmentId: string;
  fromPaymentId: string;
  amount: number;
  appliedAt: string;
}

export interface Installment {
  id: string;
  /** ISO date YYYY-MM-DD */
  dueDate: string;
  /** Monto vigente a cobrar (puede haberse ajustado manual o automáticamente). */
  amount: number;
  /**
   * Monto contractual original. Solo presente si el `amount` fue ajustado
   * (manual o automáticamente por sobrepago/faltante de otra cuota).
   * Sirve para mostrar "↑/↓ desde $X" en la UI.
   */
  originalAmount?: number;
  /**
   * @deprecated (modelo v1). Reducciones por excedente. La migración v1→v2
   * las colapsa en `amount` y borra este campo.
   */
  reductions?: InstallmentReduction[];
  status: InstallmentStatus;
  paidAt?: string; // ISO date when status === "pagado" (fecha del último abono que la completó)
  /** Abonos parciales recibidos. Suma puede ser < amount mientras status="parcial". */
  payments?: InstallmentPayment[];
}

export interface ItineraryDay {
  day: number;
  title: string;
  description: string;
  activities: string[];
  /** Ciudad o destino donde ocurre este día. Útil en viajes multidestino. */
  city?: string;
}

export interface CostItem {
  id: string;
  /**
   * Texto plano derivado de `descriptionNodes` cuando existe. Sirve para
   * búsqueda, export y compat con datos antiguos. NO editar directo si
   * `descriptionNodes` está definido — se sobreescribe al normalizar.
   */
  description: string;
  /**
   * Nodos estructurados (texto + chips de tag). Cuando está definido es la
   * fuente de verdad; `description` se recalcula a partir de estos nodos.
   * Ausente = descripción legacy en texto plano.
   */
  descriptionNodes?: import("./tags").DescriptionNode[];
  notes: string;
  category: CostCategory;
  amount: number;
  currency: Currency;
  amountUSD: number;
  perPerson: boolean;
  itineraryDay: number | null;
  /** @deprecated Usar startTime. Se conserva para compatibilidad con datos antiguos. */
  time?: string;
  startTime?: string;
  endTime?: string;
  createdAt: number;
  /**
   * Marca el costo como borrador / incompleto (sin monto definido).
   * Cuando `isDraft` es true, `amount` y `amountUSD` deben ser 0 y el costo
   * NO participa en ningún cálculo financiero. Al completar el monto (>= 0)
   * el flag se limpia y el costo entra en los totales.
   * Diferencia "monto vacío" (isDraft=true) de "monto 0" (isDraft ausente/false).
   */
  isDraft?: boolean;
  /**
   * Indica si el ítem está incluido en el paquete del viaje. Sirve para
   * filtrar rápido en la tabla del itinerario qué está o no está incluido.
   * Ausente = incluido (default), para no romper costos históricos.
   */
  included?: boolean;
  /**
   * Marca el costo como "pinneado" para destacarlo y filtrarlo rápido en la
   * tabla (recordatorio de algo pendiente / a revisar). Ausente = no pinneado.
   */
  isPinned?: boolean;
  // ── Trazabilidad de conversión (v2) ─────────────────────────────
  // Snapshots persistidos al momento de guardar el costo. La conversión
  // NO se recalcula en cada render: `convertedAmount` es la fuente de
  // verdad en moneda base. Al cambiar la tasa del viaje, los costos ya
  // cargados conservan estos valores salvo recálculo explícito.
  /** Monto tal cual lo ingresó la organizadora, en su moneda original. */
  originalAmount?: number;
  /** Moneda en la que se ingresó el monto original. */
  originalCurrency?: Currency;
  /** Moneda base del viaje al momento de guardar el costo (snapshot). */
  baseCurrency?: Currency;
  /** Tasa aplicada: unidades de moneda base por 1 unidad de moneda original. */
  rateUsed?: number;
  /** Monto convertido a moneda base al momento de guardar (persistido). */
  convertedAmount?: number;
}

// ─── Cancelación / participación parcial ─────────────────────
export type EnrolleeStatus = "activa" | "cancelada";
export type RefundType = "total" | "parcial" | "ninguna";
export type ParticipationMode = "completa" | "parcial";
export type ParticipationKind = "dias" | "tramo";

/** Regla de devolución por viaje. */
export interface RefundRule {
  id: string;
  /** Días antes del inicio del viaje a partir del cual aplica. */
  daysBefore: number;
  /** Porcentaje a devolver (0-100). */
  percent: number;
  notes?: string;
}

export interface Cancellation {
  cancelledAt: string;          // ISO date
  refundType: RefundType;
  /** Monto sugerido por la política configurada al momento de cancelar (USD). */
  suggestedRefund: number;
  /** Monto que efectivamente se devolvió (USD). Editable manualmente. */
  refundedAmount: number;
  /** Monto retenido por la organizadora = pagado - devuelto (USD). */
  retainedAmount: number;
  /** Regla aplicada (snapshot) si la hubo. */
  appliedRuleId?: string;
  notes?: string;
}

export interface Participation {
  mode: ParticipationMode;
  kind?: ParticipationKind;        // si parcial
  /** Días incluidos (si kind='dias'). */
  daysIncluded?: number;
  totalDays?: number;
  /** Etiqueta del tramo/destino (si kind='tramo'). */
  segmentLabel?: string;
  /** Override manual de precio final (USD). Si está, prevalece sobre el cálculo proporcional. */
  manualPrice?: number;
}

export type AuditAction =
  | "inscripcion"
  | "plan_creado"
  | "plan_reemplazado"
  | "cuota_pagada"
  | "cuota_revertida"
  | "cuota_editada"
  | "abono_registrado"
  | "abono_revertido"
  | "descuento_aplicado"
  | "descuento_editado"
  | "descuento_removido"
  | "participacion_aplicada"
  | "participacion_editada"
  | "participacion_removida"
  | "cancelacion"
  | "reactivacion"
  | "contacto_editado"
  | "nota_editada"
  | "sobrepago_devuelto"
  | "sobrepago_credito"
  | "credito_aplicado"
  | "credito_reservado"
  | "credito_recibido"
  | "credito_revertido"
  | "extra_creado"
  | "extra_editado"
  | "extra_eliminado"
  | "extra_pagado"
  | "extra_pago_revertido"
  | "logistica_editada"
  | "adjunto_agregado"
  | "adjunto_eliminado";

export interface AuditEntry {
  id: string;
  /** ISO timestamp when the change happened. */
  at: string;
  action: AuditAction;
  /** Short human-readable summary. */
  summary: string;
  /** Optional details/diff (free-form key/value). */
  details?: Record<string, string | number | null | undefined>;
}

export interface Enrollee {
  id: string;
  name: string;
  email: string;
  phone: string;
  enrolledAt: string;
  basePrice?: number;
  discount?: Discount | null;
  totalDue: number;
  installments: Installment[];
  /** Estado de la viajera. Default: 'activa'. */
  status?: EnrolleeStatus;
  /** Datos de cancelación (solo si status='cancelada'). */
  cancellation?: Cancellation | null;
  /** Participación en el viaje. Default: completa. */
  participation?: Participation | null;
  /** Notas operativas libres (alergias, dieta, contactos, comentarios). */
  notes?: string;
  /** Historial cronológico de cambios (más reciente al final). */
  auditLog?: AuditEntry[];
  /**
   * Modalidad de pago (modelo v2). Si no está definida, se deriva:
   * `installments.length <= 1` → "completo", caso contrario "cuotas".
   */
  paymentMode?: PaymentMode;
  /**
   * Sobrepago no asignado (USD). Surge cuando un pago excede el saldo total
   * y la última cuota pendiente ya no puede absorber más (o no hay cuotas).
   * Se resuelve manualmente: devolver o dejar como crédito.
   */
  overpayment?: number;
  /**
   * Si la organizadora reconoció el sobrepago como crédito a favor de la
   * viajera, se silencia el banner pero el monto sigue visible en métricas.
   * Se resetea cuando `overpayment` cambia (nuevo sobrepago = nuevo aviso).
   */
  overpaymentAcknowledged?: boolean;
  /**
   * Saldo pendiente sin cuota asignada (USD). Surge cuando un abono cubre
   * menos que la cuota objetivo y NO hay otra cuota pendiente posterior
   * que pueda absorber el faltante. Permanece visible hasta que se cree
   * una nueva cuota o se ajuste manualmente.
   */
  unassignedBalance?: number;
  /**
   * Créditos a favor recibidos desde otros viajes (sobrepagos transferidos).
   * Cada entrada reduce el `totalDue` efectivo de esta inscripción al ser
   * aplicada por la organizadora desde la viajera origen.
   */
  appliedCredits?: AppliedCredit[];
  /**
   * Si la viajera tiene un sobrepago acknowledged y la organizadora eligió
   * "reservar para próximo viaje", se setea este campo. Cuando esa misma
   * persona (matching por email) sea inscrita en otro viaje, el crédito se
   * aplica automáticamente al destino y este campo se limpia.
   */
  reservedCreditForFutureTrip?: { amount: number; reservedAt: string };
  /**
   * Servicios adicionales contratados por la viajera (tours, experiencias,
   * upgrades). COMPLETAMENTE separados del sistema de cuotas del viaje base:
   * cada extra tiene su propio precio, costo de proveedor, profit y pagos.
   */
  extras?: Extra[];
  /**
   * Logística de la viajera: boletos de avión (ida/vuelta), seguro de viaje
   * y archivos adjuntos (tarjetas de seguro, boletos, pasaporte).
   */
  logistics?: EnrolleeLogistics;
}

/** Un tramo aéreo (ida o vuelta) de una viajera. */
export interface FlightSegment {
  airline?: string;
  flightNumber?: string;
  bookingCode?: string;
  fromAirport?: string;
  toAirport?: string;
  /** ISO datetime local ("2026-09-01T14:30"). */
  departAt?: string;
  arriveAt?: string;
  /** Escalas en texto libre (ej. "Panamá 2h"). */
  stops?: string;
  terminal?: string;
  baggage?: string;
  notes?: string;
}

/** Datos del seguro de viaje de una viajera. */
export interface InsuranceInfo {
  hasInsurance?: boolean;
  provider?: string;
  policyNumber?: string;
  /** ISO date (YYYY-MM-DD). */
  validFrom?: string;
  validTo?: string;
  notes?: string;
}

export type AttachmentKind = "boleto_ida" | "boleto_vuelta" | "seguro" | "pasaporte" | "otro";

/** Archivo adjunto de una viajera guardado en el bucket privado del viaje. */
export interface EnrolleeAttachment {
  id: string;
  kind: AttachmentKind;
  title: string;
  storagePath: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface EnrolleeLogistics {
  outbound?: FlightSegment;
  inbound?: FlightSegment;
  insurance?: InsuranceInfo;
  attachments?: EnrolleeAttachment[];
}


/**
 * Crédito aplicado a la inscripción de una viajera, originado en el sobrepago
 * de OTRA inscripción (puede ser la misma persona en otro viaje, o la misma
 * inscripción si fuera un caso de reasignación interna). Se modela como un
 * registro inmutable (auditable) que descuenta del `totalDue` del destino.
 */
export interface AppliedCredit {
  id: string;
  /** Monto aplicado en USD (> 0). */
  amount: number;
  /** Viaje donde se originó el sobrepago. */
  sourceTripId: string;
  /** Snapshot del nombre del viaje origen al momento de aplicar. */
  sourceTripName: string;
  /** Inscripción origen (puede pertenecer a otra viajera con el mismo email). */
  sourceEnrolleeId: string;
  /** Snapshot del nombre de la viajera origen. */
  sourceEnrolleeName: string;
  /** ISO timestamp. */
  appliedAt: string;
  /** Notas opcionales. */
  notes?: string;
}

/**
 * Cuota de un Extra. Modelo simple: monto, fecha de vencimiento y status.
 * No soporta fees (Stripe) ni abonos parciales; cada cuota se marca como
 * pagada de una sola vez.
 */
export interface ExtraInstallment {
  id: string;
  /** Monto BRUTO a cobrar / cobrado (USD, ≥ 0). */
  amount: number;
  /** Fecha de vencimiento, ISO YYYY-MM-DD. */
  dueDate: string;
  /** Estado de la cuota. */
  status: "pendiente" | "pagado";
  /** Fecha del pago efectivo (ISO YYYY-MM-DD). Solo si status="pagado". */
  paidAt?: string;
  /** Método de pago. Default "transferencia". */
  method?: PaymentMethod;
  /** Notas libres asociadas al pago. */
  notes?: string;
  /** Comisión porcentual aplicada (ej 2.9, 4.4). Solo si method genera fee. */
  feePercent?: number;
  /** Comisión fija aplicada en USD (ej 0.30). Solo si method genera fee. */
  feeFixed?: number;
  /** Descripción libre asociada al método/pago (ej "Stripe Internacional"). */
  feeDescription?: string;
  /** Comisión total en USD = amount * pct/100 + fixed. Calculado al pagar. */
  feeAmount?: number;
  /** Monto neto recibido por la organizadora = amount - feeAmount. */
  netAmount?: number;
}

/** Helper: lee el neto de una cuota de extra (con fallback a amount). */
export function extraInstallmentNet(inst: ExtraInstallment): number {
  if (inst.status !== "pagado") return 0;
  if (typeof inst.netAmount === "number") return inst.netAmount;
  return inst.amount;
}

/** Helper: lee la comisión de una cuota de extra (con fallback a 0). */
export function extraInstallmentFee(inst: ExtraInstallment): number {
  if (inst.status !== "pagado") return 0;
  return typeof inst.feeAmount === "number" ? inst.feeAmount : 0;
}

/**
 * @deprecated Modelo viejo de pagos libres del Extra. Reemplazado por
 * `ExtraInstallment` en v6. Se mantiene el tipo solo para que la migración
 * pueda leer datos persistidos antiguos.
 */
export interface ExtraPayment {
  id: string;
  amount: number;
  paidAt: string;
  notes?: string;
  method?: PaymentMethod;
}

/** Modalidad de pago de un Extra. */
export type ExtraPaymentMode = "unico" | "cuotas";

/**
 * Servicio adicional al viaje base (tour, experiencia, upgrade).
 * Modelo INDEPENDIENTE del plan del viaje: tiene su propio precio, costo de
 * proveedor (para profit) y plan de cuotas. No afecta `totalDue`.
 *
 * - "unico": el extra tiene exactamente 1 cuota con todo el monto.
 * - "cuotas": N cuotas editables, cada una con su dueDate y status.
 */
export interface Extra {
  id: string;
  /** Nombre del extra (ej: "Tour Petra", "Upgrade habitación"). */
  name: string;
  /** Fecha límite global del extra (ISO YYYY-MM-DD). En "unico" suele
   *  coincidir con la dueDate de la única cuota; en "cuotas" sirve como
   *  metadata operativa (fecha del servicio). Opcional. */
  date?: string;
  /** Precio total que paga la viajera (USD, ≥ 0). Debe igualar la suma de cuotas. */
  price: number;
  /** Costo del proveedor (USD, ≥ 0). Profit = price - cost. */
  cost: number;
  /** Modalidad de pago. */
  paymentMode: ExtraPaymentMode;
  /** Plan de cuotas. Para "unico" siempre tiene length=1. */
  installments: ExtraInstallment[];
  /** ISO timestamp de creación. */
  createdAt: string;
  /**
   * @deprecated Se mantiene solo para datos pre-v6 sin migrar todavía. No usar.
   */
  payments?: ExtraPayment[];
}

/** Suma BRUTA pagada de un extra (cuotas con status="pagado", monto bruto). */
export function extraPaidAmount(extra: Extra): number {
  const sum = (extra.installments ?? []).reduce(
    (s, i) => s + (i.status === "pagado" ? i.amount : 0),
    0,
  );
  return Math.min(extra.price, Math.round(sum * 100) / 100);
}

/** Suma NETA pagada de un extra (bruto − fees). Para reportes de cobrado. */
export function extraPaidNet(extra: Extra): number {
  const sum = (extra.installments ?? []).reduce(
    (s, i) => s + extraInstallmentNet(i),
    0,
  );
  return Math.round(sum * 100) / 100;
}

/** Suma de comisiones absorbidas en cuotas pagadas del extra. */
export function extraTotalFees(extra: Extra): number {
  const sum = (extra.installments ?? []).reduce(
    (s, i) => s + extraInstallmentFee(i),
    0,
  );
  return Math.round(sum * 100) / 100;
}

/** Saldo pendiente de un extra (bruto − pagado bruto). */
export function extraRemainingAmount(extra: Extra): number {
  return Math.max(0, Math.round((extra.price - extraPaidAmount(extra)) * 100) / 100);
}

/** Profit de un extra = price − cost − fees absorbidas. */
export function extraProfit(extra: Extra): number {
  return Math.round((extra.price - extra.cost - extraTotalFees(extra)) * 100) / 100;
}

/** Estado derivado:
 *  - "pagado": todas las cuotas pagadas (o saldo ≈ 0).
 *  - "vencido": existe alguna cuota pendiente con dueDate < hoy.
 *  - "pendiente": resto de los casos (al menos una cuota pendiente sin vencer).
 */
export function extraStatus(extra: Extra): "pagado" | "pendiente" | "vencido" {
  if (extraRemainingAmount(extra) <= 0.005) return "pagado";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasOverdue = (extra.installments ?? []).some(
    (i) => i.status === "pendiente" && new Date(i.dueDate) < today,
  );
  return hasOverdue ? "vencido" : "pendiente";
}

/** Atajo: ¿el extra está vencido? */
export function extraIsOverdue(extra: Extra): boolean {
  return extraStatus(extra) === "vencido";
}

/** Próxima fecha relevante del extra (primera cuota pendiente, o fallback al `date`). */
export function extraNextDueDate(extra: Extra): string | undefined {
  const next = (extra.installments ?? [])
    .filter((i) => i.status === "pendiente")
    .map((i) => i.dueDate)
    .sort()[0];
  return next ?? extra.date;
}


// ─── Proveedores ─────────────────────────────────────────────
export type ProviderCategory =
  | "alojamiento"
  | "transporte"
  | "guia"
  | "actividad"
  | "comida"
  | "otro";

export type ProviderStatus = "pendiente" | "contactado" | "confirmado" | "pagado";

export interface Provider {
  id: string;
  name: string;
  category: ProviderCategory;
  status: ProviderStatus;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  reservationCode?: string;
  serviceDate?: string;
  notes?: string;
  /**
   * @deprecated Usar `linkedCostIds`. Se conserva para compatibilidad con
   * datos antiguos en los que un proveedor tenía un único costo vinculado.
   */
  linkedCostId?: string | null;
  /**
   * Referencias opcionales a múltiples CostItem. Sirve cuando un proveedor
   * nos brinda varios servicios (p.ej. Mestizaje = 3 tours). Los montos
   * siguen viviendo en la tabla de Costos; acá sólo se referencian.
   */
  linkedCostIds?: string[];
  createdAt: number;
}

/**
 * Devuelve los IDs de costos vinculados a un proveedor, unificando el
 * campo legacy `linkedCostId` con el nuevo array `linkedCostIds`.
 */
export function getProviderLinkedCostIds(p: Provider): string[] {
  const set = new Set<string>();
  if (p.linkedCostIds) for (const id of p.linkedCostIds) if (id) set.add(id);
  if (p.linkedCostId) set.add(p.linkedCostId);
  return Array.from(set);
}

export interface TripData {
  id: string;
  name: string;
  destination: string;
  /** País del viaje (opcional). */
  country?: string;
  /** True cuando el viaje cubre varios destinos. */
  isMultiDestination?: boolean;
  /** Lista de destinos cuando isMultiDestination = true. */
  destinations?: string[];
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  capacity: number;
  enrolled: number;
  pricePerPerson: number;
  /**
   * Moneda base del viaje (default legacy: USD). Sirve como referencia
   * para todos los `convertedAmount` de los costos y para el `pricePerPerson`.
   * Cambiarla es una acción destructiva: requiere confirmación y
   * opcionalmente recalcular costos ya cargados.
   */
  currency: string;
  /**
   * @deprecated Alias legacy. Usar `currency` como moneda base del viaje.
   * Se mantiene en el tipo solo para no romper compatibilidad; los helpers
   * `getTripBaseCurrency()` y `getTripLocalCurrency()` son la fuente única.
   */
  baseCurrency?: Currency;
  /**
   * Moneda local del destino (opcional). Se sugiere al crear el viaje a
   * partir del país; solo afecta el default de nuevos costos. Cambiarla no
   * altera costos ya cargados.
   */
  localCurrency?: Currency;
  /**
   * Tasa de cambio activa del viaje: unidades de moneda base por 1 unidad
   * de moneda local. Ej: base=USD, local=MXN, exchangeRate=0.058 → 1 MXN
   * equivale a 0.058 USD. Se usa como sugerencia para nuevos costos; los
   * costos ya cargados guardan su propia `rateUsed`.
   */
  exchangeRate?: number;
  /** Timestamp ISO de la última actualización de `exchangeRate`. */
  exchangeRateUpdatedAt?: string;
  coverGradient: string;
  /**
   * Foto de portada del viaje. Puede ser:
   * - Un path del storage privado con prefijo `storage:` (ej. `storage:{uid}/{tripId}/1234.jpg`)
   * - Una URL externa (http/https) pegada por la usuaria.
   * - `null` / `undefined` cuando no hay foto → se usa `coverGradient` como fallback.
   */
  coverImage?: string | null;

  itinerary: ItineraryDay[];
  costs: CostItem[];
  enrollees: Enrollee[];
  /** Reglas de devolución específicas de este viaje. */
  refundRules?: RefundRule[];
  /** Proveedores del viaje (hoteles, transporte, guías, etc.). */
  providers?: Provider[];
  // ─── Papelera / soft-delete ────────────────────────────────────
  /** True si el viaje está en la papelera (soft delete). */
  isDeleted?: boolean;
  /** Timestamp ISO en que se movió a la papelera. */
  deletedAt?: string;
  /** Timestamp ISO en que se eliminará definitivamente (default: deletedAt + 7 días). */
  purgeAt?: string;

  // ─── Tags de descripción (itinerario) ──────────────────────────
  /** Catálogo de tags disponibles en este viaje. */
  tags?: import("./tags").TripTag[];
  /**
   * Marca que `tags` ya fue inicializado (aunque sea a []). Distingue entre
   * "nunca sembrado" (undefined) y "usuaria borró todos los tags" ([]).
   */
  tagsInitialized?: boolean;
}


export const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  MXN: 0.058,
  EUR: 1.09,
  MAD: 0.10,
  IDR: 0.000063,
  COP: 0.00024,
  PEN: 0.27,
  ARS: 0.00094,
  THB: 0.028,
};

export const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "USD", label: "USD" },
  { value: "MXN", label: "MXN" },
  { value: "EUR", label: "EUR" },
  { value: "MAD", label: "MAD" },
  { value: "IDR", label: "IDR" },
  { value: "COP", label: "COP" },
  { value: "PEN", label: "PEN" },
  { value: "ARS", label: "ARS" },
  { value: "THB", label: "THB" },
];

export function toUSD(amount: number, currency: Currency): number {
  return Math.round(amount * EXCHANGE_RATES[currency] * 100) / 100;
}

// ─── Multimoneda: helpers de trazabilidad ────────────────────────

/** Devuelve la moneda base efectiva del viaje. Fallback: USD. */
export function getTripBaseCurrency(trip: Pick<TripData, "currency" | "baseCurrency">): Currency {
  const raw = (trip.baseCurrency ?? (trip.currency as Currency) ?? "USD") as Currency;
  return (EXCHANGE_RATES[raw] != null ? raw : "USD");
}

/** Devuelve la moneda local del viaje si está configurada. */
export function getTripLocalCurrency(trip: Pick<TripData, "localCurrency">): Currency | null {
  const raw = trip.localCurrency;
  if (!raw) return null;
  return EXCHANGE_RATES[raw] != null ? raw : null;
}

/**
 * Convierte un monto entre dos monedas usando la tasa del viaje si aplica al
 * par local↔base, y si no la tabla `EXCHANGE_RATES` (vía USD como pivot).
 * Nunca devuelve NaN: si algún dato falta, cae al monto original.
 */
export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  trip?: Pick<TripData, "currency" | "baseCurrency" | "localCurrency" | "exchangeRate">,
): { amount: number; rate: number } {
  if (!Number.isFinite(amount)) return { amount: 0, rate: 1 };
  if (from === to) return { amount: Math.round(amount * 100) / 100, rate: 1 };
  const base = trip ? getTripBaseCurrency(trip) : "USD";
  const local = trip ? getTripLocalCurrency(trip) : null;
  const tripRate = trip?.exchangeRate;
  // Caso 1: local → base con tasa del viaje.
  if (tripRate && local && from === local && to === base) {
    const rate = tripRate;
    return { amount: Math.round(amount * rate * 100) / 100, rate };
  }
  // Caso 2: base → local con tasa del viaje (inversa).
  if (tripRate && local && from === base && to === local && tripRate > 0) {
    const rate = 1 / tripRate;
    return { amount: Math.round(amount * rate * 100) / 100, rate };
  }
  // Caso 3: cross via USD usando la tabla estática.
  const fromUsd = EXCHANGE_RATES[from] ?? 1;
  const toUsd = EXCHANGE_RATES[to] ?? 1;
  const rate = toUsd > 0 ? fromUsd / toUsd : 1;
  return { amount: Math.round(amount * rate * 100) / 100, rate };
}

/**
 * Genera el paquete de trazabilidad para un `CostItem` a partir del monto
 * original ingresado y la moneda elegida. Si el costo es draft (sin monto),
 * devuelve `null` en todos los campos de conversión.
 */
export function buildCostConversion(
  originalAmount: number | null,
  originalCurrency: Currency,
  trip: Pick<TripData, "currency" | "baseCurrency" | "localCurrency" | "exchangeRate">,
): {
  amount: number;
  currency: Currency;
  amountUSD: number;
  originalAmount?: number;
  originalCurrency?: Currency;
  baseCurrency?: Currency;
  rateUsed?: number;
  convertedAmount?: number;
} {
  if (originalAmount == null || !Number.isFinite(originalAmount)) {
    // Draft: sin datos de conversión.
    return { amount: 0, currency: originalCurrency, amountUSD: 0 };
  }
  const base = getTripBaseCurrency(trip);
  const { amount: converted, rate } = convertAmount(originalAmount, originalCurrency, base, trip);
  // `amountUSD` legacy = convertido a USD (para no romper cálculos que
  // asumen USD). Coincide con `convertedAmount` cuando base=USD.
  const amountUSD =
    base === "USD" ? converted : convertAmount(originalAmount, originalCurrency, "USD", trip).amount;
  return {
    amount: originalAmount,
    currency: originalCurrency,
    amountUSD,
    originalAmount,
    originalCurrency,
    baseCurrency: base,
    rateUsed: rate,
    convertedAmount: converted,
  };
}

// ─── Sugerencia de moneda por país/destino ───────────────────────
// Mapa concentrado en países frecuentes en viajes grupales. Cubre ~90% de
// los destinos habituales; el resto queda en USD y la organizadora puede
// editar libremente.
const COUNTRY_CURRENCY_MAP: Record<string, Currency> = {
  argentina: "ARS",
  mexico: "MXN",
  "méxico": "MXN",
  peru: "PEN",
  "perú": "PEN",
  colombia: "COP",
  espana: "EUR",
  "españa": "EUR",
  spain: "EUR",
  francia: "EUR",
  france: "EUR",
  italia: "EUR",
  italy: "EUR",
  alemania: "EUR",
  germany: "EUR",
  portugal: "EUR",
  grecia: "EUR",
  greece: "EUR",
  holanda: "EUR",
  netherlands: "EUR",
  irlanda: "EUR",
  ireland: "EUR",
  austria: "EUR",
  belgica: "EUR",
  "bélgica": "EUR",
  marruecos: "MAD",
  morocco: "MAD",
  indonesia: "IDR",
  bali: "IDR",
  "estados unidos": "USD",
  eeuu: "USD",
  usa: "USD",
  "united states": "USD",
};

/**
 * Sugiere una moneda local a partir de país o destino en texto libre.
 * Devuelve null si no hay match confiable.
 */
export function suggestLocalCurrency(country?: string, destination?: string): Currency | null {
  const candidates = [country, destination]
    .flatMap((s) => (s ? s.split(/[·,;/|]/) : []))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const c of candidates) {
    if (COUNTRY_CURRENCY_MAP[c]) return COUNTRY_CURRENCY_MAP[c];
    // Match parcial: "bali, indonesia" → "indonesia".
    for (const key of Object.keys(COUNTRY_CURRENCY_MAP)) {
      if (c.includes(key)) return COUNTRY_CURRENCY_MAP[key];
    }
  }
  return null;
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Formatea un monto en la moneda indicada. Si la moneda no es soportada por
 * Intl (raro; nuestro set son códigos ISO estándar), cae a `formatUSD`.
 */
export function formatMoney(n: number, currency: Currency | string | undefined | null): string {
  const cur = (currency ?? "USD") as string;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return formatUSD(n);
  }
}

/**
 * Devuelve el monto de un costo expresado en la moneda BASE actual del viaje.
 * Esta es la fuente única para totales, utilidad y punto de equilibrio.
 *
 * Reglas:
 * - Draft → 0 (no participa en cálculos).
 * - `convertedAmount` + `baseCurrency` presentes y coinciden con la base
 *   actual del viaje → se usa el snapshot tal cual (no se recalcula).
 * - `convertedAmount` presente pero snapshot en OTRA base → se reconvierte
 *   el snapshot de la base histórica a la base actual (respeta la tasa que
 *   se usó al guardar el costo, sólo cambia la unidad de reporte).
 * - Sin snapshot pero con `originalAmount`/`originalCurrency` → convierte
 *   con la tasa vigente del viaje.
 * - Fallback legacy: si la base actual es USD, usa `amountUSD` (compat total
 *   con viajes previos a la migración multimoneda).
 * - Último recurso: convierte `amount` + `currency` a la base actual.
 */
export function costBaseAmount(
  cost: CostItem,
  trip: Pick<TripData, "currency" | "baseCurrency" | "localCurrency" | "exchangeRate">,
): number {
  if (cost.isDraft) return 0;
  const tripBase = getTripBaseCurrency(trip);
  // Snapshot en la misma base → uso directo.
  if (
    typeof cost.convertedAmount === "number" &&
    cost.baseCurrency &&
    cost.baseCurrency === tripBase
  ) {
    return Math.round(cost.convertedAmount * 100) / 100;
  }
  // Snapshot en otra base → reconvierto respetando el snapshot.
  if (typeof cost.convertedAmount === "number" && cost.baseCurrency) {
    const { amount } = convertAmount(cost.convertedAmount, cost.baseCurrency, tripBase, trip);
    return amount;
  }
  // Con original explícito y sin snapshot → convierto con tasa vigente.
  if (typeof cost.originalAmount === "number" && cost.originalCurrency) {
    const { amount } = convertAmount(cost.originalAmount, cost.originalCurrency, tripBase, trip);
    return amount;
  }
  // Fallback legacy USD-céntrico (mantiene comportamiento de viajes viejos).
  if (tripBase === "USD" && typeof cost.amountUSD === "number") {
    return Math.round(cost.amountUSD * 100) / 100;
  }
  // Último recurso: usar amount/currency crudos.
  if (typeof cost.amount === "number" && cost.currency) {
    const { amount } = convertAmount(cost.amount, cost.currency, tripBase, trip);
    return amount;
  }
  return 0;
}

export function generateId(): string {
  // La tabla `trips` usa columna uuid; otros ids también aceptan uuid.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 improvisado.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

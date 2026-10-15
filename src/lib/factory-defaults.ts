// Valores por defecto de fábrica para plantillas de cuenta.
// Se usan cuando el usuario nunca configuró sus propios defaults.
import type {
  RefundRule,
  PaymentMethod,
  CostCategory,
} from "./finance-types";

export interface PaymentMethodFeeDefault {
  feePercent: number;
  feeFixed: number;
  feeDescription: string;
}

export type PaymentMethodFeeDefaults = Partial<
  Record<PaymentMethod, PaymentMethodFeeDefault>
>;

export interface CostPreset {
  id: string;
  description: string;
  category: CostCategory;
  notes: string;
  defaultAmount?: number;
}

export interface ExtraPreset {
  id: string;
  name: string;
  suggestedPrice?: number;
  suggestedCost?: number;
  notes?: string;
}

export interface AccountDefaults {
  refundRules: RefundRule[];
  paymentMethodFees: PaymentMethodFeeDefaults;
  costPresets: CostPreset[];
  extraPresets: ExtraPreset[];
}

const uid = () => `d_${Math.random().toString(36).slice(2, 10)}`;

export const FACTORY_REFUND_RULES: RefundRule[] = [
  { id: uid(), daysBefore: 90, percent: 80, notes: "Más de 90 días antes del viaje" },
  { id: uid(), daysBefore: 60, percent: 50, notes: "Entre 60 y 90 días" },
  { id: uid(), daysBefore: 30, percent: 25, notes: "Entre 30 y 60 días" },
  { id: uid(), daysBefore: 0, percent: 0, notes: "Menos de 30 días: sin reembolso" },
];

export const FACTORY_PAYMENT_METHOD_FEES: PaymentMethodFeeDefaults = {
  stripe: { feePercent: 3.6, feeFixed: 0.3, feeDescription: "Stripe internacional" },
  otro: { feePercent: 4.99, feeFixed: 0, feeDescription: "Pasarela digital" },
};

export const FACTORY_COST_PRESETS: CostPreset[] = [
  { id: uid(), description: "Alojamiento", category: "fijo", notes: "Hotel / riad / hospedaje" },
  { id: uid(), description: "Traslado de llegada aeropuerto", category: "fijo", notes: "Transfer aeropuerto → alojamiento" },
  { id: uid(), description: "Comida incluida", category: "variable", notes: "Desayunos / cenas grupales incluidas" },
  { id: uid(), description: "Actividad / Tour", category: "variable", notes: "Entradas, guías locales, experiencias" },
];

export const FACTORY_EXTRA_PRESETS: ExtraPreset[] = [
  { id: uid(), name: "Tour opcional", notes: "Excursión no incluida en el paquete" },
  { id: uid(), name: "Upgrade de habitación", notes: "Habitación individual o superior" },
  { id: uid(), name: "Experiencia gastronómica", notes: "Cena especial / clase de cocina" },
  { id: uid(), name: "Traslado privado", notes: "Aeropuerto o transfers extras" },
  { id: uid(), name: "Sesión de fotos", notes: "Fotógrafa profesional en destino" },
];

export const FACTORY_DEFAULTS: AccountDefaults = {
  refundRules: FACTORY_REFUND_RULES,
  paymentMethodFees: FACTORY_PAYMENT_METHOD_FEES,
  costPresets: FACTORY_COST_PRESETS,
  extraPresets: FACTORY_EXTRA_PRESETS,
};

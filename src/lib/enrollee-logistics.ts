// Helpers de presentación y estado para la logística de viajeras
// (vuelos ida/vuelta, seguro de viaje y archivos adjuntos).

import type {
  AttachmentKind,
  Enrollee,
  FlightSegment,
  InsuranceInfo,
} from "./finance-types";

export const ATTACHMENT_KIND_LABELS: Record<AttachmentKind, string> = {
  boleto_ida: "Boleto ida",
  boleto_vuelta: "Boleto vuelta",
  seguro: "Seguro",
  pasaporte: "Pasaporte",
  otro: "Otro",
};

export const ATTACHMENT_KINDS: AttachmentKind[] = [
  "boleto_ida",
  "boleto_vuelta",
  "seguro",
  "pasaporte",
  "otro",
];

export function hasFlightData(f: FlightSegment | undefined | null): boolean {
  if (!f) return false;
  return Object.values(f).some((v) => typeof v === "string" && v.trim() !== "");
}

/** Etiqueta corta: "AV 245" o la aerolínea si no hay número. */
export function flightLabel(f: FlightSegment | undefined | null): string {
  if (!hasFlightData(f)) return "";
  const airline = f?.airline?.trim() ?? "";
  const num = f?.flightNumber?.trim() ?? "";
  return [airline, num].filter(Boolean).join(" ") || "Vuelo registrado";
}

export function routeLabel(f: FlightSegment | undefined | null): string {
  const from = f?.fromAirport?.trim() ?? "";
  const to = f?.toAirport?.trim() ?? "";
  if (!from && !to) return "";
  return `${from || "—"} → ${to || "—"}`;
}

export function formatFlightDateTime(value: string | undefined | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDateShort(value: string | undefined | null): string {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00`);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export type InsuranceState = "sin_seguro" | "ok" | "cobertura_incompleta" | "sin_vigencia";

export function insuranceState(
  ins: InsuranceInfo | undefined | null,
  tripStart?: string | null,
  tripEnd?: string | null,
): InsuranceState {
  if (!ins?.hasInsurance) return "sin_seguro";
  if (!ins.validFrom && !ins.validTo) return "sin_vigencia";
  if (!tripStart && !tripEnd) return "ok";
  const from = ins.validFrom ? new Date(`${ins.validFrom}T00:00:00`) : null;
  const to = ins.validTo ? new Date(`${ins.validTo}T23:59:59`) : null;
  const start = tripStart ? new Date(`${tripStart}T00:00:00`) : null;
  const end = tripEnd ? new Date(`${tripEnd}T23:59:59`) : null;
  if (from && start && from > start) return "cobertura_incompleta";
  if (to && end && to < end) return "cobertura_incompleta";
  return "ok";
}

export const INSURANCE_STATE_LABELS: Record<InsuranceState, string> = {
  sin_seguro: "Sin seguro",
  ok: "Con seguro",
  cobertura_incompleta: "Cobertura incompleta",
  sin_vigencia: "Sin vigencia",
};

/** Avisos suaves de fechas de vuelo vs. fechas del viaje. */
export function flightDateWarning(
  f: FlightSegment | undefined | null,
  leg: "outbound" | "inbound",
  tripStart?: string | null,
  tripEnd?: string | null,
): string | null {
  if (!f) return null;
  if (leg === "outbound" && f.departAt && tripStart) {
    const dep = new Date(f.departAt);
    const start = new Date(`${tripStart}T23:59:59`);
    if (!isNaN(dep.getTime()) && dep > start) {
      return "La salida de ida es posterior al inicio del viaje.";
    }
  }
  if (leg === "inbound" && f.departAt && tripEnd) {
    const dep = new Date(f.departAt);
    const end = new Date(`${tripEnd}T00:00:00`);
    if (!isNaN(dep.getTime()) && dep < end) {
      return "El regreso sale antes de que termine el viaje.";
    }
  }
  return null;
}

export interface LogisticsProgress {
  total: number;
  withOutbound: number;
  withInbound: number;
  withInsurance: number;
  insuranceIssues: number;
}

export function logisticsProgress(
  enrollees: Enrollee[],
  tripStart?: string | null,
  tripEnd?: string | null,
): LogisticsProgress {
  let withOutbound = 0;
  let withInbound = 0;
  let withInsurance = 0;
  let insuranceIssues = 0;
  for (const e of enrollees) {
    const l = e.logistics;
    if (hasFlightData(l?.outbound)) withOutbound++;
    if (hasFlightData(l?.inbound)) withInbound++;
    const st = insuranceState(l?.insurance, tripStart, tripEnd);
    if (st !== "sin_seguro") withInsurance++;
    if (st === "cobertura_incompleta") insuranceIssues++;
  }
  return { total: enrollees.length, withOutbound, withInbound, withInsurance, insuranceIssues };
}

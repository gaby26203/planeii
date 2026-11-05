// Backfill de multimoneda, sin dependencias del store: lo usan la hidratación del cliente y el
// servidor al comparar el viaje guardado con el que llega.

import {
  EXCHANGE_RATES,
  getTripBaseCurrency,
  suggestLocalCurrency,
  type TripData,
} from "./finance-types";

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

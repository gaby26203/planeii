// Modo presentación para la demo guiada: mientras está activo, la app solo muestra los viajes
// marcados como vitrina (`TripData.showcase`), que tienen viajeras ficticias. Es un filtro de
// lectura: nunca cambia ni enmascara datos, así que no hay riesgo de guardar un dato falso
// encima de uno real. Se recuerda por navegador.

import { useMemo } from "react";
import { create } from "zustand";
import type { TripData } from "@/lib/finance-types";

const STORAGE_KEY = "planeii-presentation-mode";

function readStored(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface PresentationModeState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const usePresentationMode = create<PresentationModeState>()((set) => ({
  enabled: readStored(),
  setEnabled: (enabled) => {
    try {
      if (enabled) window.localStorage.setItem(STORAGE_KEY, "1");
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* sin almacenamiento: el modo dura hasta recargar */
    }
    set({ enabled });
  },
}));

export function isShowcaseTrip(trip: Pick<TripData, "showcase"> | null | undefined): boolean {
  return trip?.showcase === true;
}

/** Todos los viajes, o solo los vitrina en modo presentación. Devuelve el mismo objeto si no filtra. */
export function filterVisibleTrips(
  trips: Record<string, TripData>,
  presenting: boolean,
): Record<string, TripData> {
  if (!presenting) return trips;
  return Object.fromEntries(Object.entries(trips).filter(([, trip]) => isShowcaseTrip(trip)));
}

export function useVisibleTrips(trips: Record<string, TripData>): Record<string, TripData> {
  const presenting = usePresentationMode((s) => s.enabled);
  return useMemo(() => filterVisibleTrips(trips, presenting), [trips, presenting]);
}

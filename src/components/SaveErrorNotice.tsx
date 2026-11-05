// Aviso global de errores de guardado automático y de carga de viajes.
//
// Antes el error quedaba en el store sin que nadie lo mostrara y el cambio se perdía al recargar.
// Ahora un aviso fijo explica qué pasó, ofrece reintentar y, mientras hay un cambio sin guardar,
// el navegador pide confirmación antes de cerrar o recargar la página.

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { saveTripNow, useTripsStore } from "@/lib/trips-store";

const SAVE_TOAST = "trip-save-error";
const LOAD_TOAST = "trip-load-error";

export function SaveErrorNotice() {
  const saveError = useTripsStore((s) => s.saveError);
  const tripName = useTripsStore((s) =>
    s.saveError ? s.trips[s.saveError.tripId]?.name : undefined,
  );
  const loadError = useTripsStore((s) => s.loadError);
  const showedSaveError = useRef(false);

  useEffect(() => {
    if (saveError) {
      showedSaveError.current = true;
      const { tripId, message } = saveError;
      toast.error(
        tripName
          ? `No se guardó el último cambio de "${tripName}"`
          : "No se guardó el último cambio",
        {
          id: SAVE_TOAST,
          description: `${message} Si recargas o cierras la página, ese cambio se pierde.`,
          duration: Infinity,
          action: { label: "Reintentar", onClick: () => void saveTripNow(tripId).catch(() => {}) },
        },
      );
    } else if (showedSaveError.current) {
      showedSaveError.current = false;
      toast.success("Cambios guardados", { id: SAVE_TOAST, duration: 3000 });
    }
  }, [saveError, tripName]);

  useEffect(() => {
    if (!saveError) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveError]);

  useEffect(() => {
    if (!loadError) {
      toast.dismiss(LOAD_TOAST);
      return;
    }
    toast.error("No se pudieron cargar tus viajes", {
      id: LOAD_TOAST,
      description: loadError,
      duration: Infinity,
      action: {
        label: "Reintentar",
        onClick: () => void useTripsStore.getState().hydrateFromSupabase({ force: true }),
      },
    });
  }, [loadError]);

  return null;
}

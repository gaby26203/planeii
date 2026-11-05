// Piezas de interfaz del modo presentación (ver src/lib/presentation-mode.ts): la barra que avisa
// que está activo y el bloqueo de las pantallas que no se muestran en la demo.

import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isShowcaseTrip, usePresentationMode } from "@/lib/presentation-mode";
import { useTripsStore } from "@/lib/trips-store";

/** Rutas que listan personas reales y no se muestran en modo presentación. */
const HIDDEN_PATHS = ["/accesos"];

export function PresentationBanner() {
  const enabled = usePresentationMode((s) => s.enabled);
  const setEnabled = usePresentationMode((s) => s.setEnabled);
  if (!enabled) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 bg-primary/10 px-4 py-2 text-sm text-foreground"
    >
      <span className="flex items-center gap-2">
        <MonitorPlay className="h-4 w-4 text-primary" />
        <span>
          <span className="font-medium">Modo presentación.</span> Solo se muestran los viajes
          vitrina.
        </span>
      </span>
      <Button size="sm" variant="outline" className="h-7" onClick={() => setEnabled(false)}>
        Salir
      </Button>
    </div>
  );
}

/**
 * En modo presentación reemplaza la pantalla por un aviso cuando la ruta es de un viaje que no
 * es vitrina o de una sección con datos de personas reales.
 */
export function PresentationGuard({ children }: { children: ReactNode }) {
  const enabled = usePresentationMode((s) => s.enabled);
  const setEnabled = usePresentationMode((s) => s.setEnabled);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tripId = useRouterState({
    select: (s) =>
      s.matches.map((m) => (m.params as { tripId?: string }).tripId).find(Boolean) ?? null,
  });
  const hydrated = useTripsStore((s) => s.hydrated);
  const trip = useTripsStore((s) => (tripId ? s.trips[tripId] : undefined));

  if (!enabled) return <>{children}</>;
  const hiddenSection = HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // Antes de cargar los viajes no hay datos que mostrar: la pantalla queda en su estado de carga.
  const hiddenTrip = !!tripId && hydrated && !isShowcaseTrip(trip);
  if (!hiddenSection && !hiddenTrip) return <>{children}</>;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <Card className="mx-auto max-w-lg">
        <CardContent className="space-y-4 p-6 text-center">
          <MonitorPlay className="mx-auto h-8 w-8 text-primary" />
          <div>
            <h1 className="font-display text-lg font-semibold">
              No disponible en modo presentación
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {hiddenTrip
                ? "Este viaje no es vitrina, así que queda oculto durante la demo."
                : "Esta sección muestra datos de personas reales y queda oculta durante la demo."}
            </p>
          </div>
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button asChild>
              <Link to="/">Ir a los viajes vitrina</Link>
            </Button>
            <Button variant="outline" onClick={() => setEnabled(false)}>
              Salir del modo presentación
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

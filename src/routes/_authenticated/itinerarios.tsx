import { createFileRoute } from "@tanstack/react-router";
import { AccessGate } from "@/components/AccessGate";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/itinerarios")({
  component: () => (<AccessGate can="canSeeGlobalOps"><ItinerariosPage /></AccessGate>),
});

function ItinerariosPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8 w-full">
      <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-2">
        Itinerarios
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Arma y gestiona los itinerarios día a día de cada viaje.
      </p>
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60">
        <CalendarDays className="h-12 w-12 mb-3" />
        <p className="text-sm">Selecciona un viaje para ver su itinerario</p>
      </div>
    </div>
  );
}

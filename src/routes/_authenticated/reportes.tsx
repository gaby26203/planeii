import { createFileRoute } from "@tanstack/react-router";
import { AccessGate } from "@/components/AccessGate";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reportes")({
  component: () => (<AccessGate can="canSeeGlobalReportes"><ReportesPage /></AccessGate>),
});

function ReportesPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8 w-full">
      <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-2">
        Reportes
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Exportaciones en PDF y Excel, análisis de rentabilidad.
      </p>
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60">
        <BarChart3 className="h-12 w-12 mb-3" />
        <p className="text-sm">Próximamente</p>
      </div>
    </div>
  );
}

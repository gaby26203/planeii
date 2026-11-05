import { Users, UserCheck } from "lucide-react";

/**
 * Indica de forma visual sobre qué número base se calculó una cifra.
 * - "capacity": planificado (VIAJERAS del viaje).
 * - "enrolled": viajeras inscriptas reales (dinero real).
 */
export type Basis = "capacity" | "enrolled" | "mixed";

const CONFIG: Record<
  Basis,
  { label: string; short: string; className: string; Icon: typeof Users; help: string }
> = {
  capacity: {
    label: "Planificado",
    short: "Cap.",
    className:
      "bg-blue/10 text-blue border border-blue/30",
    Icon: Users,
    help: "Calculado sobre VIAJERAS (capacidad planificada).",
  },
  enrolled: {
    label: "Real",
    short: "Insc.",
    className: "bg-chart-3/10 text-chart-3 border border-chart-3/30",
    Icon: UserCheck,
    help: "Calculado sobre viajeras inscriptas reales.",
  },
  mixed: {
    label: "Mixto",
    short: "Mix",
    className: "bg-muted text-muted-foreground border border-border",
    Icon: Users,
    help: "Combina costos planificados con ingresos reales.",
  },
};

export function BasisPill({
  basis,
  count,
  compact = false,
  className = "",
}: {
  basis: Basis;
  count?: number;
  compact?: boolean;
  className?: string;
}) {
  const c = CONFIG[basis];
  const Icon = c.Icon;
  const label = compact ? c.short : c.label;
  const title =
    count != null ? `${c.help} (${count} viajera${count === 1 ? "" : "s"})` : c.help;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-medium leading-none ${c.className} ${className}`}
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
      <span>{label}</span>
      {count != null && <span className="tabular-nums opacity-80">·{count}</span>}
    </span>
  );
}

export function BasisLegend({
  capacity,
  enrolled,
  className = "",
}: {
  capacity: number;
  enrolled: number;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground ${className}`}
    >
      <span>Base de cálculo:</span>
      <BasisPill basis="capacity" count={capacity} />
      <span className="opacity-60">costos y por persona</span>
      <span className="opacity-40">·</span>
      <BasisPill basis="enrolled" count={enrolled} />
      <span className="opacity-60">ingresos y utilidad</span>
    </div>
  );
}

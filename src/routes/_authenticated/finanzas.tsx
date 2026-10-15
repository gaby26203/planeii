import { createFileRoute, Link } from "@tanstack/react-router";
import { AccessGate } from "@/components/AccessGate";
import { useState, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Wallet,
  Database,
  Pencil,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type CostCategory,
  type CostItem,
  type TripData,
  costBaseAmount,
  formatMoney,
  formatUSD,
  getTripBaseCurrency,
} from "@/lib/finance-types";
import { useTripsStore, useTripsRecord } from "@/lib/trips-store";
import { aggregateEnrollees, calculateTripFinancials, isOverdue } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/finanzas")({
  component: () => (
    <AccessGate can="canSeeGlobalFinanzas">
      <FinanzasPage />
    </AccessGate>
  ),
});

const categoryConfig: Record<CostCategory, { label: string; color: string; description: string }> = {
  fijo: { label: "Fijo", color: "bg-primary/10 text-primary", description: "Costo que no cambia con la cantidad de viajeras (ej. transporte grupal, guía, hospedaje base)." },
  variable: { label: "Variable", color: "bg-chart-3/15 text-chart-3", description: "Costo que se multiplica por la cantidad de viajeras. Mientras el viaje está en planificación se usa VIAJERAS (capacidad); al cerrarlo pasa a usar las inscriptas reales." },
  equipo: { label: "Equipo", color: "bg-terracotta/15 text-terracotta", description: "Gasto asignado al equipo/guías del viaje. No se reparte ni se cobra a las viajeras." },
  no_incluido: { label: "No incluido", color: "bg-muted text-muted-foreground border border-dashed", description: "Gasto estimado que cada viajera cubre por su cuenta. No entra en el precio del paquete ni en la utilidad." },
};

function CategoryBadge({ cat }: { cat: (typeof categoryConfig)[CostCategory] }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <Badge className={`${cat.color} border-0 text-[11px]`}>{cat.label}</Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center leading-snug">
          <p>{cat.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function FinanzasPage() {
  const tripsRecord = useTripsRecord();
  // Derivamos la lista para el selector con useMemo: estable mientras
  // tripsRecord no cambie de referencia (Zustand garantiza referencia estable).
  const tripsList = useMemo(
    () =>
      Object.values(tripsRecord).map((t) => ({
        id: t.id,
        name: t.name,
      })),
    [tripsRecord],
  );
  const defaultTripId = tripsList[0]?.id ?? "";
  const [selectedTripIdRaw, setSelectedTripId] = useState<string>("");
  // Derivamos el id efectivo en lugar de sincronizar con un effect (evita loops).
  const selectedTripId = selectedTripIdRaw || defaultTripId;

  // Lee del store: única fuente de verdad
  const trip = useTripsStore((s) => (selectedTripId ? s.trips[selectedTripId] : undefined));

  // Cálculos centralizados — mismos que en /viajes/$tripId
  const c = useMemo(
    () => (trip ? calculateTripFinancials(trip, trip.costs) : null),
    [trip],
  );
  // Ingresos reales = cuotas pagadas (única fuente de verdad)
  const payments = useMemo(
    () => (trip ? aggregateEnrollees(trip.enrollees, trip.pricePerPerson) : null),
    [trip],
  );
  
  // Calcular cuotas vencidas
  const overdueCount = useMemo(() => {
    if (!trip) return 0;
    let count = 0;
    for (const e of trip.enrollees) {
      for (const i of e.installments) {
        if (i.status === "pendiente" && isOverdue(i)) count++;
      }
    }
    return count;
  }, [trip]);

  // Créditos a favor (global): tres estados separados.
  // - Disponibles: overpayment reconocido (acknowledged), aún no destinado.
  // - Reservados: marcados para aplicar al próximo viaje (reservedCreditForFutureTrip).
  // - Aplicados: ya descontados del totalDue de un viaje destino (appliedCredits[]),
  //   agrupados por viaje DESTINO (donde se recibió el crédito).
  const credits = useMemo(() => {
    type EnrolleeRow = { id: string; name: string; amount: number };
    type TripGroup = { tripId: string; tripName: string; total: number; enrollees: EnrolleeRow[] };
    const availableByTrip: TripGroup[] = [];
    const reservedByTrip: TripGroup[] = [];
    const appliedByTrip: TripGroup[] = [];
    let availableTotal = 0;
    let reservedTotal = 0;
    let appliedTotal = 0;
    let availableCount = 0;
    let reservedCount = 0;
    let appliedCount = 0;

    for (const t of Object.values(tripsRecord)) {
      const avail: EnrolleeRow[] = [];
      const reserv: EnrolleeRow[] = [];
      const appl: EnrolleeRow[] = [];
      let availTrip = 0;
      let reservTrip = 0;
      let applTrip = 0;
      for (const e of t.enrollees) {
        // Disponibles
        const amt = e.overpayment ?? 0;
        if (amt > 0.005 && e.overpaymentAcknowledged) {
          avail.push({ id: e.id, name: e.name, amount: amt });
          availTrip += amt;
          availableCount++;
        }
        // Reservados (origen del crédito)
        const reserved = e.reservedCreditForFutureTrip?.amount ?? 0;
        if (reserved > 0.005) {
          reserv.push({ id: e.id, name: e.name, amount: reserved });
          reservTrip += reserved;
          reservedCount++;
        }
        // Aplicados (destino del crédito recibido)
        const received = (e.appliedCredits ?? []).reduce((s, c) => s + c.amount, 0);
        if (received > 0.005) {
          appl.push({ id: e.id, name: e.name, amount: received });
          applTrip += received;
          appliedCount++;
        }
      }
      if (avail.length > 0) {
        avail.sort((a, b) => b.amount - a.amount);
        availableByTrip.push({ tripId: t.id, tripName: t.name, total: availTrip, enrollees: avail });
        availableTotal += availTrip;
      }
      if (reserv.length > 0) {
        reserv.sort((a, b) => b.amount - a.amount);
        reservedByTrip.push({ tripId: t.id, tripName: t.name, total: reservTrip, enrollees: reserv });
        reservedTotal += reservTrip;
      }
      if (appl.length > 0) {
        appl.sort((a, b) => b.amount - a.amount);
        appliedByTrip.push({ tripId: t.id, tripName: t.name, total: applTrip, enrollees: appl });
        appliedTotal += applTrip;
      }
    }
    availableByTrip.sort((a, b) => b.total - a.total);
    reservedByTrip.sort((a, b) => b.total - a.total);
    appliedByTrip.sort((a, b) => b.total - a.total);
    return {
      available: { byTrip: availableByTrip, total: availableTotal, count: availableCount },
      reserved: { byTrip: reservedByTrip, total: reservedTotal, count: reservedCount },
      applied: { byTrip: appliedByTrip, total: appliedTotal, count: appliedCount },
    };
  }, [tripsRecord]);

  if (!trip || !c || !payments) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No hay viajes disponibles.</p>
      </div>
    );
  }

  const costs = trip.costs;

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Finanzas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Costos, rentabilidad y punto de equilibrio por viaje.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Select value={selectedTripId} onValueChange={setSelectedTripId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar viaje" />
            </SelectTrigger>
            <SelectContent>
              {tripsList.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Source of truth banner */}
      <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="h-3.5 w-3.5 text-primary" />
          <span>
            Datos sincronizados desde la sección{" "}
            <span className="font-medium text-foreground">Costos</span> del viaje ·
            cualquier cambio se refleja aquí en tiempo real
          </span>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 text-xs shrink-0">
          <Link to="/viajes/$tripId" params={{ tripId: trip.id }} hash="costos">
            <Pencil className="h-3 w-3" />
            Editar costos
          </Link>
        </Button>
      </div>

      {/* Base de cálculo activa */}
      <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md border mb-3 ${c.projectionMode === "inscriptas" ? "bg-chart-3/10 border-chart-3/30 text-chart-3" : "bg-muted/50 border-border text-muted-foreground"}`}>
        <span className="font-medium">
          {c.projectionMode === "inscriptas" ? "Viaje cerrado ·" : "En planificación ·"}
        </span>
        <span>
          Costos por persona y variables calculados sobre{" "}
          <strong className="text-foreground">
            {c.projectionBasis} {c.projectionMode === "inscriptas" ? "inscripta" : "viajera"}{c.projectionBasis === 1 ? "" : "s"}
          </strong>
          {c.projectionMode === "inscriptas" ? " (inscriptas reales)" : " (capacidad planificada)"}.
        </span>
      </div>

      {/* KPI Cards principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPICard
          label={c.extrasCount > 0 ? "Costo total (con extras)" : "Costo total actual"}
          value={formatUSD(c.extrasCount > 0 ? c.totalCostWithExtras : c.totalCostActual)}
          sub={
            c.extrasCount > 0
              ? `Viaje ${formatUSD(c.totalCostActual)} + extras ${formatUSD(c.extrasCost)}`
              : `${c.activeCount} activas · max ${formatUSD(c.totalCostMax)}`
          }
          icon={DollarSign}
        />
        <KPICard
          label={c.extrasCount > 0 ? "Ingreso final" : "Ingreso neto"}
          value={formatUSD(c.revenueNet + c.extrasRevenue)}
          sub={
            c.extrasCount > 0
              ? `Viaje ${formatUSD(c.revenueNet)} + extras ${formatUSD(c.extrasRevenue)}`
              : c.revenueFees > 0
                ? `Bruto − comisión ${formatUSD(c.revenueFees)} − dev.`
                : "Cobrado − devoluciones"
          }
          icon={TrendingUp}
          highlight={c.revenueNet + c.extrasRevenue > 0}
        />
        <KPICard
          label={c.extrasCount > 0 ? "Utilidad final" : "Utilidad real"}
          value={formatUSD(c.extrasCount > 0 ? c.profitWithExtras : c.profitActual)}
          sub={
            c.extrasCount > 0
              ? `Viaje ${formatUSD(c.profitActual)} + extras ${formatUSD(c.extrasProfit)} · margen ${c.marginWithExtras.toFixed(0)}%`
              : `Margen: ${c.marginActual.toFixed(0)}%${c.revenueFees > 0 ? " · neto de comisiones" : ""}`
          }
          icon={TrendingUp}
          highlight={(c.extrasCount > 0 ? c.profitWithExtras : c.profitActual) > 0}
          warning={(c.extrasCount > 0 ? c.profitWithExtras : c.profitActual) < 0}
        />
        <KPICard
          label="Cuotas vencidas"
          value={overdueCount.toString()}
          sub={overdueCount > 0 ? "Requieren atención" : "Al día"}
          icon={AlertTriangle}
          warning={overdueCount > 0}
          highlight={overdueCount === 0}
        />
      </div>

      {/* Desglose de ingresos */}
      <Card className="mb-8 border-border/60">
        <CardContent className="p-5">
          <p className="text-sm font-medium text-foreground mb-1">Desglose de ingresos</p>
          <p className="text-xs text-muted-foreground mb-3">
            {c.cancelledCount > 0
              ? `${c.activeCount} viajeras activas · ${c.cancelledCount} cancelada${c.cancelledCount === 1 ? "" : "s"}`
              : `${c.activeCount} viajeras activas`}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MiniKpi label="Comprometido" value={formatUSD(c.revenueCommitted)} />
            <MiniKpi label="Bruto cobrado" value={formatUSD(c.revenueCollected)} tone="positive" />
            <MiniKpi
              label="Comisiones"
              value={c.revenueFees > 0 ? `−${formatUSD(c.revenueFees)}` : formatUSD(0)}
              tone={c.revenueFees > 0 ? "negative" : undefined}
            />
            <MiniKpi
              label="Devuelto"
              value={formatUSD(c.revenueRefunded)}
              tone={c.revenueRefunded > 0 ? "negative" : undefined}
            />
            <MiniKpi label="Ingreso neto" value={formatUSD(c.revenueNet)} tone="positive" />
          </div>
        </CardContent>
      </Card>

      {/* Extras: métricas separadas del viaje base. Solo aparece si hay extras. */}
      {c.extrasCount > 0 && (
        <Card className="mb-8 border-border/60 border-dashed">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-terracotta" />
                <div>
                  <p className="text-sm font-medium text-foreground">Extras del viaje</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tours, experiencias y upgrades · {c.extrasCount} extra{c.extrasCount === 1 ? "" : "s"} · independientes del viaje base
                  </p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                <Link to="/viajes/$tripId" params={{ tripId: trip.id }} hash="viajeras">
                  <Pencil className="h-3 w-3" /> Gestionar
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MiniKpi label="Cobrado en extras" value={formatUSD(c.extrasRevenue)} tone="positive" />
              <MiniKpi label="Profit de extras" value={formatUSD(c.extrasProfit)} tone={c.extrasProfit > 0 ? "positive" : undefined} />
              <MiniKpi label="Por cobrar" value={formatUSD(c.extrasPending)} tone={c.extrasPending > 0 ? "warning" : undefined} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cobranza real (deriva de cuotas pagadas en VIAJERAS) */}
      <Card className="mb-8 border-border/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">Cobranza real</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suma de cuotas pagadas por las viajeras · refleja caja real, no compromisos.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
              <Link to="/viajes/$tripId" params={{ tripId: trip.id }} hash="viajeras">
                <Pencil className="h-3 w-3" /> Gestionar pagos
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MiniKpi label="Total cobrado" value={formatUSD(payments.totalCollected)} tone="positive" />
            <MiniKpi label="Total por cobrar" value={formatUSD(payments.totalPending)} tone="warning" />
            <MiniKpi label="Pagos completos" value={`${payments.fullyPaid}/${payments.count}`} />
            <MiniKpi label="Con pagos pendientes" value={payments.withPending.toString()} />
            <MiniKpi 
              label="Cuotas vencidas" 
              value={overdueCount.toString()} 
              tone={overdueCount > 0 ? "negative" : undefined}
            />
          </div>
          {c.revenueActual > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>Avance de cobranza</span>
                <span className="tabular-nums">
                  {((payments.totalCollected / c.revenueActual) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-chart-3 transition-all"
                  style={{
                    width: `${Math.min(100, (payments.totalCollected / c.revenueActual) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profitability bar */}
      <Card className="mb-8 border-border/60">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-foreground">Desglose de rentabilidad (grupo completo)</p>
            <p className="text-sm text-muted-foreground">
              Utilidad máxima: <span className="font-semibold text-foreground">{formatUSD(c.profitMax)}</span>
              <span className="text-muted-foreground"> ({c.marginMax.toFixed(0)}%)</span>
            </p>
          </div>
          <div className="h-4 w-full rounded-full bg-secondary overflow-hidden flex">
            {c.revenueMax > 0 && (
              <>
                <div
                  className="h-full bg-primary/80 transition-all"
                  style={{ width: `${(c.totalFixed / c.revenueMax) * 100}%` }}
                  title="Costos fijos"
                />
                <div
                  className="h-full bg-chart-3/70 transition-all"
                  style={{ width: `${(c.totalVariableMax / c.revenueMax) * 100}%` }}
                  title="Costos variables"
                />
                <div
                  className="h-full bg-terracotta/70 transition-all"
                  style={{ width: `${(c.totalTeam / c.revenueMax) * 100}%` }}
                  title="Equipo"
                />
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary/80" /> Fijos {formatUSD(c.totalFixed)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-chart-3/70" /> Variables {formatUSD(c.variableUnit)}/persona
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-terracotta/70" /> Equipo {formatUSD(c.totalTeam)}
            </span>
            {c.extrasCost > 0 && (
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-terracotta" /> Costo de extras {formatUSD(c.extrasCost)}
              </span>
            )}
            {c.totalNotIncluded > 0 && (
              <span className="flex items-center gap-1.5">
                <Wallet className="h-3 w-3" /> No incluido ~{formatUSD(c.totalNotIncluded)}/persona
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Créditos a favor (global, no depende del viaje seleccionado) */}
      <Card className="mb-8 border-chart-3/30 bg-chart-3/[0.03]">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-start gap-2.5">
              <div className="rounded-md bg-chart-3/15 p-2">
                <CreditCard className="h-4 w-4 text-chart-3" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Créditos a favor</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sobrepagos reconocidos · separados en{" "}
                  <span className="font-medium text-foreground">Disponibles</span>,{" "}
                  <span className="font-medium text-foreground">Reservados</span> y{" "}
                  <span className="font-medium text-foreground">Aplicados</span> · visibilidad global.
                </p>
              </div>
            </div>
          </div>

          {/* Resumen 3 columnas: Disponibles · Reservados · Aplicados */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            {([
              { key: "available", label: "Disponibles", hint: "a devolver o aplicar", data: credits.available, tone: "text-chart-3", bg: "bg-chart-3/10 border-chart-3/30" },
              { key: "reserved", label: "Reservados", hint: "para próximo viaje", data: credits.reserved, tone: "text-primary", bg: "bg-primary/10 border-primary/30" },
              { key: "applied", label: "Aplicados", hint: "descontados en destino", data: credits.applied, tone: "text-terracotta", bg: "bg-terracotta/10 border-terracotta/30" },
            ] as const).map((s) => (
              <div key={s.key} className={`rounded-md border ${s.bg} px-3 py-2`}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                <p className={`text-lg font-bold tabular-nums ${s.tone}`}>{formatUSD(s.data.total)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {s.data.count} viajera{s.data.count === 1 ? "" : "s"} · {s.data.byTrip.length} viaje{s.data.byTrip.length === 1 ? "" : "s"} · {s.hint}
                </p>
              </div>
            ))}
          </div>

          <Tabs defaultValue="available" className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
              <TabsTrigger value="available" className="text-xs gap-1.5">
                Disponibles <Badge variant="secondary" className="h-4 px-1 text-[10px]">{credits.available.count}</Badge>
              </TabsTrigger>
              <TabsTrigger value="reserved" className="text-xs gap-1.5">
                Reservados <Badge variant="secondary" className="h-4 px-1 text-[10px]">{credits.reserved.count}</Badge>
              </TabsTrigger>
              <TabsTrigger value="applied" className="text-xs gap-1.5">
                Aplicados <Badge variant="secondary" className="h-4 px-1 text-[10px]">{credits.applied.count}</Badge>
              </TabsTrigger>
            </TabsList>

            {([
              { key: "available", data: credits.available, tone: "text-chart-3", emptyMsg: "Sin créditos disponibles. Cuando una viajera pague de más y elijas \"Dejar como crédito\", aparecerá aquí." },
              { key: "reserved", data: credits.reserved, tone: "text-primary", emptyMsg: "Sin créditos reservados. Usá \"Aplicar crédito → Reservar para próximo\" desde la tarjeta de viajera." },
              { key: "applied", data: credits.applied, tone: "text-terracotta", emptyMsg: "Sin créditos aplicados aún. Aparecerán acá los descuentos recibidos en cada viaje destino." },
            ] as const).map((tab) => (
              <TabsContent key={tab.key} value={tab.key} className="mt-3">
                {tab.data.byTrip.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/60 bg-background/50 px-3 py-4 text-center">
                    <p className="text-xs text-muted-foreground">{tab.emptyMsg}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tab.data.byTrip.map((tc) => (
                      <div
                        key={tc.tripId}
                        className="rounded-md border border-border/40 bg-background overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/40">
                          <Link
                            to="/viajes/$tripId"
                            params={{ tripId: tc.tripId }}
                            hash="viajeras"
                            className="text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            {tc.tripName}
                            <Pencil className="h-3 w-3 opacity-50" />
                          </Link>
                          <div className="text-right">
                            <span className={`text-sm font-semibold tabular-nums ${tab.tone}`}>
                              {formatUSD(tc.total)}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1.5">
                              ({tc.enrollees.length})
                            </span>
                          </div>
                        </div>
                        <ul className="divide-y divide-border/30">
                          {tc.enrollees.map((en) => (
                            <li
                              key={en.id}
                              className="flex items-center justify-between px-3 py-1.5 hover:bg-muted/20"
                            >
                              <span className="text-xs text-foreground truncate">{en.name}</span>
                              <span className={`text-xs font-semibold tabular-nums ${tab.tone} shrink-0`}>
                                {formatUSD(en.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Costs table with tabs (read-only view) */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-display">Detalle de costos</CardTitle>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/viajes/$tripId" params={{ tripId: trip.id }} hash="costos">
                <Pencil className="h-3.5 w-3.5" />
                Editar en Costos
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="todos">
            <TabsList className="mb-4 flex-wrap h-auto">
              <TabsTrigger value="todos">Todos ({costs.length})</TabsTrigger>
              <TabsTrigger value="fijo">
                Fijos ({costs.filter((c) => c.category === "fijo").length})
              </TabsTrigger>
              <TabsTrigger value="variable">
                Variables ({costs.filter((c) => c.category === "variable").length})
              </TabsTrigger>
              <TabsTrigger value="equipo">
                Equipo ({costs.filter((c) => c.category === "equipo").length})
              </TabsTrigger>
              <TabsTrigger value="no_incluido">
                No incluido ({costs.filter((c) => c.category === "no_incluido").length})
              </TabsTrigger>
            </TabsList>

            {(["todos", "fijo", "variable", "equipo", "no_incluido"] as const).map((tab) => (
              <TabsContent key={tab} value={tab}>
                <CostTable
                  costs={tab === "todos" ? costs : costs.filter((c) => c.category === tab)}
                  itinerary={trip.itinerary}
                  enrolled={trip.enrolled}
                  trip={trip}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  highlight,
  warning,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof DollarSign;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <Card className="border-border/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground/50" />
        </div>
        <p
          className={`text-xl font-bold tabular-nums ${
            warning ? "text-destructive" : highlight ? "text-primary" : "text-foreground"
          }`}
        >
          {value}
        </p>
        <p
          className={`text-xs mt-0.5 ${
            warning ? "text-destructive/70" : highlight ? "text-primary/70" : "text-muted-foreground"
          }`}
        >
          {sub}
        </p>
      </CardContent>
    </Card>
  );
}

function CostTable({
  costs,
  itinerary,
  enrolled,
  trip,
}: {
  costs: CostItem[];
  itinerary: { day: number; title: string }[];
  enrolled: number;
  trip: TripData;
}) {
  const baseCurrency = getTripBaseCurrency(trip);
  const variableBasis = trip.capacity;
  if (costs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/60">
        <DollarSign className="h-8 w-8 mb-2" />
        <p className="text-sm">Sin costos en esta categoría</p>
      </div>
    );
  }

  // Mismo orden que Costos: por día itinerario (sin asignar al final), luego por createdAt.
  const sorted = [...costs].sort((a, b) => {
    const da = a.itineraryDay ?? 9999;
    const db = b.itineraryDay ?? 9999;
    if (da !== db) return da - db;
    return a.createdAt - b.createdAt;
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-36 bg-terracotta/10 text-terracotta font-semibold">Día itinerario</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead className="hidden md:table-cell">Notas</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead className="text-right">Monto original</TableHead>
          <TableHead className="text-right">{baseCurrency}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((cost) => {
          const cat = categoryConfig[cost.category];
          const dayInfo =
            cost.itineraryDay != null ? itinerary.find((d) => d.day === cost.itineraryDay) : null;
          return (
            <TableRow key={cost.id} className={cost.itineraryDay == null ? "bg-muted/20" : ""}>
              <TableCell className="bg-terracotta/10">
                {cost.itineraryDay == null ? (
                  <span className="text-muted-foreground italic text-[11px]">General</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="text-terracotta text-[10px] font-bold">
                      Día {cost.itineraryDay}
                    </span>
                    {cost.time && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {cost.time}
                      </span>
                    )}
                  </span>
                )}
              </TableCell>
              <TableCell className="font-medium">
                {cost.description}
                {dayInfo && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 md:hidden">
                    {dayInfo.title}
                  </p>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {cost.notes || "—"}
              </TableCell>
              <TableCell>
                <CategoryBadge cat={cat} />
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {formatAmount(cost.amount)} {cost.currency}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {(() => { const b = costBaseAmount(cost, trip); return formatMoney(cost.perPerson ? b * variableBasis : b, baseCurrency); })()}
                {cost.perPerson && (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    ×{variableBasis}
                  </span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function MiniKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "warning" | "negative";
}) {
  const color =
    tone === "positive"
      ? "text-chart-3"
      : tone === "warning"
        ? "text-chart-4"
        : tone === "negative"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-background p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

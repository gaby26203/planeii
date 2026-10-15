import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  MapPin,
  Calendar,
  Users,
  TrendingUp,
  ArrowUpRight,
  Loader2,
  Sparkles,
  MoreVertical,
  Copy,
  Trash2,
  Inbox,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useTripsStore } from "@/lib/trips-store";
import { calculateTripFinancials } from "@/lib/finance";
import type { TripData, TripStatus } from "@/lib/finance-types";
import { NewTripDialog } from "@/components/NewTripDialog";
import { DeleteTripDialog, DuplicateTripDialog } from "@/components/TripActionsDialogs";
import { usePermissions } from "@/lib/access";
import { useTripCoverUrl } from "@/hooks/use-trip-cover-url";
import { InlineEditableTitle } from "@/components/trip-notes/InlineEditableTitle";
import { useNewApplicationsCount, useTripPageSlug } from "@/lib/application-alerts";





export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "Mis viajes · Planeii" },
    { name: "description", content: "Organizá tus viajes grupales, sus viajeras y su rentabilidad en Planeii." },
    { property: "og:title", content: "Mis viajes · Planeii" },
    { property: "og:description", content: "Gestioná tus viajes grupales y su operación en Planeii." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: TripsPage,
});

const statusConfig: Record<TripStatus, { label: string; className: string }> = {
  planificando: { label: "Planificando", className: "bg-muted text-muted-foreground" },
  abierto: { label: "Inscripciones abiertas", className: "bg-primary/10 text-primary" },
  completo: { label: "Grupo completo", className: "bg-chart-3/15 text-chart-3" },
  en_curso: { label: "En curso", className: "bg-chart-4/15 text-chart-4" },
  cerrado: { label: "Cerrado", className: "bg-secondary text-muted-foreground" },
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  // Las fechas se guardan como "AAAA-MM-DD" sin hora; parsear por partes en
  // hora local evita que UTC muestre el día anterior en zonas UTC negativas.
  const [y, m, day] = dateStr.slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return "—";
  const d = new Date(y, m - 1, day);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

interface TripCardData {
  id: string;
  name: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  capacity: number;
  enrolled: number;
  minGoal: number;
  revenue: number;
  currency: string;
  coverGradient: string;
  coverImage?: string | null;
  isDeleted?: boolean;
  deletedAt?: string;
  purgeAt?: string;
}

function toCardData(t: TripData): TripCardData {
  const fin = calculateTripFinancials(t, t.costs ?? []);
  const enrolled = (t.enrollees ?? []).filter((e) => !e.cancellation).length || t.enrolled || 0;
  return {
    id: t.id,
    name: t.name,
    destination: t.destination,
    startDate: t.startDate,
    endDate: t.endDate,
    status: t.status,
    capacity: t.capacity,
    enrolled,
    minGoal: fin.breakEven === Infinity ? 0 : fin.breakEven,
    revenue: fin.revenueCollected || fin.revenueCommitted || 0,
    currency: t.currency,
    coverGradient: t.coverGradient || "from-[oklch(0.45_0.05_60)] to-[oklch(0.30_0.03_60)]",
    coverImage: t.coverImage ?? null,
    isDeleted: t.isDeleted,
    deletedAt: t.deletedAt,
    purgeAt: t.purgeAt,
  };
}





function TripCard({ trip, canManage }: { trip: TripCardData; canManage: boolean }) {
  const status = statusConfig[trip.status];
  const occupancy = trip.capacity > 0 ? (trip.enrolled / trip.capacity) * 100 : 0;
  const metGoal = trip.minGoal > 0 && trip.enrolled >= trip.minGoal;
  const coverUrl = useTripCoverUrl(trip.coverImage);
  const updateTripMeta = useTripsStore((s) => s.updateTripMeta);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();
  const newApps = useNewApplicationsCount(trip.id);
  const pageSlug = useTripPageSlug(trip.id);

  const stopLink = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <Link
        to="/viajes/$tripId"
        params={{ tripId: trip.id }}
        className="block relative"
      >
        <Card className="group overflow-hidden border-border/60 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5">
          <div className="relative w-full aspect-[16/5] sm:aspect-[16/6] overflow-hidden">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={trip.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className={`absolute inset-0 h-full w-full bg-gradient-to-br ${trip.coverGradient}`} />
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/60 to-transparent" />
          </div>



          <CardContent className="p-4 sm:p-5">

            <div className="flex items-start justify-between mb-3 gap-2">
              <div className="space-y-1 flex-1 min-w-0">
                {canManage ? (
                  <div
                    onClick={stopLink}
                    onDoubleClick={stopLink}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <InlineEditableTitle
                      value={trip.name}
                      ariaLabel="Editar nombre del viaje"
                      inputClassName="font-display text-base font-semibold"
                      onSave={async (next: string) => {
                        await updateTripMeta(trip.id, { name: next });
                      }}
                      display={
                        <h3 className="font-display text-lg font-semibold text-foreground leading-tight truncate">
                          {trip.name}
                        </h3>
                      }
                    />
                  </div>
                ) : (
                  <h3 className="font-display text-lg font-semibold text-foreground leading-tight truncate">
                    {trip.name}
                  </h3>
                )}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{trip.destination || "Sin destino"}</span>
                </div>
              </div>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={stopLink}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 -mr-1 -mt-1 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Acciones del viaje"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44" onClick={stopLink}>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setDuplicateOpen(true);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => {
                        e.preventDefault();
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Badge className={`${status.className} border-0 font-medium text-[11px]`}>
                {status.label}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
              </span>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {trip.enrolled}/{trip.capacity} inscritas
                </span>
                {metGoal && (
                  <span className="text-[10px] font-medium text-primary">✓ Meta alcanzada</span>
                )}
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.min(occupancy, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Ingresos cobrados
                </p>
                <p className="text-base font-semibold text-foreground tabular-nums">
                  {formatCurrency(trip.revenue, trip.currency)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 text-primary hover:text-primary"
              >
                Ver detalle
                <ArrowUpRight className="h-3 w-3" />
              </Button>
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="relative h-8 flex-1 gap-1.5 text-xs"
                onClick={(e) => {
                  stopLink(e);
                  navigate({ to: "/viajes/$tripId/solicitudes", params: { tripId: trip.id } });
                }}
              >
                <Inbox className="h-3.5 w-3.5" /> Solicitudes
                {!!newApps.data && (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
                    aria-label={`${newApps.data} solicitud${newApps.data === 1 ? "" : "es"} nueva${newApps.data === 1 ? "" : "s"}`}
                  >
                    {newApps.data > 9 ? "9+" : newApps.data}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-1 gap-1.5 text-xs"
                disabled={!pageSlug.data}
                title={pageSlug.data ? "Abrir la página como la ve la viajera" : "Este viaje todavía no tiene página publicada"}
                onClick={(e) => {
                  stopLink(e);
                  if (pageSlug.data) window.open(`/v/${pageSlug.data}`, "_blank", "noopener");
                }}
              >
                <Globe className="h-3.5 w-3.5" /> Ver página
              </Button>
            </div>
          </CardContent>
        </Card>
      </Link>
      {canManage && (
        <>
          <DuplicateTripDialog
            tripId={trip.id}
            tripName={trip.name}
            open={duplicateOpen}
            onOpenChange={setDuplicateOpen}
          />
          <DeleteTripDialog
            tripId={trip.id}
            tripName={trip.name}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
          />
        </>
      )}
    </>
  );
}





function TripsPage() {
  const trips = useTripsStore((s) => s.trips);
  const hydrated = useTripsStore((s) => s.hydrated);
  const hydrating = useTripsStore((s) => s.hydrating);
  const { canCreateTrip } = usePermissions();

  const cards = useMemo(
    () => Object.values(trips).map(toCardData).filter((t) => !t.isDeleted),
    [trips],
  );
  const activeTrips = cards.filter((t) => t.status !== "cerrado");
  const pastTrips = cards.filter((t) => t.status === "cerrado");


  const totalEnrolled = cards.reduce((s, t) => s + t.enrolled, 0);
  const totalRevenue = cards.reduce((s, t) => s + t.revenue, 0);


  return (
    <div className="p-4 sm:p-6 md:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Mis viajes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeTrips.length} viaje{activeTrips.length !== 1 ? "s" : ""} activo
            {activeTrips.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canCreateTrip && (
          <div className="[&_button]:w-full sm:[&_button]:w-auto">
            <NewTripDialog />
          </div>
        )}
      </div>


      {!hydrated && hydrating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando viajes…
        </div>
      )}

      {hydrated && cards.length === 0 && (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="p-10 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">
                {canCreateTrip ? "Creá tu primer viaje" : "Todavía no tenés viajes asignados"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {canCreateTrip
                  ? "Empezá con los datos básicos y sumá costos, itinerario y viajeras a medida que planificás."
                  : "Tu cuenta está activa. Si abriste un enlace de invitación y no ves el viaje, verificá que hayas entrado con el mismo correo al que te la enviaron, o volvé a abrir el enlace."}
              </p>
            </div>
            {canCreateTrip && <NewTripDialog />}
          </CardContent>
        </Card>
      )}

      {cards.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Viajes activos", value: activeTrips.length.toString(), icon: TrendingUp },
              { label: "Inscritas total", value: totalEnrolled.toString(), icon: Users },
              {
                label: "Ingresos cobrados",
                value: formatCurrency(totalRevenue, "USD"),
                icon: TrendingUp,
              },
              { label: "Viajes cerrados", value: pastTrips.length.toString(), icon: Calendar },
            ].map((stat) => (
              <Card key={stat.label} className="border-border/40">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {stat.label}
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums truncate">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {activeTrips.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Activos
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} canManage={canCreateTrip} />
                ))}
              </div>
            </section>
          )}

          {pastTrips.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Cerrados
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pastTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} canManage={canCreateTrip} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

    </div>
  );
}


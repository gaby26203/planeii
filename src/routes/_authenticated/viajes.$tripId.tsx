import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { Globe, Inbox } from "lucide-react";
import { AccessGate } from "@/components/AccessGate";
import { supabase } from "@/integrations/supabase/client";
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Plus,
  Trash2,
  Mail,
  Phone,
  Route as RouteIcon,
  Building2,
  Package,
  Pencil,
  Check,
  X,
  Wallet,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Tag,
  AlertCircle,
  Ban,
  RotateCcw,
  Settings2,
  Split,
  History,
  CreditCard,
  RefreshCw,
  Search,
  MessageCircle,
  Copy,
  UserPlus,
  StickyNote,
  Pin,
  ArrowUpDown,
  Sparkles,
  Download,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  AlertTriangle,
  Clock,
  Coins,
  Undo2,
  Redo2,
  Loader2,
  CircleAlert,
  Plane,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  CURRENCIES,
  type AuditAction,
  type AuditEntry,
  type CostCategory,
  type CostItem,
  type Currency,
  type Discount,
  type DiscountMode,
  type DiscountType,
  type Enrollee,
  type Extra,
  type ExtraInstallment,
  type Installment,
  type InstallmentPayment,
  type InstallmentCount,
  type ItineraryDay,
  type Participation,
  type ParticipationKind,
  type PaymentStatus,
  type PaymentMethod,
  type RefundRule,
  type RefundType,
  type TripData,
  type TripStatus,
  DISCOUNT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  computeFinalPrice,
  computePaymentNet,
  methodSupportsFee,
  extraPaidAmount,
  extraRemainingAmount,
  extraProfit,
  extraTotalFees,
  extraStatus,
  
  formatUSD,
  formatMoney,
  costBaseAmount,
  generateId,
  toUSD,
  buildCostConversion,
  getTripBaseCurrency,
  getTripLocalCurrency,
  suggestLocalCurrency,
} from "@/lib/finance-types";
import { useTripsStore, useTripsRecord, saveTripNow } from "@/lib/trips-store";
import { usePermissions } from "@/lib/access";
import { TripMembersDialog } from "@/components/TripMembersDialog";
import { LogisticsTab } from "@/components/enrollees/LogisticsTab";
import { ProvidersTab } from "@/components/ProvidersTab";
import { useNewApplicationsCount } from "@/lib/application-alerts";
import { DeleteTripDialog, DuplicateTripDialog } from "@/components/TripActionsDialogs";
import { TripCoverPicker } from "@/components/TripCoverPicker";
import { isStoragePath, deleteTripCoverRef } from "@/lib/trip-cover-storage";
import { useTripCoverUrl } from "@/hooks/use-trip-cover-url";
import { useCostsHistory } from "@/hooks/use-costs-history";
import {
  useTripActivity,
  registerTripSection,
  clearTripSection,
} from "@/hooks/use-trip-activity";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exportTripPDF, exportTripXLSX } from "@/lib/trip-exports";

import {
  aggregateEnrollees,
  calculateTripFinancials,
  computeParticipationPrice,
  computeSuggestedRefund,
  deriveEnrolleeFinancials,
  getInstallmentPlanMismatch,
  generateInstallments,
  installmentPaidAmount,
  installmentRemaining,
  simulateScenario,
  isOverdue,
} from "@/lib/finance";

import { Progress } from "@/components/ui/progress";
import { NotesTab } from "@/components/trip-notes/NotesTab";
import { NotesSummaryHeader } from "@/components/trip-notes/NotesSummaryHeader";

import { CostNoteEditor, CostNoteDisplay } from "@/components/trip-notes/CostNoteEditor";
import { DescriptionEditor } from "@/components/itinerary/DescriptionEditor";
import { DescriptionRender } from "@/components/itinerary/DescriptionRender";
import { TagManagerDialog } from "@/components/itinerary/TagManagerDialog";
import { TagFilterBar } from "@/components/itinerary/TagFilterBar";
import { InlineEditableTitle } from "@/components/trip-notes/InlineEditableTitle";
import { useCommitOnClickOutside } from "@/hooks/use-commit-on-click-outside";
import {
  countRowsByTag,
  collectTagIds,
  nodesFromLegacyDescription,
  nodesToPlainText,
  seedDefaultTags,
  type DescriptionNode,
} from "@/lib/tags";

export const Route = createFileRoute("/_authenticated/viajes/$tripId")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? (search.tab as string) : undefined,
  }),
  component: TripDetailRoute,
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold mb-2">Viaje no encontrado</h1>
      <Link to="/" className="text-primary underline">
        Volver a mis viajes
      </Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    console.error("Trip detail error:", error);
    return (
      <div className="p-8 text-center space-y-3">
        <h1 className="text-2xl font-bold">Ocurrió un error al abrir el viaje</h1>
        <p className="text-sm text-muted-foreground">{(error as Error | undefined)?.message ?? "Error desconocido"}</p>
        <div className="flex justify-center gap-3">
          <button onClick={reset} className="text-primary underline">
            Reintentar
          </button>
          <Link to="/" className="text-primary underline">
            Volver a mis viajes
          </Link>
        </div>
      </div>
    );
  },
});

function TripDetailRoute() {
  const { tripId } = useParams({ from: "/_authenticated/viajes/$tripId" });
  return (
    <AccessGate can="canAccessTrip" tripId={tripId}>
      <TripDetailPage />
    </AccessGate>
  );
}

// ─── Config visual ────────────────────────────────────────────
const statusConfig: Record<TripStatus, { label: string; className: string }> = {
  planificando: { label: "Planificando", className: "bg-muted text-muted-foreground" },
  abierto: { label: "Inscripciones abiertas", className: "bg-primary/10 text-primary" },
  completo: { label: "Grupo completo", className: "bg-chart-3/15 text-chart-3" },
  en_curso: { label: "En curso", className: "bg-chart-4/15 text-chart-4" },
  cerrado: { label: "Cerrado", className: "bg-secondary text-muted-foreground" },
};

const paymentConfig: Record<PaymentStatus, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-destructive/10 text-destructive" },
  parcial: { label: "Cuotas", className: "bg-chart-4/15 text-chart-4" },
  pagado: { label: "Pagado", className: "bg-chart-3/15 text-chart-3" },
};

const categoryConfig: Record<
  CostCategory,
  { label: string; icon: typeof Package; color: string; description: string }
> = {
  fijo: {
    label: "Fijo",
    icon: Building2,
    color: "bg-primary/10 text-primary",
    description:
      "Costo que no cambia con la cantidad de viajeras (ej. transporte grupal, guía, hospedaje base).",
  },
  variable: {
    label: "Variable",
    icon: Users,
    color: "bg-chart-3/15 text-chart-3",
    description:
      "Costo que se multiplica por la cantidad de viajeras. Mientras el viaje está en planificación se usa VIAJERAS (capacidad); al cerrarlo pasa a usar las inscriptas reales.",
  },
  equipo: {
    label: "Equipo",
    icon: Package,
    color: "bg-terracotta/15 text-terracotta",
    description:
      "Gasto asignado al equipo/guías del viaje. No se reparte ni se cobra a las viajeras.",
  },
  no_incluido: {
    label: "No incluido",
    icon: Wallet,
    color: "bg-muted text-muted-foreground border border-dashed",
    description:
      "Gasto estimado que cada viajera cubre por su cuenta. No entra en el precio del paquete ni en la utilidad.",
  },
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

// ─── Helpers ──────────────────────────────────────────────────
function NewApplicationsDot({ tripId }: { tripId: string }) {
  const { data } = useNewApplicationsCount(tripId);
  if (!data) return null;
  return (
    <span
      className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
      aria-label={`${data} solicitud${data === 1 ? "" : "es"} nueva${data === 1 ? "" : "s"}`}
    >
      {data > 9 ? "9+" : data}
    </span>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return "Sin fecha";
  // Parsear como fecha local (no UTC) para evitar hydration mismatch por zona horaria
  const parts = d.split("-").map(Number);
  const [y, m, day] = parts;
  if (!y || !m || !day) return "Sin fecha";
  const date = new Date(y, m - 1, day);
  if (isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function computeTripDuration(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) return null;
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return null;
  const s = new Date(sy, sm - 1, sd).getTime();
  const e = new Date(ey, em - 1, ed).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return null;
  const nights = Math.round((e - s) / (1000 * 60 * 60 * 24));
  return { nights, days: nights + 1 };
}

// ─── Auto-resize textarea for table cells ─────────────────────
function AutoResizeTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <Textarea ref={ref} className={className} {...props} />;
}

// ─── Main Component ──────────────────────────────────────────
function TripDetailPage() {
  const { tripId } = Route.useParams();
  const trip = useTripsStore((s) => s.trips[tripId]);

  if (!trip) {
    return (
      <div className="p-8 text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Viaje no encontrado</h1>
        <Link to="/" className="text-primary underline">
          Volver a mis viajes
        </Link>
      </div>
    );
  }

  return <TripDetailInner trip={trip} />;
}

function TripDetailInner({ trip: rawTrip }: { trip: TripData }) {
  // `trip.enrolled` es un campo legado que no se actualiza al agregar/eliminar
  // viajeras. Derivamos el conteo real de viajeras activas y sobreescribimos
  // el campo para que TODAS las vistas hijas vean el mismo valor consistente
  // (header, occupancy, CostsTab variables, simulador, exportaciones, etc.).
  const activeEnrolled = useMemo(
    () => (rawTrip.enrollees ?? []).filter((e) => e.status !== "cancelada").length,
    [rawTrip.enrollees],
  );
  const trip = useMemo<TripData>(
    () =>
      rawTrip.enrolled === activeEnrolled ? rawTrip : { ...rawTrip, enrolled: activeEnrolled },
    [rawTrip, activeEnrolled],
  );
  // Cálculos centralizados — única fuente de verdad
  const finance = useMemo(() => calculateTripFinancials(trip, trip.costs), [trip]);
  const perms = usePermissions(trip.id);
  const canSeeFinances = perms.canSeeFinances;
  const canEditTrip = perms.canEditTrip;

  const search = Route.useSearch();
  const initialTab = search.tab ?? (canSeeFinances ? "costos" : "viajeras");
  const [activeTab, setActiveTab] = useState(initialTab);


  // Notificaciones en vivo cuando otra organizadora guarda cambios en este viaje.
  useTripActivity(trip.id);
  useEffect(() => {
    registerTripSection(trip.id, initialTab);
    return () => clearTripSection(trip.id);
  }, [trip.id, initialTab]);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full">
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          registerTripSection(trip.id, v);
        }}
        className="w-full"
      >
        <TripHeader
          trip={trip}
          activeTab={activeTab}
          costPerPerson={finance.costPerPerson}
          profitPerPerson={finance.profitPerPerson}
          extrasRevenue={finance.extrasRevenue}
          extrasProfit={finance.extrasProfit}
          extrasPending={finance.extrasPending}
          extrasCount={finance.extrasCount}
          projectionMode={finance.projectionMode}
          projectionBasis={finance.projectionBasis}
          activeCount={finance.activeCount}
          showFinances={canSeeFinances}
          canSeeFinances={canSeeFinances}
        />

        <div className="mt-6">
          {canSeeFinances && (
            <TabsContent value="costos">
              <CostsTab
                tripId={trip.id}
                trip={trip}
                costs={trip.costs}
                enrolled={trip.enrolled}
                itinerary={trip.itinerary}
                startDate={trip.startDate}
                endDate={trip.endDate}
                canEditTrip={canEditTrip}
              />
            </TabsContent>
          )}
          <TabsContent value="notas">
            <NotesTab tripId={trip.id} />
          </TabsContent>
          <TabsContent value="viajeras">
            <EnrolleesTab
              tripId={trip.id}
              enrollees={trip.enrollees}
              capacity={trip.capacity}
              pricePerPerson={trip.pricePerPerson}
            />
          </TabsContent>
          <TabsContent value="proveedores">
            <ProvidersTab
              tripId={trip.id}
              providers={trip.providers}
              costs={trip.costs}
              trip={trip}
            />
          </TabsContent>
          {canSeeFinances && (
            <TabsContent value="resumen">
              <FinancialSummaryTab trip={trip} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}

// ─── Header ──────────────────────────────────────────────────
function TripHeader({
  trip,
  activeTab,
  costPerPerson,
  profitPerPerson,
  extrasRevenue,
  extrasProfit,
  extrasPending,
  extrasCount,
  projectionMode,
  projectionBasis,
  activeCount,
  showFinances,
  canSeeFinances,
}: {
  trip: TripData;
  activeTab: string;
  costPerPerson: number;
  profitPerPerson: number;
  extrasRevenue: number;
  extrasProfit: number;
  extrasPending: number;
  extrasCount: number;
  projectionMode: "capacidad" | "inscriptas";
  projectionBasis: number;
  activeCount: number;
  showFinances: boolean;
  canSeeFinances: boolean;
}) {

  const status = statusConfig[trip.status];
  const occupancy = trip.capacity > 0 ? (trip.enrolled / trip.capacity) * 100 : 0;
  const margin = trip.pricePerPerson - costPerPerson;
  const hasExtras = extrasCount > 0;
  const basisLabel =
    projectionMode === "inscriptas"
      ? `sobre ${projectionBasis} inscripta${projectionBasis === 1 ? "" : "s"}`
      : `proyectado sobre ${projectionBasis} viajera${projectionBasis === 1 ? "" : "s"}`;
  const [pendingStatus, setPendingStatus] = useState<TripStatus | null>(null);

  const perms = usePermissions(trip.id);
  const [membersOpen, setMembersOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const summaryToggledByUser = useRef(false);
  const updateTripMeta = useTripsStore((s) => s.updateTripMeta);
  const coverUrl = useTripCoverUrl(trip.coverImage);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const summaryStorageKey = userId ? `planeios-trip-summary-${userId}-${trip.id}` : null;

  useEffect(() => {
    if (!summaryStorageKey) return;
    summaryToggledByUser.current = false;
    const saved = localStorage.getItem(summaryStorageKey);
    setSummaryOpen(saved === null ? true : saved === "true");
  }, [summaryStorageKey]);

  useEffect(() => {
    if (!summaryToggledByUser.current || !summaryStorageKey) return;
    localStorage.setItem(summaryStorageKey, String(summaryOpen));
  }, [summaryOpen, summaryStorageKey]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Mis viajes
        </Link>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Descargar viaje</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => exportTripPDF(trip.id, { includeFinance: showFinances })}
              >
                <FileText className="h-3.5 w-3.5 mr-2" /> PDF {showFinances ? "(con finanzas)" : ""}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => exportTripXLSX(trip.id, { includeFinance: showFinances })}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Excel{" "}
                {showFinances ? "(con finanzas)" : ""}
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-[11px] text-muted-foreground">
                Incluye itinerario, proveedores{showFinances ? " y análisis financiero" : ""}.
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link to="/viajes/$tripId/pagina" params={{ tripId: trip.id }}>
              <Globe className="h-3.5 w-3.5" /> Página de venta
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="relative gap-1.5" asChild>
            <Link to="/viajes/$tripId/solicitudes" params={{ tripId: trip.id }}>
              <Inbox className="h-3.5 w-3.5" /> Solicitudes
              <NewApplicationsDot tripId={trip.id} />
            </Link>
          </Button>
          {perms.canInviteMembers && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMembersOpen(true)}
              className="gap-1.5"
            >
              <Users className="h-3.5 w-3.5" /> Miembros y accesos
            </Button>
          )}
          {perms.isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  aria-label="Acciones del viaje"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Acciones
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setDuplicateOpen(true);
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar viaje
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar viaje
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {perms.isOwner && (
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
            navigateHomeAfter
          />
        </>
      )}

      <div className="relative mb-5 overflow-hidden rounded-xl border border-border/60">
        <div className="relative w-full aspect-[16/6] overflow-hidden">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={trip.name}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : (
            <div
              className={`absolute inset-0 h-full w-full bg-gradient-to-br ${trip.coverGradient}`}
            />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/50 to-transparent" />
        </div>

        {perms.canEditTrip && (
          <div className="absolute right-3 top-3 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 gap-1.5 text-xs shadow"
              onClick={() => setCoverOpen(true)}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              {trip.coverImage ? "Cambiar foto" : "Añadir foto"}
            </Button>
            {trip.coverImage && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 gap-1.5 text-xs shadow"
                onClick={async () => {
                  const oldRef = trip.coverImage;
                  await updateTripMeta(trip.id, { coverImage: null });
                  if (isStoragePath(oldRef)) {
                    deleteTripCoverRef(oldRef).catch(() => {});
                  }
                  toast.success("Foto de portada eliminada");
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar foto
              </Button>
            )}
          </div>
        )}
      </div>
      {perms.isOwner && (
        <Dialog open={coverOpen} onOpenChange={setCoverOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Foto de portada</DialogTitle>
              <DialogDescription>
                Subí un archivo o pegá una URL. Sin foto se muestra el gradiente por defecto.
              </DialogDescription>
            </DialogHeader>
            <TripCoverPicker
              tripId={trip.id}
              value={trip.coverImage}
              onChange={(next) => updateTripMeta(trip.id, { coverImage: next })}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setCoverOpen(false)}>
                Listo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {perms.canInviteMembers && (
        <TripMembersDialog tripId={trip.id} open={membersOpen} onOpenChange={setMembersOpen} />
      )}

      {(() => {
        const dur = computeTripDuration(trip.startDate, trip.endDate);
        const destinationChips = [trip.destination, trip.country].filter(Boolean) as string[];
        return (
          <>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              {perms.canEditTrip ? (
                <InlineEditableTitle
                  className="min-w-0 flex-1"
                  value={trip.name}
                  ariaLabel="Editar nombre del viaje"
                  inputClassName="font-display text-2xl md:text-3xl font-bold h-auto py-1"
                  onSave={async (next: string) => {
                    await updateTripMeta(trip.id, { name: next });
                  }}
                  display={
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight min-w-0">
                      {trip.name}
                    </h1>
                  }
                />
              ) : (
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight min-w-0 flex-1">
                  {trip.name}
                </h1>
              )}
              {perms.canEditTrip ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`${status.className} border-0 font-medium shrink-0 inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs hover:opacity-80 transition-opacity`}
                      title="Cambiar estado del viaje"
                    >
                      {status.label} <ChevronDown className="h-3 w-3 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Estado del viaje</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(Object.keys(statusConfig) as TripStatus[]).map((s) => {
                      const cfg = statusConfig[s];
                      const isCurrent = s === trip.status;
                      return (
                        <DropdownMenuItem
                          key={s}
                          disabled={isCurrent}
                          onSelect={(e) => {
                            e.preventDefault();
                            if (isCurrent) return;
                            // Confirmar cuando se cierra y hay divergencia entre capacidad e inscriptas
                            if (
                              s === "cerrado" &&
                              activeCount > 0 &&
                              activeCount !== trip.capacity
                            ) {
                              setPendingStatus(s);
                            } else if (
                              trip.status === "cerrado" &&
                              s !== "cerrado" &&
                              activeCount !== trip.capacity
                            ) {
                              setPendingStatus(s);
                            } else {
                              updateTripMeta(trip.id, { status: s });
                              toast.success(`Estado actualizado: ${cfg.label}`);
                            }
                          }}
                        >
                          <span
                            className={`inline-block h-2 w-2 rounded-full mr-2 ${cfg.className.split(" ")[0]}`}
                          />
                          {cfg.label}{" "}
                          {isCurrent && (
                            <span className="ml-auto text-xs text-muted-foreground">actual</span>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Badge className={`${status.className} border-0 font-medium shrink-0`}>
                  {status.label}
                </Badge>
              )}
              <AlertDialog
                open={pendingStatus !== null}
                onOpenChange={(o) => !o && setPendingStatus(null)}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {pendingStatus === "cerrado"
                        ? "Cerrar viaje y recalcular sobre reales"
                        : "Reabrir viaje y volver a base capacidad"}
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2">
                        {pendingStatus === "cerrado" ? (
                          <>
                            <p>
                              Al cerrar el viaje, el costo por persona, la utilidad por persona y
                              los costos variables se recalcularán sobre{" "}
                              <strong>
                                {activeCount} inscripta{activeCount === 1 ? "" : "s"} real
                                {activeCount === 1 ? "" : "es"}
                              </strong>{" "}
                              en vez de sobre{" "}
                              <strong>
                                {trip.capacity} viajera{trip.capacity === 1 ? "" : "s"}
                              </strong>{" "}
                              planificadas.
                            </p>
                            <p className="text-xs text-muted-foreground">
                              El campo VIAJERAS no se modifica. Podés reabrir el viaje en cualquier
                              momento para volver a base capacidad.
                            </p>
                          </>
                        ) : (
                          <p>
                            El viaje volverá a proyectar costos por persona y variables sobre{" "}
                            <strong>
                              {trip.capacity} viajera{trip.capacity === 1 ? "" : "s"}
                            </strong>{" "}
                            planificadas.
                          </p>
                        )}
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        if (!pendingStatus) return;
                        updateTripMeta(trip.id, { status: pendingStatus });
                        toast.success(`Estado actualizado: ${statusConfig[pendingStatus].label}`);
                        setPendingStatus(null);
                      }}
                    >
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <TabsList className="w-full max-w-full justify-start bg-stone-700 h-10 flex-nowrap md:flex-wrap overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border border-stone-800 shadow-sm mt-4 [&>[data-state=active]]:bg-stone-600 [&>[data-state=active]]:text-stone-100 [&>[data-state=active]]:shadow-none">
              {canSeeFinances && (
                <TabsTrigger
                  value="costos"
                  className="shrink-0 gap-1.5 text-xs sm:text-sm text-stone-300"
                >
                  <RouteIcon className="h-3.5 w-3.5 shrink-0" />{" "}
                  <span className="whitespace-nowrap">Itinerario & Costos</span>
                </TabsTrigger>
              )}
              <TabsTrigger
                value="viajeras"
                className="shrink-0 gap-1.5 text-xs sm:text-sm text-stone-300"
              >
                <Users className="h-3.5 w-3.5 shrink-0" />{" "}
                <span className="whitespace-nowrap">Viajeras</span>
              </TabsTrigger>
              <TabsTrigger
                value="proveedores"
                className="shrink-0 gap-1.5 text-xs sm:text-sm text-stone-300"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" />{" "}
                <span className="whitespace-nowrap">Proveedores</span>
              </TabsTrigger>
              {canSeeFinances && (
                <TabsTrigger
                  value="resumen"
                  className="shrink-0 gap-1.5 text-xs sm:text-sm text-stone-300"
                >
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />{" "}
                  <span className="whitespace-nowrap">Resumen</span>
                </TabsTrigger>
              )}
              <TabsTrigger
                value="notas"
                className="shrink-0 gap-1.5 text-xs sm:text-sm text-stone-300"
              >
                <StickyNote className="h-3.5 w-3.5 shrink-0" />{" "}
                <span className="whitespace-nowrap">Notas</span>
              </TabsTrigger>
            </TabsList>


            {activeTab === "notas" ? (
              <div className="mt-4 space-y-3">
                <h2 className="font-display text-lg md:text-xl font-semibold text-foreground">
                  Resumen de notas
                </h2>
                <NotesSummaryHeader tripId={trip.id} />
              </div>
            ) : (
            <div className="mt-4">

              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg md:text-xl font-semibold text-foreground">
                  Resumen del Viaje
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    summaryToggledByUser.current = true;
                    setSummaryOpen((v) => !v);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={
                    summaryOpen ? "Ocultar resumen del viaje" : "Mostrar resumen del viaje"
                  }
                >
                  {summaryOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {summaryOpen ? "Ocultar resumen" : "Mostrar resumen"}
                </button>
              </div>

              <div
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                  summaryOpen ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0"
                }`}
                aria-hidden={!summaryOpen}
              >
                <div className="overflow-hidden min-h-0">
                  <div className="bg-secondary/80 rounded-xl border border-border/60 p-4 space-y-4">
                    {/* Destination chips */}
                    <div className="flex flex-wrap gap-2">
                      {perms.canEditTrip ? (
                        <EditableDestination
                          trip={trip}
                          renderTrigger={(label) => (
                            <span className="group inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary hover:border-terracotta/60">
                              <MapPin className="h-3.5 w-3.5 text-terracotta" strokeWidth={2.5} />
                              {label}
                              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </span>
                          )}
                        />
                      ) : destinationChips.length ? (
                        destinationChips.map((c) => (
                          <span
                            key={c}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground"
                          >
                            <MapPin className="h-3.5 w-3.5 text-terracotta" strokeWidth={2.5} />
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          Sin destino
                        </span>
                      )}
                    </div>

                    {/* Meta tiles: fechas · duración · viajeras · moneda */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-fr items-stretch">
                      {/* Fechas */}
                      {perms.canEditTrip ? (
                        <EditableDates
                          trip={trip}
                          renderTrigger={(label) => (
                            <MetaTile icon={Calendar} label="Fechas" value={label} interactive />
                          )}
                        />
                      ) : (
                        <MetaTile
                          icon={Calendar}
                          label="Fechas"
                          value={
                            trip.startDate || trip.endDate
                              ? `${formatDate(trip.startDate)} — ${formatDate(trip.endDate)}`
                              : "Por definir"
                          }
                        />
                      )}

                      {/* Duración — abre el mismo selector de fechas */}
                      {perms.canEditTrip ? (
                        <EditableDates
                          trip={trip}
                          renderTrigger={() => (
                            <MetaTile
                              icon={Clock}
                              label="Duración"
                              value={
                                dur
                                  ? `${dur.days} ${dur.days === 1 ? "día" : "días"} · ${dur.nights} ${dur.nights === 1 ? "noche" : "noches"}`
                                  : "—"
                              }
                              interactive
                            />
                          )}
                        />
                      ) : (
                        <MetaTile
                          icon={Clock}
                          label="Duración"
                          value={
                            dur
                              ? `${dur.days} ${dur.days === 1 ? "día" : "días"} · ${dur.nights} ${dur.nights === 1 ? "noche" : "noches"}`
                              : "—"
                          }
                        />
                      )}

                      {/* Viajeras */}
                      {perms.canEditTrip ? (
                        <EditableCapacity
                          trip={trip}
                          renderTrigger={() => (
                            <MetaTile
                              icon={Users}
                              label="Viajeras"
                              value={`${trip.enrolled}/${trip.capacity}`}
                              hint="inscritas / cupos"
                              interactive
                            />
                          )}
                        />
                      ) : (
                        <MetaTile
                          icon={Users}
                          label="Viajeras"
                          value={`${trip.enrolled}/${trip.capacity}`}
                          hint="inscritas / cupos"
                        />
                      )}

                      {/* Moneda */}
                      <TripCurrencyChip
                        trip={trip}
                        canEdit={perms.canEditTrip}
                        renderTrigger={({
                          baseCurrency,
                          localCurrency,
                          rate,
                          onClick,
                          disabled,
                        }) => (
                          <button
                            type="button"
                            onClick={disabled ? undefined : onClick}
                            disabled={disabled}
                            className="group text-left w-full h-full disabled:cursor-default"
                          >
                            <MetaTile
                              icon={Coins}
                              label="Moneda"
                              value={baseCurrency}
                              hint={
                                localCurrency && localCurrency !== baseCurrency
                                  ? rate != null
                                    ? `local ${localCurrency} · 1 ${baseCurrency} = ${roundRate(1 / rate).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${localCurrency}`
                                    : `local ${localCurrency}`
                                  : perms.canEditTrip
                                    ? "sin moneda local"
                                    : undefined
                              }
                              interactive={!disabled}
                            />
                          </button>
                        )}
                      />
                    </div>



                    {/* Occupancy bar */}
                    <div>
                      <div className="h-1.5 w-full rounded-full bg-secondary max-w-md">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(occupancy, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Extras: solo aparece si hay al menos uno. Métricas separadas del viaje base. */}
                    {showFinances && hasExtras && (
                      <div className="rounded-lg border border-border/60 bg-secondary/40 px-4 py-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-terracotta" />
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                              Extras ({extrasCount})
                            </span>
                            <span className="text-[10px] text-muted-foreground/70">
                              · separado del viaje base
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-muted-foreground">
                              Cobrado:{" "}
                              <span className="font-semibold text-foreground tabular-nums">
                                {formatUSD(extrasRevenue)}
                              </span>
                            </span>
                            <span className="text-muted-foreground">
                              Utilidad:{" "}
                              <span
                                className={`font-semibold tabular-nums ${extrasProfit >= 0 ? "text-chart-3" : "text-destructive"}`}
                              >
                                {formatUSD(extrasProfit)}
                              </span>
                            </span>
                            {extrasPending > 0 && (
                              <span className="text-muted-foreground">
                                Pend.:{" "}
                                <span className="font-semibold text-terracotta tabular-nums">
                                  {formatUSD(extrasPending)}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )}

          </>
        );
      })()}
    </div>
  );
}

// ─── Header helpers ──────────────────────────────────────────
function MetaTile({
  icon: Icon,
  label,
  value,
  hint,
  interactive,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  interactive?: boolean;
}) {
  return (
    <div
      className={`group text-left w-full h-full rounded-2xl border border-border bg-card p-4 transition-all ${
        interactive
          ? "cursor-pointer hover:border-terracotta/50 hover:shadow-sm group-active:scale-[0.99]"
          : ""
      }`}
    >
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/70 transition-colors group-hover:bg-terracotta/10">
        <Icon className="h-[18px] w-[18px] text-terracotta" strokeWidth={2} />
      </div>
      <div className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/80 mb-1">
        {label}
      </div>
      <div className="text-[15px] font-bold text-foreground leading-tight truncate">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

function StatCard({
  label,
  tone,
  basis,
  children,
}: {
  label: string;
  tone?: "primary" | "success" | "danger" | "blue" | "beige";
  basis?: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/30 bg-primary/5"
      : tone === "success"
        ? "border-chart-3/30 bg-chart-3/5"
        : tone === "danger"
          ? "border-destructive/30 bg-destructive/5"
          : tone === "blue"
            ? "border-blue/30 bg-blue/5"
            : tone === "beige"
              ? "border-[#D4C5A9]/80 bg-[#E8DEC4]"
              : "border-border/60 bg-secondary/40";
  return (
    <div className={`rounded-xl border ${toneClass} px-4 py-3`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </p>
        {basis}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function EditableDestination({
  trip,
  renderTrigger,
}: {
  trip: TripData;
  renderTrigger?: (label: string) => React.ReactNode;
}) {
  const updateTripMeta = useTripsStore((s) => s.updateTripMeta);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [destination, setDestination] = useState(trip.destination ?? "");
  const [country, setCountry] = useState(trip.country ?? "");
  useEffect(() => {
    if (open) {
      setDestination(trip.destination ?? "");
      setCountry(trip.country ?? "");
    }
  }, [open, trip.destination, trip.country]);
  const label = [trip.destination, trip.country].filter(Boolean).join(" · ") || "Sin destino";
  const handleSave = async () => {
    const prev = { destination: trip.destination, country: trip.country };
    setSaving(true);
    updateTripMeta(trip.id, {
      destination: destination.trim(),
      country: country.trim() || undefined,
    });
    try {
      await saveTripNow(trip.id);
      toast.success("Destino actualizado");
      setOpen(false);
    } catch (e) {
      updateTripMeta(trip.id, prev);
      toast.error("No se pudo guardar el destino", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {renderTrigger ? (
          <button type="button" className="group text-left w-full">
            {renderTrigger(label)}
          </button>
        ) : (
          <button className="group inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
            <span>{label}</span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Destino</Label>
          <Input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Ej. Oaxaca"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">País</Label>
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Ej. México"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditableDates({
  trip,
  renderTrigger,
}: {
  trip: TripData;
  renderTrigger?: (label: string) => React.ReactNode;
}) {
  const updateTripMeta = useTripsStore((s) => s.updateTripMeta);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [start, setStart] = useState(trip.startDate ?? "");
  const [end, setEnd] = useState(trip.endDate ?? "");
  useEffect(() => {
    if (open) {
      setStart(trip.startDate ?? "");
      setEnd(trip.endDate ?? "");
    }
  }, [open, trip.startDate, trip.endDate]);
  const label =
    trip.startDate || trip.endDate
      ? `${formatDate(trip.startDate)} — ${formatDate(trip.endDate)}`
      : "Fechas por definir";
  const handleSave = async () => {
    const prev = { startDate: trip.startDate, endDate: trip.endDate };
    setSaving(true);
    updateTripMeta(trip.id, {
      startDate: start ? start : null,
      endDate: end ? end : null,
    });
    try {
      await saveTripNow(trip.id);
      toast.success("Fechas actualizadas");
      setOpen(false);
    } catch (e) {
      updateTripMeta(trip.id, prev);
      toast.error("No se pudieron guardar las fechas", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {renderTrigger ? (
          <button type="button" className="group text-left w-full h-full">
            {renderTrigger(label)}
          </button>
        ) : (
          <button className="group inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
            <span>{label}</span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3 space-y-3">
        {(() => {
          const parse = (s: string) => {
            if (!s) return undefined;
            const [y, m, d] = s.split("-").map(Number);
            if (!y || !m || !d) return undefined;
            return new Date(y, m - 1, d);
          };
          const fmt = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
          };
          const fromDate = parse(start);
          const toDate = parse(end);
          return (
            <CalendarPicker
              mode="range"
              numberOfMonths={2}
              defaultMonth={fromDate ?? new Date()}
              selected={{ from: fromDate, to: toDate }}
              onSelect={(range) => {
                setStart(range?.from ? fmt(range.from) : "");
                setEnd(range?.to ? fmt(range.to) : "");
              }}
              className="pointer-events-auto"
            />
          );
        })()}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditableCapacity({
  trip,
  renderTrigger,
}: {
  trip: TripData;
  renderTrigger?: (label: string) => React.ReactNode;
}) {
  const updateTripMeta = useTripsStore((s) => s.updateTripMeta);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capacity, setCapacity] = useState(String(trip.capacity ?? 0));
  useEffect(() => {
    if (open) setCapacity(String(trip.capacity ?? 0));
  }, [open, trip.capacity]);
  const handleSave = async () => {
    const prev = { capacity: trip.capacity };
    const n = Math.max(trip.enrolled, Number(capacity) || 0);
    setSaving(true);
    updateTripMeta(trip.id, { capacity: n });
    try {
      await saveTripNow(trip.id);
      toast.success("Cupos actualizados");
      setOpen(false);
    } catch (e) {
      updateTripMeta(trip.id, prev);
      toast.error("No se pudieron guardar los cupos", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {renderTrigger ? (
          <button type="button" className="group text-left w-full h-full">
            {renderTrigger(`${trip.enrolled}/${trip.capacity} viajeras`)}
          </button>
        ) : (
          <button className="group inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
            <span>
              {trip.enrolled}/{trip.capacity} viajeras
            </span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Cupos totales</Label>
          <Input
            type="number"
            min={trip.enrolled}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">Inscritas actuales: {trip.enrolled}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditablePrice({ trip }: { trip: TripData }) {
  const updateTripMeta = useTripsStore((s) => s.updateTripMeta);
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(String(trip.pricePerPerson ?? 0));
  useEffect(() => {
    if (open) setPrice(String(trip.pricePerPerson ?? 0));
  }, [open, trip.pricePerPerson]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="group inline-flex items-baseline gap-2 hover:opacity-80 transition-opacity">
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {formatUSD(trip.pricePerPerson)}
          </span>
          <span className="text-xs font-normal text-muted-foreground">{trip.currency}</span>
          <Pencil className="h-3 w-3 opacity-40" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Precio por persona ({trip.currency})</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              updateTripMeta(trip.id, { pricePerPerson: Math.max(0, Number(price) || 0) });
              setOpen(false);
            }}
          >
            Guardar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Tab: Itinerario ─────────────────────────────────────────

function ItineraryTab({ itinerary }: { itinerary: ItineraryDay[] }) {
  return (
    <div className="mt-4 space-y-3">
      {itinerary.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            <RouteIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">Sin itinerario aún</p>
            <p className="text-sm mt-1">Agrega los días y actividades de este viaje.</p>
          </CardContent>
        </Card>
      ) : (
        itinerary.map((day) => (
          <Card key={day.day} className="border-border/50 hover:shadow-sm transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                    Día
                  </span>
                  <span className="text-lg font-bold text-primary leading-none">{day.day}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-foreground">{day.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{day.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {day.activities.map((act) => (
                      <Badge key={act} variant="secondary" className="text-[11px] font-normal">
                        {act}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function roundRate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function ratesEqual(a: number | null, b: number | null) {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < 1e-9;
}

// ─── Componente: Chip + diálogo de moneda del viaje ─────────
// Única fuente para editar moneda base, moneda local y tasa de cambio.
// - Cambiar solo la moneda local → afecta únicamente el default de nuevos
//   costos; no toca los ya cargados.
// - Cambiar moneda base o tasa → confirma. Ofrece opción de recalcular
//   todos los costos existentes (rompe trazabilidad histórica).
function TripCurrencyChip({
  trip,
  canEdit,
  renderTrigger,
}: {
  trip: TripData;
  canEdit: boolean;
  renderTrigger?: (info: {
    baseCurrency: Currency;
    localCurrency: Currency | null;
    rate: number | null | undefined;
    onClick: () => void;
    disabled: boolean;
  }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const setCurrencyConfig = useTripsStore((s) => s.setTripCurrencyConfig);
  const baseCurrency = getTripBaseCurrency(trip);
  const localCurrency = getTripLocalCurrency(trip);
  const rate = trip.exchangeRate;
  const updatedAt = trip.exchangeRateUpdatedAt;

  const [baseDraft, setBaseDraft] = useState<Currency>(baseCurrency);
  const [localDraft, setLocalDraft] = useState<string>(localCurrency ?? "none");
  // Mostramos la tasa invertida en UI: 1 base = ? local.
  const [rateDraft, setRateDraft] = useState<string>(rate != null ? String(roundRate(1 / rate)) : "");
  const [confirmingDestructive, setConfirmingDestructive] = useState<null | {
    recalc: boolean;
  }>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setBaseDraft(baseCurrency);
      setLocalDraft(localCurrency ?? "none");
      // Mostramos la tasa invertida: 1 base = ? local.
      setRateDraft(rate != null ? String(roundRate(1 / rate)) : "");
      setConfirmingDestructive(null);
    }
  }

  function attemptSave() {
    const nextBase = baseDraft;
    const nextLocal = localDraft === "none" ? null : (localDraft as Currency);
    const rawRate = rateDraft.trim();
    const displayRate = rawRate === "" ? null : parseFloat(rawRate);
    if (rawRate !== "" && (!Number.isFinite(displayRate) || (displayRate as number) <= 0)) {
      toast.error("La tasa debe ser un número mayor a 0");
      return;
    }
    // Guardamos la tasa en su forma interna: base por 1 unidad de local.
    const nextRate = displayRate != null ? roundRate(1 / displayRate) : null;
    const baseChanged = nextBase !== baseCurrency;
    const rateChanged = !ratesEqual(nextRate, rate ?? null);
    if (baseChanged || rateChanged) {
      setConfirmingDestructive({ recalc: false });
      return;
    }
    // Solo cambia moneda local: aplicar directo, sin recálculo.
    setCurrencyConfig(
      trip.id,
      { baseCurrency: nextBase, localCurrency: nextLocal, exchangeRate: nextRate },
      { recalcExistingCosts: false },
    );
    toast.success("Moneda local actualizada");
    setOpen(false);
  }

  function confirmSave(recalc: boolean) {
    const nextBase = baseDraft;
    const nextLocal = localDraft === "none" ? null : (localDraft as Currency);
    const rawRate = rateDraft.trim();
    const displayRate = rawRate === "" ? null : parseFloat(rawRate);
    const nextRate = displayRate != null ? roundRate(1 / displayRate) : null;
    setCurrencyConfig(
      trip.id,
      { baseCurrency: nextBase, localCurrency: nextLocal, exchangeRate: nextRate },
      { recalcExistingCosts: recalc },
    );
    toast.success(
      recalc
        ? "Moneda actualizada · costos recalculados"
        : "Moneda actualizada · costos existentes conservados",
    );
    setConfirmingDestructive(null);
    setOpen(false);
  }

  return (
    <div className={renderTrigger ? "contents" : "flex items-center gap-2 text-muted-foreground"}>
      {renderTrigger ? (
        renderTrigger({
          baseCurrency,
          localCurrency,
          rate,
          onClick: () => canEdit && setOpen(true),
          disabled: !canEdit,
        })
      ) : (
        <>
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[10px] font-semibold">
            $
          </span>
          <button
            type="button"
            onClick={() => canEdit && setOpen(true)}
            disabled={!canEdit}
            className={`text-sm ${canEdit ? "hover:text-foreground cursor-pointer" : "cursor-default"} inline-flex items-center gap-1.5`}
            title={canEdit ? "Editar moneda y tasa del viaje" : undefined}
          >
            <span className="font-medium text-foreground">{baseCurrency}</span>
            {localCurrency && localCurrency !== baseCurrency && (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span>local {localCurrency}</span>
                {rate != null && (
                  <span className="text-xs text-muted-foreground/80">
                    (1 {baseCurrency} ={" "}
                    {roundRate(1 / rate).toLocaleString(undefined, { maximumFractionDigits: 6 })} {localCurrency})
                  </span>
                )}
              </>
            )}
            {!localCurrency && canEdit && (
              <span className="text-xs text-muted-foreground/70">— configurar moneda local</span>
            )}
          </button>
          {updatedAt && (
            <span className="text-[10px] text-muted-foreground/70">
              · tasa{" "}
              {new Date(updatedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
            </span>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Moneda y tasa del viaje</DialogTitle>
            <DialogDescription>
              Fuente única para configurar la moneda base, la moneda local y la tasa activa. Cambiar
              la moneda local solo afecta los costos nuevos; cambiar la base o la tasa puede afectar
              conversiones.
            </DialogDescription>
          </DialogHeader>

          {!confirmingDestructive ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Moneda base</Label>
                  <Select value={baseDraft} onValueChange={(v) => setBaseDraft(v as Currency)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Moneda local</Label>
                  <Select value={localDraft} onValueChange={(v) => setLocalDraft(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— sin moneda local —</SelectItem>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Tasa: 1 {baseDraft} = ? {localDraft === "none" ? "local" : localDraft}
                </Label>
                <Input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={rateDraft}
                  onChange={(e) => setRateDraft(e.target.value)}
                  placeholder="Ej: 17.24"
                  disabled={localDraft === "none"}
                />
                <p className="text-xs text-muted-foreground">
                  Se guarda como snapshot en cada costo nuevo. Los costos ya cargados conservan su
                  propia tasa histórica salvo recálculo explícito.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={attemptSave}>Guardar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-md border border-terracotta/40 bg-terracotta/5 p-3 text-sm">
                <p className="font-medium text-foreground">Este cambio afecta conversiones.</p>
                <p className="text-muted-foreground mt-1">
                  Estás cambiando la moneda base o la tasa del viaje. Elegí qué hacer con los costos
                  ya cargados:
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => confirmSave(false)}
                >
                  <span className="flex flex-col items-start">
                    <span className="font-medium">Conservar costos actuales (recomendado)</span>
                    <span className="text-xs text-muted-foreground">
                      Mantiene trazabilidad histórica. Solo los nuevos costos usan la nueva tasa.
                    </span>
                  </span>
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => confirmSave(true)}
                >
                  <span className="flex flex-col items-start">
                    <span className="font-medium">Recalcular todos los costos</span>
                    <span className="text-xs text-muted-foreground">
                      Reconvierte todos los costos existentes con la nueva tasa. Rompe la
                      trazabilidad histórica.
                    </span>
                  </span>
                </Button>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmingDestructive(null)}>
                  Volver
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Editor inline de ciudad/destino para un día del itinerario.
// Se muestra como badge cuando ya hay ciudad; al hacer click se convierte
// en un input pequeño para editarla. En viajes multidestino resalta con
// color primario para que sea más fácil escanear el itinerario.
function DayCityEditor({
  city,
  highlight,
  onChange,
}: {
  city: string;
  highlight: boolean;
  onChange: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(city);
  useEffect(() => {
    setValue(city);
  }, [city]);

  function commit() {
    setEditing(false);
    const next = value.trim();
    if (next !== city.trim()) onChange(next);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setValue(city);
            setEditing(false);
          }
        }}
        placeholder="Ciudad / destino"
        className="h-6 px-2 rounded-md text-xs border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary w-40"
      />
    );
  }

  if (city.trim()) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={
          "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium transition-colors " +
          (highlight
            ? "bg-primary/10 text-primary hover:bg-primary/15"
            : "bg-secondary text-secondary-foreground hover:bg-secondary/80")
        }
        title="Editar ciudad"
      >
        <MapPin className="h-3 w-3" />
        {city}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] text-muted-foreground/70 border border-dashed border-border hover:text-foreground hover:border-foreground/40 transition-colors"
    >
      <MapPin className="h-3 w-3" />
      Asignar ciudad
    </button>
  );
}

// Editor inline de rango horario para un costo del itinerario.
// Muestra la hora de inicio (y fin si existe) en tamaño grande. Al hacer click
// se abren dos inputs de tipo time. El borrador permanece local para que el
// ordenamiento de filas no desmonte el editor; Enter/✓/click fuera guardan el
// rango completo en una sola mutación.
function InlineTimeEditor({
  costId,
  startTime,
  endTime,
  onChange,
  disabled,
}: {
  costId: string;
  startTime?: string;
  endTime?: string;
  onChange: (next: { startTime?: string; endTime?: string }) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draftStart, setDraftStart] = useState(startTime ?? "");
  const [draftEnd, setDraftEnd] = useState(endTime ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const draftStartRef = useRef(startTime ?? "");
  const draftEndRef = useRef(endTime ?? "");
  const initialStartRef = useRef(startTime ?? "");
  const initialEndRef = useRef(endTime ?? "");
  const lastAttemptRef = useRef<{ startTime?: string; endTime?: string } | null>(null);
  const onChangeRef = useRef(onChange);
  const committingRef = useRef(false);
  const savedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (editing) return;
    const nextStart = startTime ?? "";
    const nextEnd = endTime ?? "";
    draftStartRef.current = nextStart;
    draftEndRef.current = nextEnd;
    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
  }, [editing, startTime, endTime]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  const timeError = getTimeRangeError(draftStart, draftEnd);
  const saving = saveStatus === "saving";

  function beginEditing() {
    const nextStart = startTime ?? "";
    const nextEnd = endTime ?? "";
    initialStartRef.current = nextStart;
    initialEndRef.current = nextEnd;
    draftStartRef.current = nextStart;
    draftEndRef.current = nextEnd;
    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
    setEditing(true);
  }

  async function persist(next: { startTime?: string; endTime?: string }) {
    if (savedTimerRef.current) {
      window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    lastAttemptRef.current = next;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await onChangeRef.current(next);
      setSaveStatus("saved");
      setSaveError(null);
      savedTimerRef.current = window.setTimeout(() => {
        setSaveStatus("idle");
        savedTimerRef.current = null;
      }, 2000);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el horario";
      setSaveStatus("error");
      setSaveError(message);
      toast.error(message);
      return false;
    }
  }

  async function commit() {
    if (committingRef.current) return;
    const rawStart = draftStartRef.current;
    const rawEnd = draftEndRef.current;
    const parsedStart = parseTimeInput(rawStart);
    const parsedEnd = parseTimeInput(rawEnd);
    if (!parsedStart.ok) {
      toast.error("Hora de inicio inválida. Probá con formatos como 1pm, 1:30pm o 13:30.");
      return;
    }
    if (!parsedEnd.ok) {
      toast.error("Hora de fin inválida. Probá con formatos como 1pm, 1:30pm o 13:30.");
      return;
    }
    const nextStart = parsedStart.value || undefined;
    const nextEnd = parsedEnd.value || undefined;
    const error = getTimeRangeError(nextStart, nextEnd);
    if (error) {
      toast.error(error);
      return;
    }
    // Reflejar la versión normalizada en el draft (por si el usuario reabre).
    draftStartRef.current = parsedStart.value;
    draftEndRef.current = parsedEnd.value;
    setDraftStart(parsedStart.value);
    setDraftEnd(parsedEnd.value);
    committingRef.current = true;
    try {
      const ok = await persist({ startTime: nextStart, endTime: nextEnd });
      if (ok) setEditing(false);
    } finally {
      committingRef.current = false;
    }
  }

  async function retry() {
    const last = lastAttemptRef.current;
    if (!last) return;
    await persist(last);
  }

  function cancel() {
    const nextStart = initialStartRef.current;
    const nextEnd = initialEndRef.current;
    draftStartRef.current = nextStart;
    draftEndRef.current = nextEnd;
    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
    setEditing(false);
  }

  if (editing) {
    return (
      <div
        className="flex items-start gap-1"
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget as Node | null;
          if (nextTarget && event.currentTarget.contains(nextTarget)) return;
          window.setTimeout(() => void commit(), 0);
        }}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <div className="flex flex-col">
              <Input
                type="text"
                inputMode="text"
                placeholder="1pm"
                autoComplete="off"
                aria-label="Hora de inicio"
                data-testid={`cost-time-start-${costId}`}
                className="h-7 px-1.5 text-xs tabular-nums"
                value={draftStart}
                onInput={(e) => {
                  const nextStart = e.currentTarget.value;
                  draftStartRef.current = nextStart;
                  setDraftStart(nextStart);
                }}
                onChange={(e) => {
                  const nextStart = e.target.value;
                  draftStartRef.current = nextStart;
                  setDraftStart(nextStart);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancel();
                  }
                }}
                disabled={disabled}
              />
              <span className="text-[9px] text-muted-foreground text-center">Inicio</span>
            </div>
            <span className="text-muted-foreground text-xs">-</span>
            <div className="flex flex-col">
              <Input
                type="text"
                inputMode="text"
                placeholder="3pm"
                autoComplete="off"
                aria-label="Hora de culminación"
                data-testid={`cost-time-end-${costId}`}
                className={`h-7 px-1.5 text-xs tabular-nums ${timeError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                value={draftEnd}
                onInput={(e) => {
                  const nextEnd = e.currentTarget.value;
                  draftEndRef.current = nextEnd;
                  setDraftEnd(nextEnd);
                }}
                onChange={(e) => {
                  const nextEnd = e.target.value;
                  draftEndRef.current = nextEnd;
                  setDraftEnd(nextEnd);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancel();
                  }
                }}
                disabled={disabled}
                aria-invalid={!!timeError}
              />
              <span className="text-[9px] text-muted-foreground text-center">Fin</span>
            </div>
          </div>
          {timeError && (
            <span className="text-[10px] text-destructive leading-tight">{timeError}</span>
          )}
          <SaveStatusPill status={saveStatus} error={saveError} onRetry={() => void retry()} />
        </div>
        <div className="flex flex-col gap-0.5 pt-0.5">
          <button
            type="button"
            onClick={() => void commit()}
            data-testid={`cost-time-save-${costId}`}
            className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-primary/10 text-primary disabled:opacity-50"
            title="Guardar (Enter)"
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
          </button>
          <button
            type="button"
            onClick={cancel}
            className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-destructive/10 text-destructive"
            title="Cancelar (Esc)"
            disabled={saving}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  const hasStart = !!startTime;
  const hasEnd = !!endTime;
  const timeDisplay = hasStart
    ? hasEnd
      ? `${formatTime12h(startTime)} - ${formatTime12h(endTime)}`
      : formatTime12h(startTime)
    : null;

  async function clearTime() {
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await onChangeRef.current({ startTime: undefined, endTime: undefined });
      setSaveStatus("saved");
      savedTimerRef.current = window.setTimeout(() => {
        setSaveStatus("idle");
        savedTimerRef.current = null;
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el horario";
      setSaveStatus("error");
      setSaveError(message);
      toast.error(message);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => !disabled && beginEditing()}
          data-testid={`cost-time-display-${costId}`}
          disabled={disabled}
          className="inline-flex items-center justify-start h-auto p-0 bg-transparent text-terracotta text-[10px] font-bold tabular-nums whitespace-nowrap hover:bg-transparent transition-colors disabled:opacity-50 min-w-[92px]"
          title={hasStart ? "Editar horario" : "Agregar horario"}
        >
          {timeDisplay ? (
            <span className="tabular-nums whitespace-nowrap">{timeDisplay}</span>
          ) : (
            <span className="font-normal text-muted-foreground">Sin hora</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => void clearTime()}
          disabled={disabled || saveStatus === "saving" || !timeDisplay}
          className={`inline-flex items-center justify-center h-4 w-4 rounded transition-colors disabled:opacity-0 ${
            timeDisplay
              ? "hover:bg-destructive/10 text-destructive/70 hover:text-destructive"
              : "invisible opacity-0"
          }`}
          title={timeDisplay ? "Eliminar horario" : "Sin horario para eliminar"}
          aria-label={timeDisplay ? "Eliminar horario" : "Sin horario para eliminar"}
          aria-hidden={!timeDisplay}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <SaveStatusPill status={saveStatus} error={saveError} onRetry={() => void retry()} />
    </div>
  );
}

function SaveStatusPill({
  status,
  error,
  onRetry,
}: {
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
  onRetry: () => void;
}) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground leading-none">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Guardando…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-500 leading-none">
        <Check className="h-2.5 w-2.5" />
        Guardado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] text-destructive leading-none">
      <CircleAlert className="h-2.5 w-2.5" />
      <span className="max-w-[120px] truncate" title={error ?? undefined}>
        Error
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="underline hover:no-underline"
      >
        Reintentar
      </button>
    </span>
  );
}

function formatTime12h(value?: string): string {
  if (!value) return "";
  const [h, m] = value.split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const ampm = h >= 12 ? "pm" : "am";
  const displayHour = h % 12 || 12;
  const displayMinute = m > 0 ? `:${m.toString().padStart(2, "0")}` : "";
  return `${displayHour}${displayMinute}${ampm}`;
}

// Acepta entrada libre ("1pm", "1:30 pm", "13:00", "13", "1.30pm")
// y la normaliza a "HH:MM" 24h. `ok: false` si no se puede interpretar.
function parseTimeInput(raw: string): { value: string; ok: boolean } {
  const s = (raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return { value: "", ok: true };
  const m = s.match(/^(\d{1,2})(?:[:.]?(\d{2}))?(am|pm|a|p)?$/);
  if (!m) return { value: raw, ok: false };
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const suffix = m[3];
  if (Number.isNaN(h) || min < 0 || min > 59) return { value: raw, ok: false };
  if (suffix) {
    const pm = suffix.startsWith("p");
    if (h < 1 || h > 12) return { value: raw, ok: false };
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  } else {
    if (h < 0 || h > 23) return { value: raw, ok: false };
  }
  return {
    value: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
    ok: true,
  };
}

function getTimeRangeError(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null;
  const s = parseTimeInput(start);
  const e = parseTimeInput(end);
  if (!s.ok || !e.ok || !s.value || !e.value) return null;
  if (e.value <= s.value) {
    return "La hora de culminación debe ser mayor que la hora de inicio";
  }
  return null;
}

// ─── Tab: Costos ─────────────────────────────────────────────
function CostsTab({
  tripId,
  trip,
  costs,
  enrolled,
  itinerary,
  startDate,
  endDate,
  canEditTrip,
}: {
  tripId: string;
  trip: TripData;
  costs: CostItem[];
  enrolled: number;
  itinerary: ItineraryDay[];
  startDate: string | null;
  endDate: string | null;
  canEditTrip: boolean;
}) {
  const _addCostRaw = useTripsStore((s) => s.addCost);
  const _updateCostRaw = useTripsStore((s) => s.updateCost);
  const _removeCostRaw = useTripsStore((s) => s.removeCost);
  const _setCostDayRaw = useTripsStore((s) => s.setCostItineraryDay);
  const setDayCityStore = useTripsStore((s) => s.setItineraryDayCity);
  const setCostsStore = useTripsStore((s) => s.setCosts);
  const seedTagsIfNeeded = useTripsStore((s) => s.seedTagsIfNeeded);
  const addTagStore = useTripsStore((s) => s.addTag);
  const updateTagStore = useTripsStore((s) => s.updateTag);
  const removeTagStore = useTripsStore((s) => s.removeTag);
  const tripTags = trip.tags ?? [];
  // Fallback estable si el catálogo aún no está sembrado en memoria (SSR / render inicial).
  const effectiveTags = tripTags.length > 0 ? tripTags : seedDefaultTags();

  useEffect(() => {
    seedTagsIfNeeded(tripId);
  }, [seedTagsIfNeeded, tripId]);

  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set());
  const toggleTagFilter = useCallback((tagId: string) => {
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }, []);

  const tagUsageCounts = useMemo(() => countRowsByTag(costs), [costs]);

  // Historial de undo/redo para todas las mutaciones de costos.
  const history = useCostsHistory(tripId, costs);
  const costsRef = useRef(costs);
  useEffect(() => {
    costsRef.current = costs;
  }, [costs]);

  const addCostStore: typeof _addCostRaw = (...args) => {
    history.snapshot(costsRef.current);
    _addCostRaw(...args);
  };
  const updateCostStore: typeof _updateCostRaw = (...args) => {
    history.snapshot(costsRef.current);
    _updateCostRaw(...args);
  };

  const saveCostTime = useCallback(
    async (costId: string, next: { startTime?: string; endTime?: string }) => {
      const current = useTripsStore
        .getState()
        .trips[tripId]?.costs.find((cost) => cost.id === costId);
      if (!current) throw new Error("El costo ya no existe");

      history.snapshot(useTripsStore.getState().trips[tripId]?.costs ?? costsRef.current);
      _updateCostRaw(tripId, costId, {
        time: undefined,
        startTime: next.startTime,
        endTime: next.endTime,
      });

      try {
        await saveTripNow(tripId);
      } catch (error) {
        _updateCostRaw(tripId, costId, {
          time: current.time,
          startTime: current.startTime,
          endTime: current.endTime,
        });
        throw error;
      }
    },
    [_updateCostRaw, history, tripId],
  );
  const removeCostStore: typeof _removeCostRaw = (...args) => {
    history.snapshot(costsRef.current);
    _removeCostRaw(...args);
  };
  const setCostDayStore: typeof _setCostDayRaw = (...args) => {
    history.snapshot(costsRef.current);
    _setCostDayRaw(...args);
  };

  const handleUndo = useCallback(() => {
    const prev = history.undo();
    if (!prev) return;
    setCostsStore(tripId, prev);
    toast.success("Cambio deshecho");
  }, [history, setCostsStore, tripId]);

  const handleRedo = useCallback(() => {
    const next = history.redo();
    if (!next) return;
    setCostsStore(tripId, next);
    toast.success("Cambio rehecho");
  }, [history, setCostsStore, tripId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      // No interceptar cuando se está escribiendo en un input/textarea:
      // Cmd+Z ahí debe deshacer texto local, no la tabla.
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo]);

  const tripBaseCurrency = getTripBaseCurrency(trip);
  const tripLocalCurrency = getTripLocalCurrency(trip);
  const defaultCostCurrency: Currency = tripLocalCurrency ?? tripBaseCurrency;

  // Cuando se crea un costo inline desde "Agregar costo aquí", guardamos su id
  // para que al cancelar la edición se elimine el placeholder recién creado.
  const [pendingNewId, setPendingNewId] = useState<string | null>(null);

  type EditDraft = {
    description: string;
    notes: string;
    category: CostCategory;
    amount: string;
    currency: Currency;
    itineraryDay: string;
    startTime: string;
    endTime: string;
    included: boolean;
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  // Snapshot de campos que se persisten en tiempo real durante la edición
  // (ej. startTime/endTime desde InlineTimeEditor). Se usa para restaurar
  // los valores originales al cancelar con Esc.
  const originalPersistedRef = useRef<{
    id: string;
    startTime: string | undefined;
    endTime: string | undefined;
  } | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CostCategory>("fijo");
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState<{ amount: string; currency: Currency }>({
    amount: "",
    currency: "USD",
  });

  function startEdit(c: CostItem) {
    setEditingNoteId(null);
    setNoteDraft("");
    setEditingDescriptionId(null);
    setDescriptionDraft("");
    setEditingCategoryId(null);
    setEditingAmountId(null);
    setEditingId(c.id);
    setDraft({
      description: c.description,
      notes: c.notes,
      category: c.category,
      // Si el costo es draft (sin monto), mantener el input vacío para
      // diferenciar de un 0 explícito.
      amount: c.isDraft ? "" : String(c.amount),
      currency: c.currency,
      itineraryDay: c.itineraryDay == null ? "none" : String(c.itineraryDay),
      startTime: c.startTime ?? c.time ?? "",
      endTime: c.endTime ?? "",
      included: c.included !== false,
    });
    // Guardar snapshot de los campos que se persisten en tiempo real,
    // para poder revertirlos si el usuario cancela con Esc.
    originalPersistedRef.current = {
      id: c.id,
      startTime: c.startTime ?? c.time ?? undefined,
      endTime: c.endTime ?? undefined,
    };
  }

  function cancelEdit() {
    if (pendingNewId && editingId === pendingNewId) {
      // Se canceló la creación inline: eliminar el placeholder recién creado.
      removeCostStore(tripId, pendingNewId);
    } else if (originalPersistedRef.current && originalPersistedRef.current.id === editingId) {
      // Restaurar valores persistidos en tiempo real (horario) al original,
      // para que Esc deje la fila exactamente como estaba antes de editar.
      const snap = originalPersistedRef.current;
      const current = costs.find((x) => x.id === snap.id);
      if (
        current &&
        ((current.startTime ?? undefined) !== snap.startTime ||
          (current.endTime ?? undefined) !== snap.endTime)
      ) {
        void saveCostTime(snap.id, { startTime: snap.startTime, endTime: snap.endTime });
      }
    }
    originalPersistedRef.current = null;
    setPendingNewId(null);
    setEditingId(null);
    setDraft(null);
  }

  const itineraryDayOptions = useMemo(() => {
    const nums = new Set<number>();
    const duration = computeTripDuration(startDate, endDate);
    const totalDays = duration?.days ?? 0;

    for (let day = 1; day <= totalDays; day++) nums.add(day);
    itinerary.forEach((day) => nums.add(day.day));
    costs.forEach((cost) => {
      if (cost.itineraryDay != null) nums.add(cost.itineraryDay);
    });

    return Array.from(nums)
      .filter((day) => Number.isFinite(day) && day > 0)
      .sort((a, b) => a - b)
      .map((day) => ({ day, title: itinerary.find((item) => item.day === day)?.title }));
  }, [costs, endDate, itinerary, startDate]);

  function saveEdit(keepEditing = false, opts?: { silent?: boolean }) {
    if (!editingId || !draft) return;
    // `silent`: la confirmación vino de un click afuera. Si los datos no son
    // válidos descartamos el cambio en vez de mostrar un error bloqueante.
    const silent = opts?.silent === true;
    const discard = () => {
      cancelEdit();
    };
    const description = draft.description.trim();
    const rawAmount = draft.amount.trim();
    const hasAmount = rawAmount !== "";
    const parsed = hasAmount ? parseFloat(rawAmount) : NaN;
    if (hasAmount && (isNaN(parsed) || parsed < 0)) {
      if (silent) return discard();
      toast.error("El monto debe ser un número válido (o dejalo vacío)");
      return;
    }
    const timeError = getTimeRangeError(draft.startTime, draft.endTime);
    if (timeError) {
      if (silent) return discard();
      toast.error(timeError);
      return;
    }
    // Debe quedar al menos un campo con información.
    const hasAnyField =
      !!description ||
      !!draft.notes.trim() ||
      !!draft.startTime ||
      !!draft.endTime ||
      hasAmount ||
      draft.itineraryDay !== "none";
    if (!hasAnyField) {
      if (silent) return discard();
      toast.error("Completá al menos un campo del costo");
      return;
    }
    const isDraft = !hasAmount;
    const conv = buildCostConversion(isDraft ? null : parsed, draft.currency, trip);
    updateCostStore(tripId, editingId, {
      description,
      notes: draft.notes,
      category: draft.category,
      amount: conv.amount,
      currency: conv.currency,
      amountUSD: conv.amountUSD,
      perPerson: draft.category === "variable",
      itineraryDay: draft.itineraryDay === "none" ? null : parseInt(draft.itineraryDay, 10),
      startTime: draft.startTime || undefined,
      endTime: draft.endTime || undefined,
      included: draft.included,
      isDraft: isDraft ? true : false,
      originalAmount: conv.originalAmount,
      originalCurrency: conv.originalCurrency,
      baseCurrency: conv.baseCurrency,
      rateUsed: conv.rateUsed,
      convertedAmount: conv.convertedAmount,
    });
    if (!keepEditing) {
      setPendingNewId(null);
      setEditingId(null);
      setDraft(null);
    }
  }

  function startNoteEdit(c: CostItem) {
    if (editingId || editingDescriptionId || editingCategoryId || editingAmountId) return;
    setEditingNoteId(c.id);
    setNoteDraft(c.notes || "");
  }

  function saveNoteEdit() {
    if (!editingNoteId) return;
    updateCostStore(tripId, editingNoteId, { notes: noteDraft });
    setEditingNoteId(null);
    setNoteDraft("");
  }

  function cancelNoteEdit() {
    setEditingNoteId(null);
    setNoteDraft("");
  }

  function startDescriptionEdit(c: CostItem) {
    if (editingId || editingNoteId || editingCategoryId || editingAmountId) return;
    setEditingDescriptionId(c.id);
    setDescriptionDraft(c.description || "");
  }

  function saveDescriptionNodes(nodes: DescriptionNode[], opts?: { silent?: boolean }) {
    if (!editingDescriptionId) return;
    const text = nodesToPlainText(nodes, effectiveTags).trim();
    if (!text) {
      // Click afuera con descripción vacía: descartamos el cambio.
      if (opts?.silent) {
        cancelDescriptionEdit();
        return;
      }
      toast.error("La descripción no puede quedar vacía");
      return;
    }
    updateCostStore(tripId, editingDescriptionId, { descriptionNodes: nodes });
    setEditingDescriptionId(null);
    setDescriptionDraft("");
  }

  function cancelDescriptionEdit() {
    setEditingDescriptionId(null);
    setDescriptionDraft("");
  }


  function startCategoryEdit(c: CostItem) {
    if (editingId || editingNoteId || editingDescriptionId || editingAmountId) return;
    setEditingCategoryId(c.id);
    setCategoryDraft(c.category);
  }

  function saveCategoryEdit() {
    if (!editingCategoryId) return;
    updateCostStore(tripId, editingCategoryId, {
      category: categoryDraft,
      perPerson: categoryDraft === "variable",
    });
    setEditingCategoryId(null);
  }

  function cancelCategoryEdit() {
    setEditingCategoryId(null);
  }

  function startAmountEdit(c: CostItem) {
    if (editingId || editingNoteId || editingDescriptionId || editingCategoryId) return;
    setEditingAmountId(c.id);
    setAmountDraft({
      amount: c.isDraft ? "" : String(c.amount),
      currency: c.currency,
    });
  }

  function saveAmountEdit(opts?: { silent?: boolean }) {
    if (!editingAmountId) return;
    const cost = costs.find((x) => x.id === editingAmountId);
    if (!cost) {
      setEditingAmountId(null);
      return;
    }
    const rawAmount = amountDraft.amount.trim();
    const hasAmount = rawAmount !== "";
    const parsed = hasAmount ? parseFloat(rawAmount) : NaN;
    if (hasAmount && (isNaN(parsed) || parsed < 0)) {
      // Click afuera con monto inválido: descartamos el cambio.
      if (opts?.silent) {
        setEditingAmountId(null);
        return;
      }
      toast.error("El monto debe ser un número válido (o dejalo vacío)");
      return;
    }
    const isDraft = !hasAmount;
    const conv = buildCostConversion(isDraft ? null : parsed, amountDraft.currency, trip);
    updateCostStore(tripId, editingAmountId, {
      amount: conv.amount,
      currency: conv.currency,
      amountUSD: conv.amountUSD,
      isDraft: isDraft ? true : false,
      originalAmount: conv.originalAmount,
      originalCurrency: conv.originalCurrency,
      baseCurrency: conv.baseCurrency,
      rateUsed: conv.rateUsed,
      convertedAmount: conv.convertedAmount,
    });
    setEditingAmountId(null);
  }

  function cancelAmountEdit() {
    setEditingAmountId(null);
  }

  // ── Guardar al hacer click afuera ───────────────────────────────
  // Solo una edición inline puede estar activa a la vez; el contenedor
  // correspondiente lleva `data-inline-editing="<key>"`.
  const activeInlineEdit = editingId
    ? `row:${editingId}`
    : editingNoteId
      ? `note:${editingNoteId}`
      : editingCategoryId
        ? `category:${editingCategoryId}`
        : null;

  useCommitOnClickOutside(activeInlineEdit, () => {
    if (editingId) saveEdit(false, { silent: true });
    else if (editingNoteId) saveNoteEdit();
    else if (editingCategoryId) saveCategoryEdit();
  });



  const groupedCosts = useMemo(() => {
    const timeToMinutes = (time?: string): number | null => {
      if (!time || time.trim() === "") return null;
      const [h, m] = time.split(":").map(Number);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    };
    const sortItems = (arr: CostItem[]) =>
      [...arr].sort((a, b) => {
        const aStart = a.startTime ?? a.time;
        const bStart = b.startTime ?? b.time;
        const aMinutes = timeToMinutes(aStart);
        const bMinutes = timeToMinutes(bStart);
        // Con hora: orden cronológico; sin hora: van al final y se ordenan por creación.
        if (aMinutes != null && bMinutes != null) return aMinutes - bMinutes;
        if (aMinutes != null && bMinutes == null) return -1;
        if (aMinutes == null && bMinutes != null) return 1;
        return a.createdAt - b.createdAt;
      });

    const generalItems: CostItem[] = [];
    const byDay = new Map<number, CostItem[]>();
    for (const c of costs) {
      if (c.itineraryDay == null) {
        generalItems.push(c);
      } else {
        const arr = byDay.get(c.itineraryDay) ?? [];
        arr.push(c);
        byDay.set(c.itineraryDay, arr);
      }
    }

    const groups: {
      key: string;
      label: string;
      day: number | null;
      city: string;
      title: string;
      items: CostItem[];
    }[] = [
      {
        key: "general",
        label: "General",
        day: null,
        city: "",
        title: "",
        items: sortItems(generalItems),
      },
    ];
    const daySet = new Set<number>(byDay.keys());
    itineraryDayOptions.forEach((o) => daySet.add(o.day));
    const dayNumbers = Array.from(daySet).sort((a, b) => a - b);
    const dayDate = (day: number): string | null => {
      if (!startDate) return null;
      const parts = startDate.split("-").map(Number);
      const [y, m, d] = parts;
      if (!y || !m || !d) return null;
      const date = new Date(y, m - 1, d);
      if (isNaN(date.getTime())) return null;
      date.setDate(date.getDate() + (day - 1));
      return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    };
    for (const day of dayNumbers) {
      const info = itinerary.find((d) => d.day === day);
      const date = dayDate(day);
      const base = `Día ${day}${date ? ` · ${date}` : ""}`;
      const label = info?.title ? `${base} — ${info.title}` : base;
      groups.push({
        key: `day-${day}`,
        label,
        day,
        city: info?.city ?? "",
        title: info?.title ?? "",
        items: sortItems(byDay.get(day) ?? []),
      });
    }
    return groups;
  }, [costs, itinerary, startDate, itineraryDayOptions]);

  const cityOptions = useMemo(() => {
    const map = new Map<string, string>();
    (itinerary ?? []).forEach((d) => {
      const raw = d.city?.trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!map.has(key)) map.set(key, raw);
    });
    return Array.from(map, ([key, label]) => ({ key, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [itinerary]);
  const multiCity = cityOptions.length > 1;

  const [cityFilter, setCityFilter] = useState<string>("all");
  const [includedFilter, setIncludedFilter] = useState<"all" | "included" | "not_included">("all");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  useEffect(() => {
    if (
      cityFilter !== "all" &&
      cityFilter !== "none" &&
      !cityOptions.some((c) => c.key === cityFilter)
    ) {
      setCityFilter("all");
    }
  }, [cityFilter, cityOptions]);

  const visibleGroups = useMemo(() => {
    const cityFiltered =
      cityFilter === "all"
        ? groupedCosts
        : groupedCosts.filter((g) => {
            if (g.day == null) return false; // General no aplica a filtro de ciudad
            const key = g.city.trim().toLowerCase();
            if (cityFilter === "none") return key === "";
            return key === cityFilter;
          });
    const withIncluded =
      includedFilter === "all"
        ? cityFiltered
        : cityFiltered
            .map((g) => ({
              ...g,
              items: g.items.filter((it) =>
                includedFilter === "included" ? it.included !== false : it.included === false,
              ),
            }))
            .filter((g) => g.items.length > 0);
    const withPinned = !pinnedOnly
      ? withIncluded
      : withIncluded
          .map((g) => ({ ...g, items: g.items.filter((it) => it.isPinned === true) }))
          .filter((g) => g.items.length > 0);
    if (activeTagIds.size === 0) return withPinned;
    // AND lógico entre tags seleccionados.
    return withPinned
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => {
          const ids = collectTagIds(it.descriptionNodes);
          for (const t of activeTagIds) if (!ids.has(t)) return false;
          return true;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [groupedCosts, cityFilter, includedFilter, pinnedOnly, activeTagIds]);

  // Base de multiplicación para costos variables: siempre usamos la capacidad
  // planificada (campo VIAJERAS). La organizadora ajusta ese número a mano;
  // al finalizar el viaje lo cambia por el número real que asistió.
  const variableBasis = trip.capacity;
  const totals = useMemo(() => {
    const isNotIncluded = (c: CostItem) => c.included === false || c.category === "no_incluido";
    const included = costs.filter((c) => !isNotIncluded(c));
    const fixed = included
      .filter((c) => c.category === "fijo")
      .reduce((s, c) => s + costBaseAmount(c, trip), 0);
    const variable = included
      .filter((c) => c.category === "variable")
      .reduce((s, c) => s + costBaseAmount(c, trip) * variableBasis, 0);
    const team = included
      .filter((c) => c.category === "equipo")
      .reduce((s, c) => s + costBaseAmount(c, trip), 0);
    const notIncluded = costs
      .filter(isNotIncluded)
      .reduce((s, c) => s + costBaseAmount(c, trip), 0);
    return { fixed, variable, team, notIncluded, total: fixed + variable + team };
  }, [costs, variableBasis, trip]);

  function startNewCostForGroup(day: number | null) {
    // Cierro cualquier edición previa antes de iniciar una nueva.
    setEditingNoteId(null);
    setNoteDraft("");
    setEditingDescriptionId(null);
    setDescriptionDraft("");
    setEditingCategoryId(null);
    setEditingAmountId(null);

    const id = generateId();
    const conv = buildCostConversion(null, defaultCostCurrency, trip);
    addCostStore(tripId, {
      id,
      description: "",
      notes: "",
      category: "fijo",
      amount: conv.amount,
      currency: conv.currency,
      amountUSD: conv.amountUSD,
      perPerson: false,
      itineraryDay: day,
      included: true,
      isDraft: true,
      originalAmount: conv.originalAmount,
      originalCurrency: conv.originalCurrency,
      baseCurrency: conv.baseCurrency,
      rateUsed: conv.rateUsed,
      convertedAmount: conv.convertedAmount,
    });
    setPendingNewId(id);
    setEditingId(id);
    setDraft({
      description: "",
      notes: "",
      category: "fijo",
      amount: "",
      currency: defaultCostCurrency,
      itineraryDay: day == null ? "none" : String(day),
      startTime: "",
      endTime: "",
      included: true,
    });
  }

  function updateCostDay(id: string, day: string) {
    setCostDayStore(tripId, id, day === "none" ? null : parseInt(day, 10));
  }

  function deleteCost(id: string) {
    if (editingId === id) cancelEdit();
    removeCostStore(tripId, id);
  }

  const costsFinance = useMemo(() => calculateTripFinancials(trip, costs), [trip, costs]);
  const profitMarginPercent =
    trip.pricePerPerson > 0 ? (costsFinance.profitPerPerson / trip.pricePerPerson) * 100 : 0;

  return (
    <div className="mt-4 space-y-4">
      {/* Métricas por persona */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Precio por persona" tone="primary">
          {canEditTrip ? (
            <EditablePrice trip={trip} />
          ) : (
            <span className="text-2xl font-bold text-foreground tabular-nums">
              {formatMoney(trip.pricePerPerson, tripBaseCurrency)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {tripBaseCurrency}
              </span>
            </span>
          )}
        </StatCard>
        <StatCard label="Costo por persona" tone="blue">
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {formatMoney(costsFinance.costPerPerson, tripBaseCurrency)}
          </span>
        </StatCard>
        <StatCard
          label="Utilidad por persona"
          tone={costsFinance.profitPerPerson >= 0 ? "success" : "danger"}
        >
          <span
            className={`text-2xl font-bold tabular-nums ${costsFinance.profitPerPerson >= 0 ? "text-chart-3" : "text-destructive"}`}
          >
            {formatMoney(costsFinance.profitPerPerson, tripBaseCurrency)}
          </span>
          <span className="block text-xs font-normal text-muted-foreground mt-0.5">
            {profitMarginPercent.toFixed(1)}% de margen
          </span>
        </StatCard>
      </div>

      {/* Métricas grupales — expresadas en la moneda base del viaje.
          Utilidad total = Precio grupal − Costo grupal (consistente con las
          tarjetas mostradas arriba). No usamos `profitActual` porque cuando
          hay inscriptas con pagos registrados éste refleja lo NETO cobrado
          (descontando fees/reembolsos) y no cuadraría con el Precio grupal
          proyectado que se muestra al lado. */}
      {(() => {
        const precioGrupal = trip.pricePerPerson * costsFinance.projectionBasis;
        const costoGrupal = costsFinance.totalCostActual;
        const utilidadTotal = precioGrupal - costoGrupal;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Precio grupal" tone="beige">
              <span className="text-xl font-normal text-foreground tabular-nums">
                {formatMoney(precioGrupal, tripBaseCurrency)}
              </span>
            </StatCard>
            <StatCard label="Costo grupal" tone="beige">
              <span className="text-xl font-normal text-foreground tabular-nums">
                {formatMoney(costoGrupal, tripBaseCurrency)}
              </span>
            </StatCard>
            <StatCard
              label="Utilidad total"
              tone={utilidadTotal >= 0 ? "beige" : "danger"}
            >
              <span
                className={`text-xl font-normal tabular-nums ${utilidadTotal >= 0 ? "text-foreground" : "text-destructive"}`}
              >
                {formatMoney(utilidadTotal, tripBaseCurrency)}
              </span>
            </StatCard>
          </div>
        );
      })()}


      {/* Gasto adicional informativo (no afecta finanzas) + punto de equilibrio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-dashed border-muted-foreground/30 bg-muted/20">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-background flex items-center justify-center shrink-0">
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Gasto estimado adicional por persona
              </p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                ~{formatMoney(totals.notIncluded, tripBaseCurrency)}
                <span className="text-xs font-normal text-muted-foreground ml-1.5">aprox.</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Costos no incluidos en el paquete · informativo, no afecta utilidad ni punto de
                equilibrio
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed border-muted-foreground/30 bg-muted/20">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-background flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Punto de equilibrio
              </p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {isFinite(costsFinance.breakEven) ? (
                  <>
                    {costsFinance.breakEven}
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">
                      {costsFinance.breakEven === 1 ? "viajera" : "viajeras"}
                    </span>
                  </>
                ) : (
                  "—"
                )}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {!isFinite(costsFinance.breakEven)
                  ? "El precio por persona no cubre los costos variables"
                  : costsFinance.breakEvenReached
                    ? `Alcanzado · ${costsFinance.activeCount} inscritas`
                    : `Faltan ${Math.max(0, costsFinance.breakEven - costsFinance.activeCount)} para cubrir costos fijos y equipo`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Costs tables grouped by itinerary day */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 px-1">
          <div className="mr-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleUndo}
              disabled={!history.canUndo}
              title="Deshacer (Ctrl/Cmd+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" /> Deshacer
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleRedo}
              disabled={!history.canRedo}
              title="Rehacer (Ctrl/Cmd+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" /> Rehacer
            </Button>
          </div>
          {cityOptions.length > 0 && (
            <div className="flex w-full sm:w-auto items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>Ciudad</span>
              </div>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="h-8 w-full sm:w-[180px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las ciudades</SelectItem>
                  {cityOptions.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="none">Sin ciudad asignada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex w-full sm:w-auto items-center gap-2">
            <span className="text-xs text-muted-foreground">Incluido</span>
            <Select
              value={includedFilter}
              onValueChange={(v) => setIncludedFilter(v as typeof includedFilter)}
            >
              <SelectTrigger className="h-8 w-full sm:w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="included">Solo incluidos</SelectItem>
                <SelectItem value="not_included">Solo no incluidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant={pinnedOnly ? "default" : "outline"}
            size="sm"
            className="h-8 px-2.5 text-xs gap-1.5"
            onClick={() => setPinnedOnly((v) => !v)}
            title="Mostrar solo costos marcados"
          >
            <Pin className={`h-3.5 w-3.5 ${pinnedOnly ? "fill-current" : ""}`} />
            Solo marcados
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs gap-1.5"
            onClick={() => setTagManagerOpen(true)}
            title="Gestionar tags del itinerario"
          >
            <Tag className="h-3.5 w-3.5" />
            Gestionar tags
          </Button>
          {(cityFilter !== "all" ||
            includedFilter !== "all" ||
            pinnedOnly ||
            activeTagIds.size > 0) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground"
              onClick={() => {
                setCityFilter("all");
                setIncludedFilter("all");
                setPinnedOnly(false);
                setActiveTagIds(new Set());
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
        <TagFilterBar
          tags={effectiveTags}
          counts={tagUsageCounts}
          activeIds={activeTagIds}
          onToggle={toggleTagFilter}
          onClear={() => setActiveTagIds(new Set())}
        />
        <TagManagerDialog
          open={tagManagerOpen}
          onOpenChange={setTagManagerOpen}
          tags={effectiveTags}
          usageCounts={tagUsageCounts}
          onAdd={(label, colorKey) => addTagStore(tripId, label, colorKey)}
          onUpdate={(id, patch) => updateTagStore(tripId, id, patch)}
          onRemove={(id, mode) => removeTagStore(tripId, id, mode)}
        />

        {visibleGroups.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
            No hay costos que coincidan con los filtros.
          </div>
        ) : (
          visibleGroups.map((group) => (
            <div
              key={group.key}
              className="space-y-2"
              data-testid={`cost-group-${group.key}`}
              data-cost-day={group.day ?? "general"}
            >
              <div className="flex items-center gap-2 px-1 flex-wrap min-w-0">
                <h3 className="text-sm font-semibold text-secondary-foreground">{group.label}</h3>
                {group.day != null && (
                  <DayCityEditor
                    city={group.city}
                    highlight={multiCity}
                    onChange={(next) => setDayCityStore(tripId, group.day as number, next)}
                  />
                )}
              </div>
              <Card className="border-border/40 md:[&>div]:overflow-x-hidden">
                <Table className="table-fixed w-full max-w-full min-w-[900px] md:min-w-0">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[19%]" />
                    <col className="w-[24%] min-w-[180px] md:min-w-0" />
                    <col className="w-[9%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[6%]" />
                    <col className="w-[8%] min-w-[72px] sm:min-w-[88px]" />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="border-b border-border/80 hover:bg-transparent">
                      <TableHead className="text-terracotta font-semibold bg-[color-mix(in_oklab,var(--terracotta)_10%,var(--card))] sticky left-0 z-20 md:static">
                        Día itinerario
                      </TableHead>
                      <TableHead className="bg-secondary/60 text-secondary-foreground font-semibold">
                        Descripción
                      </TableHead>
                      <TableHead className="bg-secondary/60 text-secondary-foreground font-semibold">
                        Notas
                      </TableHead>
                      <TableHead className="bg-secondary/60 text-secondary-foreground font-semibold">
                        Categoría
                      </TableHead>
                      <TableHead className="text-center bg-secondary/60 text-secondary-foreground font-semibold">
                        Incluido
                      </TableHead>
                      <TableHead className="text-right bg-secondary/60 text-secondary-foreground font-semibold">
                        Monto original
                      </TableHead>
                      <TableHead className="text-right bg-secondary/60 text-secondary-foreground font-semibold">
                        USD
                      </TableHead>
                      <TableHead className="bg-secondary/60"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-xs text-muted-foreground py-6"
                        >
                          Sin costos en este bloque
                        </TableCell>
                      </TableRow>
                    ) : (
                      group.items.map((cost) => {
                        const cat = categoryConfig[cost.category];
                        const dayInfo =
                          cost.itineraryDay != null
                            ? itinerary.find((d) => d.day === cost.itineraryDay)
                            : null;
                        const isEditing = editingId === cost.id;

                        if (isEditing && draft) {
                          return (
                            <TableRow
                              key={cost.id}
                              data-inline-editing={`row:${cost.id}`}
                              className="bg-primary/5"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey && !e.defaultPrevented) {
                                  const target = e.target as HTMLElement;
                                  // Let textareas / contenteditable handle their own Enter
                                  if (
                                    target.tagName === "TEXTAREA" ||
                                    target.getAttribute("contenteditable") === "true"
                                  ) {
                                    return;
                                  }
                                  e.preventDefault();
                                  saveEdit();
                                } else if (e.key === "Escape" && !e.defaultPrevented) {
                                  e.preventDefault();
                                  cancelEdit();
                                }
                              }}
                            >
                              <TableCell className="bg-[color-mix(in_oklab,var(--terracotta)_10%,var(--card))] sticky left-0 z-20 md:static">
                                <div className="flex flex-col gap-1">
                                  <Select
                                    value={draft.itineraryDay}
                                    onValueChange={(v) => setDraft({ ...draft, itineraryDay: v })}
                                  >
                                    <SelectTrigger className="h-auto p-0 bg-transparent border-transparent text-[10px] font-bold text-terracotta focus:ring-0 focus:ring-offset-0 shadow-none justify-start">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Sin asignar</SelectItem>
                                      {itineraryDayOptions.map((option) => (
                                        <SelectItem key={option.day} value={String(option.day)}>
                                          Día {option.day}
                                          {option.title ? ` — ${option.title}` : ""}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <InlineTimeEditor
                                    costId={cost.id}
                                    startTime={draft.startTime}
                                    endTime={draft.endTime}
                                    onChange={async (next) => {
                                      // Update local draft immediately for row-save later.
                                      setDraft((current) =>
                                        current
                                          ? {
                                              ...current,
                                              startTime: next.startTime ?? "",
                                              endTime: next.endTime ?? "",
                                            }
                                          : current,
                                      );
                                      // Persist to store + remote so the horario no se pierde
                                      // aunque el usuario no confirme la fila entera.
                                      await saveCostTime(cost.id, next);
                                    }}
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="h-8"
                                  value={draft.description}
                                  onChange={(e) =>
                                    setDraft({ ...draft, description: e.target.value })
                                  }
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <CostNoteEditor
                                  value={draft.notes}
                                  onChange={(html) => setDraft({ ...draft, notes: html })}
                                  onSaveShortcut={saveEdit}
                                  onCancelShortcut={cancelEdit}
                                  placeholder="—"
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={draft.category}
                                  onValueChange={(v) =>
                                    setDraft({ ...draft, category: v as CostCategory })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="fijo">Fijo</SelectItem>
                                    <SelectItem value="variable">Variable</SelectItem>
                                    <SelectItem value="equipo">Equipo</SelectItem>
                                    <SelectItem value="no_incluido">
                                      No incluido / gasto personal
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={draft.included}
                                  onCheckedChange={(v) => setDraft({ ...draft, included: v })}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 justify-end">
                                  <Input
                                    type="number"
                                    className="h-8 w-24 text-right"
                                    value={draft.amount}
                                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                                  />
                                  <Select
                                    value={draft.currency}
                                    onValueChange={(v) =>
                                      setDraft({ ...draft, currency: v as Currency })
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-20 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CURRENCIES.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>
                                          {c.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                {(() => {
                                  const a = parseFloat(draft.amount);
                                  if (isNaN(a)) return "—";
                                  const conv = buildCostConversion(a, draft.currency, trip);
                                  const b = conv.convertedAmount ?? conv.amountUSD;
                                  return formatMoney(b, tripBaseCurrency);
                                })()}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-chart-3"
                                    onClick={() => saveEdit()}
                                    title="Guardar"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={cancelEdit}
                                    title="Cancelar"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return (
                          <TableRow
                            key={cost.id}
                            className={`${cost.itineraryDay == null ? "bg-muted/20" : ""} ${cost.isDraft ? "opacity-70 border-l-2 border-l-amber-500/60" : ""} ${cost.isPinned ? "bg-amber-50/70 dark:bg-amber-500/10 border-l-2 border-l-amber-500" : ""}`}
                          >
                            <TableCell className="bg-[color-mix(in_oklab,var(--terracotta)_10%,var(--card))] sticky left-0 z-20 md:static">
                              <div className="flex flex-col gap-1">
                                <Select
                                  value={
                                    cost.itineraryDay == null ? "none" : String(cost.itineraryDay)
                                  }
                                  onValueChange={(v) => updateCostDay(cost.id, v)}
                                >
                                  <SelectTrigger className="h-auto p-0 bg-transparent border-transparent focus:ring-0 focus:ring-offset-0 shadow-none text-[10px] font-bold text-terracotta justify-start">
                                    <SelectValue>
                                      {cost.itineraryDay == null ? (
                                        <span className="italic text-[11px] text-muted-foreground">
                                          General
                                        </span>
                                      ) : (
                                        <span>Día {cost.itineraryDay}</span>
                                      )}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Sin asignar</SelectItem>
                                    {itineraryDayOptions.map((option) => (
                                      <SelectItem key={option.day} value={String(option.day)}>
                                        Día {option.day}
                                        {option.title ? ` — ${option.title}` : ""}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <InlineTimeEditor
                                  costId={cost.id}
                                  startTime={cost.startTime ?? cost.time}
                                  endTime={cost.endTime}
                                  onChange={(next) => saveCostTime(cost.id, next)}
                                  disabled={!canEditTrip}
                                />
                              </div>
                            </TableCell>

                            <TableCell className="font-medium align-top whitespace-normal break-words [overflow-wrap:anywhere]">
                              {editingDescriptionId === cost.id ? (
                                <DescriptionEditor
                                  nodes={cost.descriptionNodes}
                                  legacyText={cost.description || ""}
                                  tags={effectiveTags}
                                  onSave={(nodes, opts) => saveDescriptionNodes(nodes, opts)}
                                  inlineEditKey={`description:${cost.id}`}
                                  onCancel={cancelDescriptionEdit}
                                  onCreateTag={(label, colorKey) =>
                                    addTagStore(tripId, label, colorKey)
                                  }
                                  autoFocus
                                  placeholder="Descripción (usá / para insertar un tag)"
                                />
                              ) : (
                                <div
                                  className="cursor-pointer h-full w-full"
                                  onClick={() => startDescriptionEdit(cost)}
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <DescriptionRender
                                      nodes={cost.descriptionNodes}
                                      legacyText={cost.description || ""}
                                      tags={effectiveTags}
                                    />

                                    {cost.isDraft && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] uppercase tracking-wide border-amber-500/60 text-amber-700 dark:text-amber-400 px-1.5 py-0"
                                      >
                                        Borrador
                                      </Badge>
                                    )}
                                  </div>
                                  {dayInfo && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5 md:hidden">
                                      {dayInfo.title}
                                    </p>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="align-top whitespace-normal break-words [overflow-wrap:anywhere]">
                              {editingNoteId === cost.id ? (
                                <div
                                  className="relative w-full"
                                  data-inline-editing={`note:${cost.id}`}
                                >
                                  <CostNoteEditor
                                    value={noteDraft}
                                    onChange={setNoteDraft}
                                    onSaveShortcut={saveNoteEdit}
                                    onCancelShortcut={cancelNoteEdit}
                                    autoFocus
                                  />
                                  <div className="absolute top-1 right-1 flex gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-primary hover:text-primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        saveNoteEdit();
                                      }}
                                      title="Guardar"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-muted-foreground hover:text-muted-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        cancelNoteEdit();
                                      }}
                                      title="Cancelar"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <CostNoteDisplay
                                  value={cost.notes}
                                  className="cursor-pointer text-sm text-muted-foreground h-full w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                                  onClick={() => startNoteEdit(cost)}
                                />
                              )}
                            </TableCell>
                            <TableCell
                              className="cursor-pointer"
                              onClick={() => startCategoryEdit(cost)}
                            >
                              {editingCategoryId === cost.id ? (
                                <div
                                  className="relative flex items-center gap-1"
                                  data-inline-editing={`category:${cost.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      saveCategoryEdit();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelCategoryEdit();
                                    }
                                  }}
                                >
                                  <Select
                                    value={categoryDraft}
                                    onValueChange={(v) => setCategoryDraft(v as CostCategory)}
                                  >
                                    <SelectTrigger className="h-7 text-[11px] pr-14 flex-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="fijo">Fijo</SelectItem>
                                      <SelectItem value="variable">Variable</SelectItem>
                                      <SelectItem value="equipo">Equipo</SelectItem>
                                      <SelectItem value="no_incluido">
                                        No incluido / gasto personal
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <div className="absolute top-1/2 -translate-y-1/2 right-1 flex gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-primary hover:text-primary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        saveCategoryEdit();
                                      }}
                                      title="Guardar"
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5 text-muted-foreground hover:text-muted-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        cancelCategoryEdit();
                                      }}
                                      title="Cancelar"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <CategoryBadge cat={cat} />
                              )}
                            </TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                <Switch
                                  checked={cost.included !== false}
                                  onCheckedChange={(v) =>
                                    updateCostStore(tripId, cost.id, { included: v })
                                  }
                                />
                                <span className="text-[10px] text-muted-foreground">
                                  {cost.included === false ? "No" : "Sí"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell
                              className="text-right tabular-nums text-muted-foreground cursor-pointer"
                              onClick={() => startAmountEdit(cost)}
                            >
                              {editingAmountId === cost.id ? (
                                <Popover
                                  open
                                  onOpenChange={(o) => {
                                    // Click afuera: confirmamos el monto; si es
                                    // inválido se descarta en silencio.
                                    if (!o) saveAmountEdit({ silent: true });
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <span className="italic text-muted-foreground/70">
                                      editando…
                                    </span>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    align="end"
                                    className="w-auto p-2"
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        saveAmountEdit();
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        cancelAmountEdit();
                                      }
                                    }}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <Input
                                        type="number"
                                        autoFocus
                                        className="h-8 w-24 text-right text-xs"
                                        value={amountDraft.amount}
                                        onChange={(e) =>
                                          setAmountDraft((d) => ({ ...d, amount: e.target.value }))
                                        }
                                      />
                                      <Select
                                        value={amountDraft.currency}
                                        onValueChange={(v) =>
                                          setAmountDraft((d) => ({ ...d, currency: v as Currency }))
                                        }
                                      >
                                        <SelectTrigger className="h-8 w-20 text-[11px] pr-1">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {CURRENCIES.map((c) => (
                                            <SelectItem key={c.value} value={c.value}>
                                              {c.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-primary hover:text-primary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          saveAmountEdit();
                                        }}
                                        title="Guardar (Enter)"
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-muted-foreground"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          cancelAmountEdit();
                                        }}
                                        title="Cancelar (Esc)"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : cost.isDraft ? (
                                <span className="italic text-muted-foreground/70">Sin monto</span>
                              ) : (
                                <>
                                  {cost.amount.toLocaleString()} {cost.currency}
                                </>
                              )}
                            </TableCell>

                            <TableCell
                              className="text-right tabular-nums font-medium cursor-pointer"
                              onClick={() => startAmountEdit(cost)}
                            >
                              {cost.isDraft ? (
                                <span className="text-muted-foreground/60">—</span>
                              ) : (
                                <div className="flex flex-col items-end leading-tight">
                                  <div>
                                    {(() => {
                                      const b = costBaseAmount(cost, trip);
                                      return formatMoney(b, tripBaseCurrency);
                                    })()}
                                    {cost.perPerson && (
                                      <span
                                        className="ml-1 text-[10px] text-muted-foreground"
                                        title={`Total: ${formatMoney(costBaseAmount(cost, trip) * variableBasis, tripBaseCurrency)} (${variableBasis} viajera${variableBasis === 1 ? "" : "s"} planificadas)`}
                                      >
                                        ×{variableBasis}
                                      </span>
                                    )}
                                  </div>
                                  {cost.perPerson && (
                                    <div className="text-[10px] text-muted-foreground font-normal">
                                      {formatMoney(costBaseAmount(cost, trip) * variableBasis, tripBaseCurrency)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex gap-0.5 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 sm:h-6 sm:w-6 shrink-0"
                                  onClick={() =>
                                    updateCostStore(tripId, cost.id, { isPinned: !cost.isPinned })
                                  }
                                  title={cost.isPinned ? "Quitar marca" : "Marcar para revisar"}
                                >
                                  <Pin
                                    className={`h-2.5 w-2.5 ${cost.isPinned ? "text-amber-600/80 fill-amber-500/60" : "text-muted-foreground/70"}`}
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 sm:h-6 sm:w-6 shrink-0"
                                  onClick={() => startEdit(cost)}
                                  title="Editar"
                                >
                                  <Pencil className="h-2.5 w-2.5 text-muted-foreground/70" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 sm:h-6 sm:w-6 shrink-0"
                                  onClick={() => deleteCost(cost.id)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-2.5 w-2.5 text-muted-foreground/70" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </Card>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/70 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-border sm:w-auto sm:justify-start sm:border-0 sm:py-1 sm:px-1"
                onClick={() => startNewCostForGroup(group.day)}
              >
                <Plus className="h-3.5 w-3.5" /> Agregar costo aquí
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Tab: Viajeras ───────────────────────────────────────────
type StatusFilter = "todas" | "activas" | "canceladas";
type PaymentFilter =
  | "todos"
  | "pagado"
  | "cuotas"
  | "pendiente"
  | "vencidas"
  | "con_descuento"
  | "parcial";
type SortKey = "nombre" | "inscripcion" | "saldo" | "proxima" | "porcentaje";

function EnrolleesTab({
  tripId,
  enrollees,
  capacity,
  pricePerPerson,
}: {
  tripId: string;
  enrollees: Enrollee[];
  capacity: number;
  pricePerPerson: number;
}) {
  const agg = useMemo(
    () => aggregateEnrollees(enrollees, pricePerPerson),
    [enrollees, pricePerPerson],
  );
  const trip = useTripsStore((s) => s.trips[tripId]);
  const canManageTravelers = usePermissions(tripId).canManageTravelers;
  const [showRules, setShowRules] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [subTab, setSubTab] = useState<"inscripciones" | "logistica">("inscripciones");



  // Filtros / búsqueda / orden
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("inscripcion");

  // Cuotas vencidas (solo activas)
  const overdueCount = useMemo(() => {
    let count = 0;
    for (const e of enrollees) {
      if (e.status === "cancelada") continue;
      for (const i of e.installments) {
        if (isOverdue(i)) count++;
      }
    }
    return count;
  }, [enrollees]);

  // ─── Sección "Requieren atención" ─────────────────────────
  // Solo notifica cuotas vencidas: pendientes cuya fecha de pago ya pasó.
  const attention = useMemo(() => {
    const overdue: { e: Enrollee; count: number; amount: number }[] = [];

    for (const e of enrollees) {
      if (e.status === "cancelada") continue;
      const overdueInst = e.installments.filter((i) => isOverdue(i));
      if (overdueInst.length > 0) {
        overdue.push({
          e,
          count: overdueInst.length,
          amount: overdueInst.reduce((s, i) => s + i.amount, 0),
        });
      }
    }

    return { overdue };
  }, [enrollees]);

  const attentionTotal = attention.overdue.length;


  // Lista filtrada y ordenada
  const visibleEnrollees = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = enrollees.filter((e) => {
      // status
      if (statusFilter === "activas" && e.status === "cancelada") return false;
      if (statusFilter === "canceladas" && e.status !== "cancelada") return false;
      // search
      if (q) {
        const hay = `${e.name} ${e.email} ${e.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // payment
      if (paymentFilter !== "todos") {
        const fin = deriveEnrolleeFinancials(e, pricePerPerson);
        if (paymentFilter === "pagado" && fin.status !== "pagado") return false;
        if (paymentFilter === "cuotas" && fin.status !== "parcial") return false;
        if (paymentFilter === "pendiente" && fin.status !== "pendiente") return false;
        if (paymentFilter === "vencidas") {
          const has = e.status !== "cancelada" && e.installments.some((i) => isOverdue(i));
          if (!has) return false;
        }
        if (paymentFilter === "con_descuento" && (!e.discount || (e.discount.value ?? 0) <= 0))
          return false;
        if (paymentFilter === "parcial" && e.participation?.mode !== "parcial") return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      const fa = deriveEnrolleeFinancials(a, pricePerPerson);
      const fb = deriveEnrolleeFinancials(b, pricePerPerson);
      switch (sortKey) {
        case "nombre":
          return a.name.localeCompare(b.name, "es");
        case "saldo":
          return fb.amountPending - fa.amountPending;
        case "porcentaje": {
          const pa = fa.totalDue > 0 ? fa.amountPaid / fa.totalDue : 0;
          const pb = fb.totalDue > 0 ? fb.amountPaid / fb.totalDue : 0;
          return pb - pa;
        }
        case "proxima": {
          const da = fa.nextDue?.dueDate ?? "9999-99-99";
          const db = fb.nextDue?.dueDate ?? "9999-99-99";
          return da.localeCompare(db);
        }
        case "inscripcion":
        default:
          return a.enrolledAt.localeCompare(b.enrolledAt);
      }
    });
    return list;
  }, [enrollees, search, statusFilter, paymentFilter, sortKey, pricePerPerson]);

  return (
    <div className="mt-4 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "VIAJERAS ACTIVAS", value: `${agg.count}/${capacity}` },
          {
            label: "COBRADO",
            value: formatUSD(agg.netRevenue + agg.extrasCollected),
            color: "text-chart-3",
            sub:
              agg.extrasCount > 0
                ? `Viaje ${formatUSD(agg.netRevenue)} + extras ${formatUSD(agg.extrasCollected)}`
                : undefined,
          },
          {
            label: "POR COBRAR",
            value: formatUSD(agg.totalPending + agg.extrasPending),
            color: "text-chart-4",
            sub:
              agg.extrasCount > 0
                ? `Viaje ${formatUSD(agg.totalPending)} + extras ${formatUSD(agg.extrasPending)}`
                : undefined,
          },
          {
            label: "CUOTAS VENCIDAS",
            value: overdueCount.toString(),
            color: overdueCount > 0 ? "text-destructive" : undefined,
            warning: overdueCount > 0,
          },
          { label: "PAGOS COMPLETOS", value: agg.fullyPaid.toString() },
          { label: "PAGOS PENDIENTES", value: agg.withPending.toString() },
          ...(agg.totalRefunded > 0
            ? [
                {
                  label: "DEVUELTO",
                  value: formatUSD(agg.totalRefunded),
                  color: "text-destructive",
                },
              ]
            : []),
          ...(agg.cancelledCount > 0
            ? [
                {
                  label: "CANCELADAS",
                  value: agg.cancelledCount.toString(),
                  color: "text-muted-foreground",
                },
              ]
            : []),
        ].map((s) => (
          <Card
            key={s.label}
            className={`border-border/40 ${s.warning ? "border-destructive/30" : ""}`}
          >
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {s.label}
              </p>
              <p className={`text-lg font-bold tabular-nums ${s.color ?? "text-foreground"}`}>
                {s.value}
              </p>
              {s.sub && (
                <p className="text-[10px] text-muted-foreground mt-1 tabular-nums leading-tight">
                  {s.sub}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Acciones globales */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={() => setShowAddDialog(true)}>
          <UserPlus className="h-3.5 w-3.5" /> Inscribir viajera
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowRules((v) => !v)}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {showRules ? "Ocultar políticas" : "Políticas de devolución"}
          <Badge variant="secondary" className="ml-1 text-[10px]">
            {trip?.refundRules?.length ?? 0}
          </Badge>
        </Button>
      </div>
      {showRules && trip && (
        <div>
          <RefundRulesEditor tripId={tripId} rules={trip.refundRules ?? []} />
        </div>
      )}

      {/* Requieren atención */}
      {attentionTotal > 0 && (
        <AttentionSection
          overdue={attention.overdue}

          onSelectEnrollee={(enrolleeId) => {
            // Disparar apertura + scroll en la card correspondiente
            window.dispatchEvent(new CustomEvent("viajera:focus", { detail: { enrolleeId } }));
          }}
        />
      )}

      {/* Sub-secciones: Inscripciones / Logística */}
      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as "inscripciones" | "logistica")}>
        <TabsList className="bg-secondary/60">
          <TabsTrigger value="inscripciones">Inscripciones</TabsTrigger>
          <TabsTrigger value="logistica" className="gap-1.5">
            <Plane className="h-3.5 w-3.5" /> Logística
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inscripciones" className="mt-4 space-y-4">
          {/* Buscador + filtros + orden */}
          {enrollees.length > 0 && (
            <Card className="border-border/40 bg-muted/10">
              <CardContent className="p-3 flex flex-wrap items-center gap-2 [&_button[role=combobox]]:w-full sm:[&_button[role=combobox]]:w-auto">
                <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, email o teléfono…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 pl-8 text-sm"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                  <SelectTrigger className="h-9 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="activas">Solo activas</SelectItem>
                    <SelectItem value="canceladas">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={paymentFilter}
                  onValueChange={(v) => setPaymentFilter(v as PaymentFilter)}
                >
                  <SelectTrigger className="h-9 w-[160px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Cualquier pago</SelectItem>
                    <SelectItem value="pagado">Pagadas</SelectItem>
                    <SelectItem value="cuotas">En cuotas</SelectItem>
                    <SelectItem value="pendiente">Sin pagar</SelectItem>
                    <SelectItem value="vencidas">Con cuota vencida</SelectItem>
                    <SelectItem value="con_descuento">Con descuento</SelectItem>
                    <SelectItem value="parcial">Participación parcial</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                  <SelectTrigger className="h-9 w-[170px] text-xs gap-1">
                    <ArrowUpDown className="h-3 w-3" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inscripcion">Por inscripción</SelectItem>
                    <SelectItem value="nombre">Por nombre</SelectItem>
                    <SelectItem value="saldo">Por saldo pendiente</SelectItem>
                    <SelectItem value="proxima">Por próxima cuota</SelectItem>
                    <SelectItem value="porcentaje">Por % pagado</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                  {visibleEnrollees.length} de {enrollees.length}
                </span>
              </CardContent>
            </Card>
          )}

          {enrollees.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">Sin viajeras aún</p>
                <p className="text-sm mt-1">Inscribí la primera viajera con el botón de arriba.</p>
              </CardContent>
            </Card>
          ) : visibleEnrollees.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Ninguna viajera coincide con los filtros aplicados.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {visibleEnrollees.map((e) => (
                <EnrolleeCard
                  key={e.id}
                  tripId={tripId}
                  enrollee={e}
                  tripPrice={pricePerPerson}
                  tripStartDate={trip?.startDate ?? ""}
                  tripItineraryDays={trip?.itinerary.length ?? 0}
                  refundRules={trip?.refundRules ?? []}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logistica" className="mt-4">
          <LogisticsTab
            tripId={tripId}
            enrollees={enrollees.filter((e) => e.status !== "cancelada")}
            canEdit={canManageTravelers}
            tripStart={trip?.startDate ?? null}
            tripEnd={trip?.endDate ?? null}
          />
        </TabsContent>
      </Tabs>


      <AddEnrolleeDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        tripId={tripId}
        tripPrice={pricePerPerson}
        tripStartDate={trip?.startDate ?? ""}
      />
    </div>
  );
}

// ─── Dialog: Inscribir viajera manualmente ───────────────────
type PaymentMode = "sin_plan" | "completo" | "cuotas";

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function generateInstallmentsForMode(
  mode: PaymentMode,
  total: number,
  opts: { dueDate: string; installmentCount: number; firstDueDate: string },
): Installment[] {
  if (mode === "sin_plan") return [];
  if (mode === "completo") {
    return [
      {
        id: generateId(),
        dueDate: opts.dueDate,
        amount: Math.round(total * 100) / 100,
        status: "pendiente",
      },
    ];
  }
  // cuotas
  const n = Math.max(1, Math.min(12, opts.installmentCount));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const remainder = cents - base * n;
  const result: Installment[] = [];
  for (let i = 0; i < n; i++) {
    // Última cuota absorbe el residuo de centavos
    const amountCents = i === n - 1 ? base + remainder : base;
    result.push({
      id: generateId(),
      dueDate: addMonthsISO(opts.firstDueDate, i),
      amount: amountCents / 100,
      status: "pendiente",
    });
  }
  return result;
}

function AddEnrolleeDialog({
  open,
  onOpenChange,
  tripId,
  tripPrice,
  tripStartDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tripId: string;
  tripPrice: number;
  tripStartDate: string;
}) {
  const addEnrollee = useTripsStore((s) => s.addEnrollee);
  const setPaymentPlan = useTripsStore((s) => s.setPaymentPlan);
  const today = new Date().toISOString().slice(0, 10);
  const defaultCompletoDate = tripStartDate || addDaysISO(today, 30);
  const defaultFirstDueDate = addDaysISO(today, 30);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(today);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cuotas");
  const [installmentCount, setInstallmentCount] = useState(3);
  const [firstDueDate, setFirstDueDate] = useState(defaultFirstDueDate);
  const [completoDueDate, setCompletoDueDate] = useState(defaultCompletoDate);

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setDate(today);
    setPaymentMode("cuotas");
    setInstallmentCount(3);
    setFirstDueDate(addDaysISO(new Date().toISOString().slice(0, 10), 30));
    setCompletoDueDate(tripStartDate || addDaysISO(new Date().toISOString().slice(0, 10), 30));
  }

  function submit() {
    const n = name.trim();
    if (!n) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (n.length > 100) {
      toast.error("Nombre demasiado largo");
      return;
    }
    if (email.length > 255) {
      toast.error("Email demasiado largo");
      return;
    }
    if (phone.length > 50) {
      toast.error("Teléfono demasiado largo");
      return;
    }
    if (paymentMode === "cuotas" && (installmentCount < 1 || installmentCount > 12)) {
      toast.error("La cantidad de cuotas debe estar entre 1 y 12");
      return;
    }
    const newId = addEnrollee(tripId, {
      name: n,
      email: email.trim(),
      phone: phone.trim(),
      enrolledAt: date,
    });
    if (newId && paymentMode !== "sin_plan") {
      const installments = generateInstallmentsForMode(paymentMode, tripPrice, {
        dueDate: completoDueDate,
        installmentCount,
        firstDueDate,
      });
      if (installments.length > 0) {
        setPaymentPlan(tripId, newId, installments);
      }
    }
    const planMsg =
      paymentMode === "completo"
        ? " · pago completo"
        : paymentMode === "cuotas"
          ? ` · ${installmentCount} cuotas`
          : "";
    toast.success(`${n} inscrita${planMsg}`);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscribir viajera</DialogTitle>
          <DialogDescription>
            Se creará la viajera al precio del viaje. Elegí cómo va a pagar para generar el plan
            automáticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nombre completo *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="Ej: Ana García"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                placeholder="ana@email.com"
              />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={50}
                placeholder="+52 55 1234 5678"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Fecha de inscripción</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="pt-2 border-t">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Forma de pago
            </Label>
            <RadioGroup
              value={paymentMode}
              onValueChange={(v) => setPaymentMode(v as PaymentMode)}
              className="mt-2 gap-2"
            >
              <label className="flex items-start gap-2 rounded-md border p-2.5 cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="cuotas" id="pm-cuotas" className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">En cuotas</div>
                  <div className="text-xs text-muted-foreground">
                    Dividir el total en pagos mensuales iguales.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded-md border p-2.5 cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="completo" id="pm-completo" className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Pago completo</div>
                  <div className="text-xs text-muted-foreground">
                    Una sola cuota por el total del viaje.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded-md border p-2.5 cursor-pointer hover:bg-accent/40">
                <RadioGroupItem value="sin_plan" id="pm-sin-plan" className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Sin plan todavía</div>
                  <div className="text-xs text-muted-foreground">
                    Crear el plan de pagos más tarde manualmente.
                  </div>
                </div>
              </label>
            </RadioGroup>

            {paymentMode === "cuotas" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <Label className="text-xs">Cantidad de cuotas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={installmentCount}
                    onChange={(e) =>
                      setInstallmentCount(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Primer vencimiento</Label>
                  <Input
                    type="date"
                    value={firstDueDate}
                    onChange={(e) => setFirstDueDate(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 text-xs text-muted-foreground">
                  {installmentCount} {installmentCount === 1 ? "cuota" : "cuotas"} de{" "}
                  {formatUSD(Math.floor((tripPrice * 100) / installmentCount) / 100)} aprox · total{" "}
                  {formatUSD(tripPrice)}
                </div>
              </div>
            )}
            {paymentMode === "completo" && (
              <div className="mt-3">
                <Label className="text-xs">Fecha de vencimiento</Label>
                <Input
                  type="date"
                  value={completoDueDate}
                  onChange={(e) => setCompletoDueDate(e.target.value)}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  1 cuota de {formatUSD(tripPrice)}
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Inscribir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateMissingInstallmentDialog({
  defaultAmount,
  existingInstallments,
  onClose,
  onConfirm,
}: {
  defaultAmount: number;
  existingInstallments: Installment[];
  onClose: () => void;
  onConfirm: (amount: number, dueDate: string) => void;
}) {
  // Fecha sugerida: último vencimiento + 30 días, o hoy si no hay cuotas.
  const suggestedDate = (() => {
    if (existingInstallments.length === 0) {
      return new Date().toISOString().slice(0, 10);
    }
    const lastDue = [...existingInstallments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[
      existingInstallments.length - 1
    ].dueDate;
    const d = new Date(lastDue);
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  const [amount, setAmount] = useState(String(Math.round(defaultAmount * 100) / 100));
  const [dueDate, setDueDate] = useState(suggestedDate);

  const parsed = parseFloat(amount);
  const valid = !isNaN(parsed) && parsed > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-chart-4" /> Crear cuota por faltante
          </DialogTitle>
          <DialogDescription>
            Hubo un faltante de {formatUSD(defaultAmount)} que no pudo trasladarse a otra cuota.
            Creá una cuota nueva para mantener el plan completo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="missing-amount" className="text-xs">
              Monto (USD)
            </Label>
            <Input
              id="missing-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 mt-1"
            />
          </div>
          <div>
            <Label htmlFor="missing-date" className="text-xs">
              Fecha de vencimiento
            </Label>
            <Input
              id="missing-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 mt-1"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Dejar sin asignar
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(Math.round(parsed * 100) / 100, dueDate)}
            disabled={!valid}
          >
            Crear cuota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Diálogo: revertir créditos ya aplicados ──────────────────
function AppliedCreditsDialog({
  enrollee,
  tripName,
  onClose,
  onRevert,
}: {
  enrollee: Enrollee;
  tripName: string;
  onClose: () => void;
  onRevert: (creditId: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const credits = enrollee.appliedCredits ?? [];
  const total = credits.reduce((s, c) => s + c.amount, 0);

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-chart-3" /> Créditos aplicados a {enrollee.name}
          </DialogTitle>
          <DialogDescription>
            Total recibido en <strong>{tripName}</strong>: {formatUSD(total)}. Revertir un crédito{" "}
            suma el monto al <strong>totalDue</strong>, rebalancea las cuotas pendientes y devuelve{" "}
            el monto al sobrepago de la viajera origen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {credits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay créditos aplicados.
            </p>
          ) : (
            credits.map((c) => (
              <div
                key={c.id}
                className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tabular-nums text-chart-3">
                      {formatUSD(c.amount)}
                    </p>
                    <p className="text-xs text-foreground mt-0.5">
                      Origen: <span className="font-medium">{c.sourceEnrolleeName}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Viaje: {c.sourceTripName} · {new Date(c.appliedAt).toLocaleDateString()}
                    </p>
                    {c.notes && (
                      <p className="text-[11px] text-muted-foreground italic mt-1">"{c.notes}"</p>
                    )}
                  </div>
                  {confirmId === c.id ? (
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          onRevert(c.id);
                          setConfirmId(null);
                        }}
                      >
                        <RotateCcw className="h-3 w-3" /> Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setConfirmId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 shrink-0"
                      onClick={() => setConfirmId(c.id)}
                    >
                      <RotateCcw className="h-3 w-3" /> Revertir
                    </Button>
                  )}
                </div>
                {confirmId === c.id && (
                  <p className="text-[11px] text-destructive bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5">
                    Se sumarán {formatUSD(c.amount)} al totalDue de {enrollee.name}, se
                    rebalancearán sus cuotas pendientes, y se devolverá el monto al sobrepago de{" "}
                    {c.sourceEnrolleeName}.
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Diálogo: aplicar crédito a favor a otro viaje / reservar ────
function ApplyCreditDialog({
  sourceTripId,
  sourceEnrollee,
  allTrips,
  onClose,
  onApplyToTrip,
  onReserve,
}: {
  sourceTripId: string;
  sourceEnrollee: Enrollee;
  allTrips: Record<string, TripData>;
  onClose: () => void;
  onApplyToTrip: (
    destTripId: string,
    destEnrolleeId: string,
    amount: number,
    notes?: string,
  ) => void;
  onReserve: (amount: number, notes?: string) => void;
}) {
  const available = sourceEnrollee.overpayment ?? 0;

  // Candidatos: inscripciones en OTROS viajes con el mismo email (no canceladas y con saldo > 0).
  const candidates = useMemo(() => {
    const normalizedEmail = sourceEnrollee.email.trim().toLowerCase();
    const list: {
      tripId: string;
      tripName: string;
      enrolleeId: string;
      enrolleeName: string;
      remaining: number;
      totalDue: number;
    }[] = [];
    for (const t of Object.values(allTrips)) {
      if (t.id === sourceTripId) continue;
      for (const e of t.enrollees) {
        if (e.email.trim().toLowerCase() !== normalizedEmail) continue;
        if (e.status === "cancelada") continue;
        if (e.id === sourceEnrollee.id) continue;
        const paid = (e.installments ?? []).reduce(
          (s, i) => s + (i.payments ?? []).reduce((sp, p) => sp + p.amount, 0),
          0,
        );
        const remaining = Math.max(0, Math.round((e.totalDue - paid) * 100) / 100);
        if (remaining > 0.005) {
          list.push({
            tripId: t.id,
            tripName: t.name,
            enrolleeId: e.id,
            enrolleeName: e.name,
            remaining,
            totalDue: e.totalDue,
          });
        }
      }
    }
    return list;
  }, [allTrips, sourceTripId, sourceEnrollee.id, sourceEnrollee.email]);

  const hasCandidates = candidates.length > 0;
  const [tab, setTab] = useState<"apply" | "reserve">(hasCandidates ? "apply" : "reserve");
  const [selectedDestKey, setSelectedDestKey] = useState<string>(
    hasCandidates ? `${candidates[0].tripId}::${candidates[0].enrolleeId}` : "",
  );
  const [amount, setAmount] = useState(String(Math.round(available * 100) / 100));
  const [notes, setNotes] = useState("");

  const parsed = parseFloat(amount);
  const validAmount = !isNaN(parsed) && parsed > 0.005 && parsed <= available + 0.005;

  const selectedDest = useMemo(() => {
    if (!selectedDestKey) return null;
    return candidates.find((c) => `${c.tripId}::${c.enrolleeId}` === selectedDestKey) ?? null;
  }, [candidates, selectedDestKey]);

  const cappedToDest = selectedDest ? Math.min(parsed, selectedDest.remaining) : parsed;
  const willOverflow = selectedDest && parsed > selectedDest.remaining + 0.005;

  function handleConfirm() {
    if (!validAmount) return;
    const amt = Math.round(parsed * 100) / 100;
    if (tab === "apply" && selectedDest) {
      const finalAmt = Math.min(amt, Math.round(selectedDest.remaining * 100) / 100);
      onApplyToTrip(
        selectedDest.tripId,
        selectedDest.enrolleeId,
        finalAmt,
        notes.trim() || undefined,
      );
    } else if (tab === "reserve") {
      onReserve(amt, notes.trim() || undefined);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-chart-3" /> Aplicar crédito a favor
          </DialogTitle>
          <DialogDescription>
            {sourceEnrollee.name} tiene un crédito disponible de{" "}
            <span className="font-semibold text-chart-3">{formatUSD(available)}</span>. Aplicalo a
            otro viaje en el que ya está inscrita o reservalo para el próximo viaje futuro.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "apply" | "reserve")} className="mt-2">
          <TabsList className="w-full grid grid-cols-2 h-9">
            <TabsTrigger value="apply" disabled={!hasCandidates} className="text-xs">
              Aplicar a viaje existente
              {hasCandidates && (
                <span className="ml-1 text-muted-foreground">({candidates.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reserve" className="text-xs">
              Reservar para próximo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="apply" className="space-y-3 mt-3">
            {!hasCandidates ? (
              <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                No hay otras inscripciones con el mismo email y saldo pendiente. Reservá el crédito
                para que se aplique al próximo viaje en el que se inscriba.
              </div>
            ) : (
              <div>
                <Label className="text-xs">Viaje destino</Label>
                <Select value={selectedDestKey} onValueChange={setSelectedDestKey}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue placeholder="Elegí un viaje destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem
                        key={`${c.tripId}::${c.enrolleeId}`}
                        value={`${c.tripId}::${c.enrolleeId}`}
                      >
                        {c.tripName} · {c.enrolleeName} · saldo {formatUSD(c.remaining)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDest && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Total actual: {formatUSD(selectedDest.totalDue)} · saldo pendiente:{" "}
                    {formatUSD(selectedDest.remaining)}
                  </p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reserve" className="space-y-3 mt-3">
            <div className="rounded-md border border-chart-4/30 bg-chart-4/5 p-3 text-xs text-foreground/80">
              <p>
                El crédito quedará marcado como{" "}
                <span className="font-semibold text-chart-4">"reservado para próximo viaje"</span> y
                se aplicará automáticamente al inscribir a {sourceEnrollee.name} en otro viaje
                (matching por email:{" "}
                <span className="font-mono text-[10px]">{sourceEnrollee.email}</span>).
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Monto a aplicar (USD)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={available}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-[11px] shrink-0"
                onClick={() => setAmount(String(Math.round(available * 100) / 100))}
              >
                Total ({formatUSD(available)})
              </Button>
            </div>
            {!validAmount && (
              <p className="text-[10px] text-destructive mt-1">
                Ingresá un monto entre {formatUSD(0.01)} y {formatUSD(available)}.
              </p>
            )}
            {validAmount && willOverflow && tab === "apply" && selectedDest && (
              <p className="text-[10px] text-chart-4 mt-1">
                ⚠ El monto excede el saldo del destino. Se aplicará{" "}
                <span className="font-semibold">{formatUSD(cappedToDest)}</span> y el resto{" "}
                <span className="font-semibold">{formatUSD(parsed - cappedToDest)}</span> quedará
                como crédito disponible.
              </p>
            )}
            {validAmount && !willOverflow && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Quedará un crédito remanente de{" "}
                <span className="font-semibold tabular-nums">
                  {formatUSD(Math.max(0, available - parsed))}
                </span>
                .
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs">Notas (opcional)</Label>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: aplicado tras conversación con la viajera"
              className="h-9 mt-1"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!validAmount || (tab === "apply" && !selectedDest)}
            className="gap-1.5"
          >
            <CreditCard className="h-3.5 w-3.5" />
            {tab === "apply" ? "Aplicar al viaje" : "Reservar crédito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Editor de reglas de devolución ──────────────────────────
function RefundRulesEditor({ tripId, rules }: { tripId: string; rules: RefundRule[] }) {
  const setRefundRules = useTripsStore((s) => s.setRefundRules);
  const [draft, setDraft] = useState<RefundRule[]>(rules);

  function addRule() {
    setDraft([...draft, { id: generateId(), daysBefore: 30, percent: 50 }]);
  }
  function removeRule(id: string) {
    setDraft(draft.filter((r) => r.id !== id));
  }
  function updateRule(id: string, patch: Partial<RefundRule>) {
    setDraft(draft.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function save() {
    // Ordenar y persistir
    const cleaned = draft
      .filter((r) => r.daysBefore >= 0 && r.percent >= 0 && r.percent <= 100)
      .sort((a, b) => b.daysBefore - a.daysBefore);
    setRefundRules(tripId, cleaned);
  }

  // Sincronizar si cambian externas
  const rulesKey = rules.map((r) => `${r.id}:${r.daysBefore}:${r.percent}`).join("|");
  useMemo(() => setDraft(rules), [rulesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="border-border/40 bg-muted/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Políticas de devolución</p>
            <p className="text-[11px] text-muted-foreground">
              Aplica la regla con MAYOR días-antes que cumpla la fecha de cancelación.
            </p>
          </div>
          <Button size="sm" variant="ghost" className="gap-1 h-8" onClick={addRule}>
            <Plus className="h-3.5 w-3.5" /> Regla
          </Button>
        </div>
        {draft.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Sin reglas. Las cancelaciones sugerirán $0 (editable manualmente).
          </p>
        ) : (
          <div className="space-y-2">
            {draft.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-12 gap-2 items-center bg-background rounded-md px-2 py-1.5 border border-border/40"
              >
                <div className="col-span-5 sm:col-span-4 flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">≥</span>
                  <Input
                    type="number"
                    min={0}
                    value={r.daysBefore}
                    onChange={(e) =>
                      updateRule(r.id, { daysBefore: parseInt(e.target.value || "0", 10) })
                    }
                    className="h-7 text-xs w-16"
                  />
                  <span className="text-muted-foreground">días antes</span>
                </div>
                <div className="col-span-4 sm:col-span-3 flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">→</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={r.percent}
                    onChange={(e) =>
                      updateRule(r.id, { percent: parseFloat(e.target.value || "0") })
                    }
                    className="h-7 text-xs w-16"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <Input
                  placeholder="Notas"
                  value={r.notes ?? ""}
                  onChange={(e) => updateRule(r.id, { notes: e.target.value })}
                  className="col-span-2 sm:col-span-4 h-7 text-xs"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="col-span-1 h-7 w-7 justify-self-end"
                  onClick={() => removeRule(r.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button size="sm" onClick={save}>
            Guardar políticas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Enrollee Card con plan de pagos y descuentos ────────────
function EnrolleeCard({
  tripId,
  enrollee,
  tripPrice,
  tripStartDate,
  tripItineraryDays,
  refundRules,
}: {
  tripId: string;
  enrollee: Enrollee;
  tripPrice: number;
  tripStartDate: string;
  tripItineraryDays: number;
  refundRules: RefundRule[];
}) {
  const setPaymentPlan = useTripsStore((s) => s.setPaymentPlan);
  const updateInstallment = useTripsStore((s) => s.updateInstallment);
  const toggleInstallmentPaid = useTripsStore((s) => s.toggleInstallmentPaid);
  const addInstallmentPayment = useTripsStore((s) => s.addInstallmentPayment);
  const removeInstallmentPayment = useTripsStore((s) => s.removeInstallmentPayment);
  const updateInstallmentPayment = useTripsStore((s) => s.updateInstallmentPayment);
  const attachOrphanPaidMethod = useTripsStore((s) => s.attachOrphanPaidMethod);
  const setDiscount = useTripsStore((s) => s.setDiscount);
  const cancelEnrollee = useTripsStore((s) => s.cancelEnrollee);
  const reactivateEnrollee = useTripsStore((s) => s.reactivateEnrollee);
  const setParticipation = useTripsStore((s) => s.setParticipation);
  const updateEnrolleeContact = useTripsStore((s) => s.updateEnrolleeContact);
  const removeEnrollee = useTripsStore((s) => s.removeEnrollee);
  const setEnrolleeNotes = useTripsStore((s) => s.setEnrolleeNotes);
  const resolveUnassignedBalance = useTripsStore((s) => s.resolveUnassignedBalance);
  const resolveOverpayment = useTripsStore((s) => s.resolveOverpayment);
  const applyCreditToTrip = useTripsStore((s) => s.applyCreditToTrip);
  const reserveCreditForFuture = useTripsStore((s) => s.reserveCreditForFuture);
  const revertAppliedCredit = useTripsStore((s) => s.revertAppliedCredit);
  const addExtra = useTripsStore((s) => s.addExtra);
  const updateExtra = useTripsStore((s) => s.updateExtra);
  const removeExtra = useTripsStore((s) => s.removeExtra);
  const replaceExtraInstallments = useTripsStore((s) => s.replaceExtraInstallments);
  const markExtraInstallmentPaid = useTripsStore((s) => s.markExtraInstallmentPaid);
  const revertExtraInstallment = useTripsStore((s) => s.revertExtraInstallment);
  const allTrips = useTripsRecord();
  const [showCreateMissingDialog, setShowCreateMissingDialog] = useState(false);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [showAppliedCreditsDialog, setShowAppliedCreditsDialog] = useState(false);
  const [extraDialog, setExtraDialog] = useState<
    { mode: "create" } | { mode: "edit"; extraId: string } | null
  >(null);
  // Dialog de pagos de extras: removido en v6 (pagos ahora se hacen marcando cuotas).

  const fin = useMemo(() => deriveEnrolleeFinancials(enrollee, tripPrice), [enrollee, tripPrice]);
  const mismatch = useMemo(
    () => getInstallmentPlanMismatch(enrollee, tripPrice),
    [enrollee, tripPrice],
  );
  const [expanded, setExpanded] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showDiscountForm, setShowDiscountForm] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showPartForm, setShowPartForm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(enrollee.notes ?? "");
  const cardRef = useRef<HTMLDivElement>(null);
  const actionsBarRef = useRef<React.ReactNode>(null);

  const isCancelled = enrollee.status === "cancelada";
  const ps = paymentConfig[fin.status];
  const hasPlan = enrollee.installments.length > 0;
  const hasDiscount = !!enrollee.discount && fin.discountAmount > 0;
  const hasOverdueInstallment = !isCancelled && enrollee.installments.some((i) => isOverdue(i));
  const isPartial = enrollee.participation?.mode === "parcial";

  // Escuchar evento global "viajera:focus" para abrir cuotas + scroll
  useEffect(() => {
    const handler = (ev: Event) => {
      const ce = ev as CustomEvent<{ enrolleeId: string }>;
      if (ce.detail?.enrolleeId !== enrollee.id) return;
      if (hasPlan && !isCancelled) setExpanded(true);
      // Defer scroll para que el accordion termine de animar
      requestAnimationFrame(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    window.addEventListener("viajera:focus", handler);
    return () => window.removeEventListener("viajera:focus", handler);
  }, [enrollee.id, hasPlan, isCancelled]);

  return (
    <Card
      ref={cardRef}
      id={`enrollee-${enrollee.id}`}
      className={`border-border/40 scroll-mt-4 ${isCancelled ? "opacity-75 bg-muted/20" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className={`font-medium ${isCancelled ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                {enrollee.name}
              </p>
              {isCancelled ? (
                <Badge className="bg-destructive/15 text-destructive border-0 text-[11px]">
                  Cancelada
                </Badge>
              ) : (
                <Badge className={`${ps.className} border-0 text-[11px]`}>{ps.label}</Badge>
              )}
              {isPartial && (
                <Badge className="bg-chart-4/15 text-chart-4 border-0 text-[11px] gap-1">
                  <Split className="h-2.5 w-2.5" /> Parcial
                </Badge>
              )}
              {hasOverdueInstallment && (
                <Badge className="bg-destructive/15 text-destructive border-0 text-[11px]">
                  Cuota vencida
                </Badge>
              )}
              {hasDiscount && enrollee.discount && (
                <Badge className="bg-terracotta/15 text-terracotta border-0 text-[11px]">
                  {DISCOUNT_TYPE_LABELS[enrollee.discount.type]} ·{" "}
                  {enrollee.discount.mode === "percent"
                    ? `-${enrollee.discount.value}%`
                    : `-${formatUSD(enrollee.discount.value)}`}
                </Badge>
              )}
              {hasPlan && (
                <span className="text-[11px] text-muted-foreground">
                  {fin.paidCount}/{fin.totalCount} cuotas
                </span>
              )}
              {!mismatch.ok && (
                <Badge
                  className="bg-amber-500/15 text-amber-600 border-0 text-[11px] gap-1"
                  title={
                    mismatch.diff > 0
                      ? `Plan de cuotas ${formatUSD(mismatch.sumInstallments)} · Total ${formatUSD(mismatch.totalDue)} · faltan ${formatUSD(Math.abs(mismatch.diff))}`
                      : `Plan de cuotas ${formatUSD(mismatch.sumInstallments)} · Total ${formatUSD(mismatch.totalDue)} · sobran ${formatUSD(Math.abs(mismatch.diff))}`
                  }
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Cuotas {mismatch.diff > 0 ? "− " : "+ "}
                  {formatUSD(Math.abs(mismatch.diff))}
                </Badge>
              )}
              {(enrollee.overpayment ?? 0) > 0.005 && enrollee.overpaymentAcknowledged && (
                <Badge
                  className="bg-chart-3/15 text-chart-3 border-0 text-[11px] gap-1"
                  title="Crédito a favor reconocido por la organizadora"
                >
                  <Wallet className="h-2.5 w-2.5" />
                  Crédito {formatUSD(enrollee.overpayment ?? 0)}
                </Badge>
              )}
              {(() => {
                const totalApplied = (enrollee.appliedCredits ?? []).reduce(
                  (s, c) => s + c.amount,
                  0,
                );
                if (totalApplied <= 0.005) return null;
                const sources = (enrollee.appliedCredits ?? [])
                  .map(
                    (c) =>
                      `${formatUSD(c.amount)} desde ${c.sourceEnrolleeName} (${c.sourceTripName})`,
                  )
                  .join("\n");
                return (
                  <button
                    type="button"
                    onClick={() => setShowAppliedCreditsDialog(true)}
                    title={`Crédito recibido y aplicado al totalDue (click para revertir):\n${sources}`}
                    className="inline-flex items-center gap-1 rounded-md bg-chart-3/15 text-chart-3 px-1.5 py-0.5 text-[11px] font-medium hover:bg-chart-3/25 transition-colors"
                  >
                    <CreditCard className="h-2.5 w-2.5" />
                    Crédito recibido {formatUSD(totalApplied)}
                  </button>
                );
              })()}
              {(enrollee.reservedCreditForFutureTrip?.amount ?? 0) > 0.005 && (
                <Badge
                  className="bg-chart-4/15 text-chart-4 border-0 text-[11px] gap-1"
                  title="Crédito reservado · se aplicará automáticamente al inscribirse en otro viaje"
                >
                  <CreditCard className="h-2.5 w-2.5" />
                  Reservado {formatUSD(enrollee.reservedCreditForFutureTrip?.amount ?? 0)}
                </Badge>
              )}
            </div>
            <ContactRow enrollee={enrollee} fin={fin} isCancelled={isCancelled} />
            {enrollee.notes && enrollee.notes.trim() && (
              <p className="text-[11px] text-foreground/80 mt-1.5 flex items-start gap-1.5 italic">
                <StickyNote className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2">{enrollee.notes}</span>
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagado</p>
            <p className="text-base font-semibold tabular-nums text-chart-3">
              {formatUSD(fin.amountPaid)}{" "}
              <span className="text-xs text-muted-foreground font-normal">
                / {formatUSD(fin.totalDue)}
              </span>
            </p>
            {fin.totalFees > 0 && (
              <p
                className="text-[10px] tabular-nums text-muted-foreground mt-0.5"
                title={`Bruto ${formatUSD(fin.amountPaid)} − comisiones ${formatUSD(fin.totalFees)}`}
              >
                Neto{" "}
                <span className="text-chart-3 font-medium">{formatUSD(fin.amountPaidNet)}</span>
              </p>
            )}
            {fin.nextDue && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Próxima: {formatDate(fin.nextDue.dueDate)} ·{" "}
                {formatUSD(installmentRemaining(fin.nextDue))}
              </p>
            )}
          </div>
        </div>

        {/* Resumen precio (base / descuento / final) */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <PriceCell label="Precio base" value={formatUSD(fin.basePrice)} />
          <PriceCell
            label="Descuento"
            value={fin.discountAmount > 0 ? `−${formatUSD(fin.discountAmount)}` : "—"}
            tone={fin.discountAmount > 0 ? "terracotta" : "muted"}
          />
          <PriceCell label="Precio final" value={formatUSD(fin.finalPrice)} tone="strong" />
          <PriceCell
            label="Saldo pendiente"
            value={formatUSD(fin.amountPending)}
            tone={fin.amountPending > 0 ? "warning" : "positive"}
          />
        </div>

        {/* Progress bar */}
        {fin.totalDue > 0 && (
          <div className="mt-3 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-chart-3 transition-all"
              style={{ width: `${Math.min(100, (fin.amountPaid / fin.totalDue) * 100)}%` }}
            />
          </div>
        )}

        {/* Resumen de extras (colapsado): solo si hay extras */}
        {(() => {
          const extras = enrollee.extras ?? [];
          if (extras.length === 0) return null;
          const total = extras.reduce((s, x) => s + x.price, 0);
          const pending = extras.reduce((s, x) => s + extraRemainingAmount(x), 0);
          return (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-terracotta/10 text-terracotta font-medium">
                <Wallet className="h-2.5 w-2.5" /> Extras
              </span>
              <span>
                <span className="font-medium text-foreground">{formatUSD(total)}</span> total
              </span>
              <span>·</span>
              <span>
                {pending > 0.005 ? (
                  <span className="text-chart-4 font-medium">{formatUSD(pending)} pendiente</span>
                ) : (
                  <span className="text-chart-3">todos pagados</span>
                )}
              </span>
              <span className="text-muted-foreground/60">
                · {extras.length} {extras.length === 1 ? "extra" : "extras"}
              </span>
            </div>
          );
        })()}

        {(enrollee.unassignedBalance ?? 0) > 0.005 && !isCancelled && (
          <div className="mt-3 rounded-md border border-chart-4/40 bg-chart-4/10 p-2.5 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-chart-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-chart-4">
                Saldo sin asignar: {formatUSD(enrollee.unassignedBalance ?? 0)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Faltante de un abono que no pudo trasladarse a otra cuota. Creá una cuota nueva para
                cobrarlo o dejalo registrado.
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2 gap-1 border-chart-4/40"
                onClick={() => setShowCreateMissingDialog(true)}
              >
                <Plus className="h-3 w-3" /> Crear cuota
              </Button>
            </div>
          </div>
        )}
        {showCreateMissingDialog && (
          <CreateMissingInstallmentDialog
            defaultAmount={enrollee.unassignedBalance ?? 0}
            existingInstallments={enrollee.installments}
            onClose={() => setShowCreateMissingDialog(false)}
            onConfirm={(amount, dueDate) => {
              resolveUnassignedBalance(tripId, enrollee.id, "create_installment", {
                amount,
                dueDate,
              });
              setShowCreateMissingDialog(false);
              toast.success(`Cuota nueva creada por ${formatUSD(amount)}`);
            }}
          />
        )}

        {/* Banner: sobrepago no asignado (la viajera pagó más del total del viaje) */}
        {(enrollee.overpayment ?? 0) > 0.005 &&
          !isCancelled &&
          !enrollee.overpaymentAcknowledged && (
            <div className="mt-3 rounded-md border border-chart-3/40 bg-chart-3/10 p-2.5 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-chart-3 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-chart-3">
                  Sobrepago: {formatUSD(enrollee.overpayment ?? 0)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  La viajera pagó más del total del viaje. Decidí si lo devolvés o lo dejás como
                  crédito a su favor.
                </p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] px-2 gap-1 border-chart-3/40"
                    onClick={() => {
                      const amt = enrollee.overpayment ?? 0;
                      resolveOverpayment(tripId, enrollee.id, "refunded");
                      toast.success(`Sobrepago ${formatUSD(amt)} marcado como devuelto`);
                    }}
                  >
                    <RotateCcw className="h-3 w-3" /> Marcar como devuelto
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px] px-2 gap-1 text-muted-foreground"
                    onClick={() => {
                      const amt = enrollee.overpayment ?? 0;
                      resolveOverpayment(tripId, enrollee.id, "acknowledge");
                      toast.success(`Sobrepago ${formatUSD(amt)} dejado como crédito`);
                    }}
                  >
                    Dejar como crédito
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] px-2 gap-1 border-chart-3/40"
                    onClick={() => setShowCreditDialog(true)}
                  >
                    <CreditCard className="h-3 w-3" /> Aplicar a viaje
                  </Button>
                </div>
              </div>
            </div>
          )}

        {/* Banner: crédito reconocido (acknowledged) — botón discreto para aplicar */}
        {(enrollee.overpayment ?? 0) > 0.005 &&
          !isCancelled &&
          enrollee.overpaymentAcknowledged && (
            <div className="mt-3 rounded-md border border-chart-3/30 bg-chart-3/5 p-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Wallet className="h-3.5 w-3.5 text-chart-3 shrink-0" />
                <p className="text-[11px] text-foreground truncate">
                  <span className="font-semibold text-chart-3">
                    Crédito disponible: {formatUSD(enrollee.overpayment ?? 0)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · listo para aplicar a un viaje futuro
                  </span>
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2 gap-1 border-chart-3/40 shrink-0"
                onClick={() => setShowCreditDialog(true)}
              >
                <CreditCard className="h-3 w-3" /> Aplicar crédito
              </Button>
            </div>
          )}

        {/* Banner: crédito reservado para próximo viaje (sin destino aún) */}
        {(enrollee.reservedCreditForFutureTrip?.amount ?? 0) > 0.005 && !isCancelled && (
          <div className="mt-3 rounded-md border border-chart-4/30 bg-chart-4/5 p-2 flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5 text-chart-4 shrink-0" />
            <p className="text-[11px] text-foreground flex-1 min-w-0">
              <span className="font-semibold text-chart-4">
                Reservado para próximo viaje:{" "}
                {formatUSD(enrollee.reservedCreditForFutureTrip?.amount ?? 0)}
              </span>
              <span className="text-muted-foreground block sm:inline sm:ml-1">
                Se aplicará automáticamente al inscribirse en otro viaje (mismo email).
              </span>
            </p>
          </div>
        )}

        {showCreditDialog && (
          <ApplyCreditDialog
            sourceTripId={tripId}
            sourceEnrollee={enrollee}
            allTrips={allTrips}
            onClose={() => setShowCreditDialog(false)}
            onApplyToTrip={(destTripId, destEnrolleeId, amount, notes) => {
              const ok = applyCreditToTrip(
                tripId,
                enrollee.id,
                destTripId,
                destEnrolleeId,
                amount,
                notes,
              );
              if (ok) {
                const destTrip = allTrips[destTripId];
                const destEn = destTrip?.enrollees.find((e) => e.id === destEnrolleeId);
                toast.success(
                  `Crédito ${formatUSD(amount)} aplicado a ${destEn?.name ?? "destino"} (${destTrip?.name ?? ""})`,
                );
                setShowCreditDialog(false);
              } else {
                toast.error("No se pudo aplicar el crédito. Verificá el monto disponible.");
              }
            }}
            onReserve={(amount, notes) => {
              const ok = reserveCreditForFuture(tripId, enrollee.id, amount, notes);
              if (ok) {
                toast.success(
                  `Crédito ${formatUSD(amount)} reservado para próximo viaje · se aplicará automáticamente al inscribirse`,
                );
                setShowCreditDialog(false);
              } else {
                toast.error("No se pudo reservar el crédito.");
              }
            }}
          />
        )}

        {showAppliedCreditsDialog && (
          <AppliedCreditsDialog
            enrollee={enrollee}
            tripName={allTrips[tripId]?.name ?? ""}
            onClose={() => setShowAppliedCreditsDialog(false)}
            onRevert={(creditId) => {
              const credit = (enrollee.appliedCredits ?? []).find((c) => c.id === creditId);
              if (!credit) return;
              const ok = revertAppliedCredit(tripId, enrollee.id, creditId);
              if (ok) {
                toast.success(
                  `Crédito ${formatUSD(credit.amount)} revertido · devuelto a ${credit.sourceEnrolleeName} (${credit.sourceTripName})`,
                );
              } else {
                toast.error("No se pudo revertir el crédito.");
              }
            }}
          />
        )}

        {/* Actions bar — rendered inside Cuotas accordion when hasPlan; otherwise here */}
        {(() => {
          const actionsBar = (
            <div className="flex flex-wrap gap-2">
              {!isCancelled && !hasPlan && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowPlanForm(true)}
                >
                  <Plus className="h-3 w-3" /> Crear plan de pagos
                </Button>
              )}
              {!isCancelled &&
                hasPlan &&
                !enrollee.installments.some(
                  (i) => i.status === "pagado" || (i.payments?.length ?? 0) > 0,
                ) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setShowPlanForm(true)}
                  >
                    Reemplazar plan
                  </Button>
                )}
              {!isCancelled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-terracotta hover:text-terracotta"
                  onClick={() => setShowDiscountForm((v) => !v)}
                >
                  <Tag className="h-3 w-3" />{" "}
                  {hasDiscount ? "Editar descuento" : "Aplicar descuento"}
                </Button>
              )}
              {!isCancelled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-chart-4 hover:text-chart-4"
                  onClick={() => setShowPartForm((v) => !v)}
                >
                  <Split className="h-3 w-3" />{" "}
                  {isPartial ? "Editar participación" : "Participación parcial"}
                </Button>
              )}
              {!isCancelled && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setNotesDraft(enrollee.notes ?? "");
                    setShowNotes((v) => !v);
                  }}
                >
                  <StickyNote className="h-3 w-3" />{" "}
                  {enrollee.notes?.trim() ? "Editar nota" : "Agregar nota"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setShowEditDialog(true)}
              >
                <Pencil className="h-3 w-3" /> Editar contacto
              </Button>
              {!isCancelled ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                  onClick={() => setShowCancelForm((v) => !v)}
                >
                  <Ban className="h-3 w-3" /> Cancelar inscripción
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => reactivateEnrollee(tripId, enrollee.id)}
                >
                  <RotateCcw className="h-3 w-3" /> Reactivar
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive ml-auto"
                onClick={() => setShowDeleteDialog(true)}
                title="Eliminar viajera"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
          actionsBarRef.current = actionsBar;
          if (!hasPlan) {
            return <div className="mt-3">{actionsBar}</div>;
          }
          return null;
        })()}

        {/* Notes editor */}
        {showNotes && !isCancelled && (
          <div className="mt-3 pt-3 border-t space-y-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
              <StickyNote className="h-3 w-3" /> Notas operativas
            </Label>
            <Textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              maxLength={1000}
              placeholder="Alergias, dieta, talla, contacto de emergencia, comentarios…"
              className="min-h-[80px] text-xs"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {notesDraft.length}/1000
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setNotesDraft(enrollee.notes ?? "");
                    setShowNotes(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEnrolleeNotes(tripId, enrollee.id, notesDraft);
                    toast.success("Notas guardadas");
                    setShowNotes(false);
                  }}
                >
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Cancellation info */}
        {isCancelled && enrollee.cancellation && (
          <div className="mt-3 pt-3 border-t border-destructive/20">
            <p className="text-[10px] uppercase tracking-wider text-destructive font-semibold mb-2">
              Cancelación · {formatDate(enrollee.cancellation.cancelledAt)}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <PriceCell label="Pagado" value={formatUSD(fin.amountPaid)} />
              <PriceCell
                label="Sugerido"
                value={formatUSD(enrollee.cancellation.suggestedRefund)}
                tone="muted"
              />
              <PriceCell
                label="Devuelto"
                value={formatUSD(enrollee.cancellation.refundedAmount)}
                tone={enrollee.cancellation.refundedAmount > 0 ? "warning" : "muted"}
              />
              <PriceCell
                label="Retenido"
                value={formatUSD(enrollee.cancellation.retainedAmount)}
                tone="positive"
              />
            </div>
            {enrollee.cancellation.notes && (
              <p className="text-[11px] text-muted-foreground mt-2 italic">
                {enrollee.cancellation.notes}
              </p>
            )}
          </div>
        )}

        {/* Cancel form */}
        {showCancelForm && !isCancelled && (
          <div className="mt-3 pt-3 border-t">
            <CancelForm
              amountPaid={fin.amountPaid}
              tripStartDate={tripStartDate}
              refundRules={refundRules}
              onCancel={() => setShowCancelForm(false)}
              onSave={(c) => {
                cancelEnrollee(tripId, enrollee.id, c);
                setShowCancelForm(false);
              }}
            />
          </div>
        )}

        {/* Participation form */}
        {showPartForm && !isCancelled && (
          <div className="mt-3 pt-3 border-t">
            <ParticipationForm
              current={enrollee.participation ?? null}
              basePriceAfterDiscount={fin.finalPrice}
              totalDays={tripItineraryDays}
              onCancel={() => setShowPartForm(false)}
              onSave={(p) => {
                setParticipation(tripId, enrollee.id, p);
                setShowPartForm(false);
              }}
              onRemove={() => {
                setParticipation(tripId, enrollee.id, null);
                setShowPartForm(false);
              }}
            />
          </div>
        )}

        {/* Discount form */}
        {showDiscountForm && (
          <div className="mt-3 pt-3 border-t">
            <DiscountForm
              basePrice={fin.basePrice}
              current={enrollee.discount ?? null}
              hasPaidInstallments={fin.paidCount > 0}
              amountPaid={fin.amountPaid}
              onCancel={() => setShowDiscountForm(false)}
              onSave={(discount) => {
                setDiscount(tripId, enrollee.id, discount);
                setShowDiscountForm(false);
              }}
              onRemove={() => {
                setDiscount(tripId, enrollee.id, null);
                setShowDiscountForm(false);
              }}
            />
          </div>
        )}

        {/* Plan form */}
        {showPlanForm && (
          <div className="mt-3 pt-3 border-t">
            <PlanForm
              defaultTotal={fin.finalPrice || enrollee.totalDue || tripPrice}
              onCancel={() => setShowPlanForm(false)}
              onSave={(installments) => {
                setPaymentPlan(tripId, enrollee.id, installments);
                setShowPlanForm(false);
              }}
            />
          </div>
        )}

        {/* Cuotas + Extras: acordeones independientes, ambas colapsadas por default */}
        {(() => {
          const cuotasPagado = fin.amountPaid;
          const cuotasPendiente = Math.max(0, fin.totalDue - fin.amountPaid);
          const extrasList = enrollee.extras ?? [];
          const extrasRev = extrasList.reduce((s, x) => s + extraPaidAmount(x), 0);
          const extrasProf = extrasList.reduce((s, x) => s + extraProfit(x), 0);
          const extrasPend = extrasList.reduce((s, x) => s + extraRemainingAmount(x), 0);
          return (
            <div className="mt-3 pt-3 border-t space-y-2">
              {hasPlan && (
                <Accordion type="single" collapsible className="rounded-md border border-border/50">
                  <AccordionItem value="cuotas" className="border-0">
                    <AccordionTrigger className="px-3 py-2 hover:no-underline [&>svg]:h-3.5 [&>svg]:w-3.5">
                      <div className="flex items-center justify-between w-full pr-2 gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                          Cuotas{" "}
                          <span className="text-muted-foreground font-normal normal-case tracking-normal">
                            ({enrollee.installments.length})
                          </span>
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          Pagado{" "}
                          <span className="font-semibold text-chart-3">
                            {formatUSD(cuotasPagado)}
                          </span>
                          {" · "}
                          Pendiente{" "}
                          <span
                            className={`font-semibold ${cuotasPendiente > 0 ? "text-terracotta" : "text-muted-foreground"}`}
                          >
                            {formatUSD(cuotasPendiente)}
                          </span>
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      <div className="px-3 pt-3 pb-3 border-b border-border/40">
                        {actionsBarRef.current}
                      </div>
                      {!mismatch.ok &&
                        (() => {
                          const sortedInst = [...enrollee.installments].sort((a, b) =>
                            a.dueDate.localeCompare(b.dueDate),
                          );
                          const lastPending = [...sortedInst]
                            .reverse()
                            .find((i) => i.status === "pendiente");
                          const msg =
                            mismatch.diff > 0
                              ? `El plan de cuotas suma ${formatUSD(mismatch.sumInstallments)}, pero el total a cobrar es ${formatUSD(mismatch.totalDue)}. Faltan ${formatUSD(Math.abs(mismatch.diff))} sin distribuir en cuotas.`
                              : `El plan de cuotas suma ${formatUSD(mismatch.sumInstallments)}, pero el total a cobrar es ${formatUSD(mismatch.totalDue)}. Las cuotas superan al total en ${formatUSD(Math.abs(mismatch.diff))}.`;
                          return (
                            <div className="mx-3 mt-3 flex flex-wrap items-start justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                              <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span>{msg}</span>
                              </div>
                              {lastPending && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                                  onClick={() => {
                                    const newAmount = Math.max(
                                      0,
                                      Math.round((lastPending.amount + mismatch.diff) * 100) / 100,
                                    );
                                    updateInstallment(tripId, enrollee.id, lastPending.id, {
                                      amount: newAmount,
                                    });
                                  }}
                                >
                                  Ajustar última cuota pendiente
                                </Button>
                              )}
                            </div>
                          );
                        })()}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Vencimiento</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Método de pago</TableHead>
                            <TableHead className="w-32 text-right">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const sorted = [...enrollee.installments].sort((a, b) =>
                              a.dueDate.localeCompare(b.dueDate),
                            );
                            return sorted.map((inst, idx) => (
                              <InstallmentRow
                                key={inst.id}
                                index={idx + 1}
                                installment={inst}
                                followingInstallments={sorted.slice(idx + 1)}
                                onToggle={() => toggleInstallmentPaid(tripId, enrollee.id, inst.id)}
                                onUpdate={(patch) =>
                                  updateInstallment(tripId, enrollee.id, inst.id, patch)
                                }
                                onAddPayment={(payment) =>
                                  addInstallmentPayment(tripId, enrollee.id, inst.id, payment)
                                }
                                onRemovePayment={(paymentId) =>
                                  removeInstallmentPayment(tripId, enrollee.id, inst.id, paymentId)
                                }
                                onUpdatePayment={(paymentId, patch) =>
                                  updateInstallmentPayment(
                                    tripId,
                                    enrollee.id,
                                    inst.id,
                                    paymentId,
                                    patch,
                                  )
                                }
                                onAttachOrphanMethod={(payment) =>
                                  attachOrphanPaidMethod(tripId, enrollee.id, inst.id, payment)
                                }
                                allInstallments={sorted}
                              />
                            ));
                          })()}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              <Accordion type="single" collapsible className="rounded-md border border-border/50">
                <AccordionItem value="extras" className="border-0">
                  <AccordionTrigger className="px-3 py-2 hover:no-underline [&>svg]:h-3.5 [&>svg]:w-3.5">
                    <div className="flex items-center justify-between w-full pr-2 gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Wallet className="h-3 w-3 text-terracotta" />
                        Extras{" "}
                        <span className="text-muted-foreground font-normal normal-case tracking-normal">
                          ({extrasList.length})
                        </span>
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {extrasList.length > 0 ? (
                          <>
                            Revenue{" "}
                            <span className="font-semibold text-foreground">
                              {formatUSD(extrasRev)}
                            </span>
                            {" · "}
                            Profit{" "}
                            <span
                              className={`font-semibold ${extrasProf >= 0 ? "text-chart-3" : "text-destructive"}`}
                            >
                              {formatUSD(extrasProf)}
                            </span>
                            {extrasPend > 0 && (
                              <>
                                {" · "}
                                Pend.{" "}
                                <span className="font-semibold text-terracotta">
                                  {formatUSD(extrasPend)}
                                </span>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="italic">Sin extras</span>
                        )}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 pt-0">
                    <ExtrasSection
                      extras={extrasList}
                      onAdd={() => setExtraDialog({ mode: "create" })}
                      onEdit={(id) => setExtraDialog({ mode: "edit", extraId: id })}
                      onRemove={(id, name) => {
                        removeExtra(tripId, enrollee.id, id);
                        toast.success(`Extra "${name}" eliminado`);
                      }}
                      onMarkInstallmentPaid={(extraId, instId) => {
                        markExtraInstallmentPaid(tripId, enrollee.id, extraId, instId);
                        toast.success("Cuota marcada como pagada");
                      }}
                      onRevertInstallment={(extraId, instId) => {
                        revertExtraInstallment(tripId, enrollee.id, extraId, instId);
                        toast.success("Cuota revertida");
                      }}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          );
        })()}

        {extraDialog && (
          <ExtraFormDialog
            existing={
              extraDialog.mode === "edit"
                ? ((enrollee.extras ?? []).find((x) => x.id === extraDialog.extraId) ?? null)
                : null
            }
            onClose={() => setExtraDialog(null)}
            onCreate={(data) => {
              addExtra(tripId, enrollee.id, data);
              toast.success(`Extra "${data.name}" creado`);
              setExtraDialog(null);
            }}
            onUpdate={(extraId, patch, plan) => {
              updateExtra(tripId, enrollee.id, extraId, patch);
              if (plan) {
                replaceExtraInstallments(
                  tripId,
                  enrollee.id,
                  extraId,
                  plan.installments,
                  plan.paymentMode,
                );
              }
              toast.success(`Extra "${patch.name ?? "actualizado"}" guardado`);
              setExtraDialog(null);
            }}
          />
        )}

        {/* Audit log: historial cronológico de cambios */}
        <AuditLogSection log={enrollee.auditLog ?? []} />
      </CardContent>

      <EditContactDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        enrollee={enrollee}
        onSave={(patch) => {
          updateEnrolleeContact(tripId, enrollee.id, patch);
          toast.success("Contacto actualizado");
          setShowEditDialog(false);
        }}
      />
      <DeleteEnrolleeDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        enrolleeName={enrollee.name}
        onConfirm={() => {
          removeEnrollee(tripId, enrollee.id);
          toast.success(`${enrollee.name} eliminada`);
          setShowDeleteDialog(false);
        }}
      />
    </Card>
  );
}

// ─── Extras: tabla de extras + form (con tipo de pago único o cuotas) ──
function ExtrasSection({
  extras,
  onAdd,
  onEdit,
  onRemove,
  onMarkInstallmentPaid,
  onRevertInstallment,
}: {
  extras: Extra[];
  onAdd: () => void;
  onEdit: (extraId: string) => void;
  onRemove: (extraId: string, name: string) => void;
  onMarkInstallmentPaid: (extraId: string, installmentId: string) => void;
  onRevertInstallment: (extraId: string, installmentId: string) => void;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const sorted = [...extras].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="mt-3 pt-3 border-t">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-terracotta" />
          Extras
          {extras.length > 0 && (
            <span className="text-[11px] text-muted-foreground font-normal">({extras.length})</span>
          )}
        </h4>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onAdd}>
          <Plus className="h-3 w-3" /> Agregar extra
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded">
          Sin extras registrados. Tours, experiencias, upgrades, etc.
        </p>
      ) : (
        <div className="rounded-md border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-8 text-[10px] uppercase tracking-wider"></TableHead>
                <TableHead className="h-8 text-[10px] uppercase tracking-wider">Nombre</TableHead>
                <TableHead className="h-8 text-[10px] uppercase tracking-wider text-right">
                  Precio
                </TableHead>
                <TableHead className="h-8 text-[10px] uppercase tracking-wider text-right">
                  Costo
                </TableHead>
                <TableHead className="h-8 text-[10px] uppercase tracking-wider text-right">
                  Utilidad
                </TableHead>
                <TableHead className="h-8 text-[10px] uppercase tracking-wider">Estado</TableHead>
                <TableHead className="h-8 text-[10px] uppercase tracking-wider">Vence</TableHead>
                <TableHead className="h-8 text-[10px] uppercase tracking-wider text-right">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((ex) => {
                const paid = extraPaidAmount(ex);
                const remaining = extraRemainingAmount(ex);
                const status = extraStatus(ex);
                const profit = extraProfit(ex);
                const totalFees = extraTotalFees(ex);
                const feeDescriptions = Array.from(
                  new Set(
                    ex.installments
                      .filter((i) => (i.feeAmount ?? 0) > 0)
                      .map((i) => i.feeDescription?.trim())
                      .filter((d): d is string => !!d),
                  ),
                );
                const feeLabel =
                  feeDescriptions.length > 0 ? feeDescriptions.join(" · ") : "Comisión";
                const open = openIds.has(ex.id);
                const hasMultipleInstallments = ex.installments.length > 1;
                const nextDue =
                  ex.installments.find((i) => i.status === "pendiente")?.dueDate ?? ex.date;
                return (
                  <React.Fragment key={ex.id}>
                    <TableRow className="text-xs">
                      <TableCell className="w-6 px-1">
                        {hasMultipleInstallments ? (
                          <button
                            type="button"
                            onClick={() => toggle(ex.id)}
                            className="p-0.5 hover:bg-muted rounded"
                            title={open ? "Ocultar cuotas" : "Ver cuotas"}
                          >
                            {open ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="font-medium truncate max-w-[160px]" title={ex.name}>
                          {ex.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {ex.paymentMode === "unico"
                            ? "Pago único"
                            : `${ex.installments.length} cuotas`}
                          {" · "}
                          Pagado{" "}
                          <span className="tabular-nums text-foreground">{formatUSD(paid)}</span>
                          {remaining > 0.005 && (
                            <>
                              {" "}
                              · Saldo{" "}
                              <span className="tabular-nums text-chart-4">
                                {formatUSD(remaining)}
                              </span>
                            </>
                          )}
                        </div>
                        {!hasMultipleInstallments &&
                          ex.installments[0]?.status === "pagado" &&
                          ex.installments[0]?.method && (
                            <div className="mt-1">
                              <PaymentMethodBadge method={ex.installments[0].method} />
                            </div>
                          )}
                        {!hasMultipleInstallments && ex.installments[0]?.notes && (
                          <div
                            className="mt-1 text-[10px] text-muted-foreground italic max-w-[220px] line-clamp-2"
                            title={ex.installments[0].notes}
                          >
                            📝 {ex.installments[0].notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {formatUSD(ex.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        −{formatUSD(ex.cost)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className={`tabular-nums font-semibold ${profit > 0 ? "text-chart-3" : profit < 0 ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {formatUSD(profit)}
                        </div>
                        {totalFees > 0 && (
                          <div
                            className="text-[10px] text-muted-foreground tabular-nums mt-0.5"
                            title={`${feeLabel}: −${formatUSD(totalFees)}`}
                          >
                            {feeLabel} −{formatUSD(totalFees)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            status === "pagado"
                              ? "bg-chart-3/15 text-chart-3 border-0 text-[10px] h-4 px-1.5"
                              : status === "vencido"
                                ? "bg-destructive/15 text-destructive border-0 text-[10px] h-4 px-1.5"
                                : "bg-chart-4/15 text-chart-4 border-0 text-[10px] h-4 px-1.5"
                          }
                        >
                          {status === "pagado"
                            ? "Pagado"
                            : status === "vencido"
                              ? "Vencido"
                              : "Pendiente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground tabular-nums">
                        {nextDue ? formatDate(nextDue) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          {/* Pago único: botón rápido marcar pagado/revertir */}
                          {!hasMultipleInstallments &&
                            ex.installments[0] &&
                            (ex.installments[0].status === "pendiente" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[10px] gap-1 text-chart-3"
                                onClick={() => onMarkInstallmentPaid(ex.id, ex.installments[0].id)}
                                title="Marcar como pagado"
                              >
                                <Check className="h-3 w-3" /> Pagar
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground"
                                onClick={() => onRevertInstallment(ex.id, ex.installments[0].id)}
                                title="Revertir pago"
                              >
                                <RotateCcw className="h-3 w-3" /> Revertir
                              </Button>
                            ))}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => onEdit(ex.id)}
                            title="Editar"
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => {
                              if (
                                confirm(
                                  `¿Eliminar el extra "${ex.name}"? Esta acción borra también todas sus cuotas.`,
                                )
                              ) {
                                onRemove(ex.id, ex.name);
                              }
                            }}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {open && hasMultipleInstallments && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell></TableCell>
                        <TableCell colSpan={7} className="py-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            Cuotas del extra
                          </p>
                          <ul className="space-y-1">
                            {ex.installments.map((inst, idx) => {
                              const overdue =
                                inst.status === "pendiente" &&
                                new Date(inst.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
                              return (
                                <li
                                  key={inst.id}
                                  className="bg-background/60 rounded px-2 py-1 space-y-0.5"
                                >
                                  <div className="flex items-center gap-2 text-[11px]">
                                    <span className="text-muted-foreground tabular-nums w-12">
                                      #{idx + 1}
                                    </span>
                                    <span className="tabular-nums font-medium w-20">
                                      {formatUSD(inst.amount)}
                                    </span>
                                    <span className="text-muted-foreground tabular-nums">
                                      {formatDate(inst.dueDate)}
                                    </span>
                                    <Badge
                                      className={
                                        inst.status === "pagado"
                                          ? "bg-chart-3/15 text-chart-3 border-0 text-[9px] h-4 px-1.5"
                                          : overdue
                                            ? "bg-destructive/15 text-destructive border-0 text-[9px] h-4 px-1.5"
                                            : "bg-chart-4/15 text-chart-4 border-0 text-[9px] h-4 px-1.5"
                                      }
                                    >
                                      {inst.status === "pagado"
                                        ? "Pagado"
                                        : overdue
                                          ? "Vencido"
                                          : "Pendiente"}
                                    </Badge>
                                    {inst.paidAt && (
                                      <span className="text-muted-foreground italic">
                                        · pagado {formatDate(inst.paidAt)}
                                      </span>
                                    )}
                                    {inst.status === "pagado" && inst.method && (
                                      <PaymentMethodBadge method={inst.method} />
                                    )}
                                    <div className="flex-1" />
                                    {inst.status === "pendiente" ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 px-1.5 text-[10px] gap-1 text-chart-3"
                                        onClick={() => onMarkInstallmentPaid(ex.id, inst.id)}
                                      >
                                        <Check className="h-2.5 w-2.5" /> Pagar
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-5 px-1.5 text-[10px] gap-1 text-muted-foreground"
                                        onClick={() => onRevertInstallment(ex.id, inst.id)}
                                      >
                                        <RotateCcw className="h-2.5 w-2.5" /> Revertir
                                      </Button>
                                    )}
                                  </div>
                                  {inst.notes && (
                                    <div
                                      className="text-[10px] text-muted-foreground italic pl-14"
                                      title={inst.notes}
                                    >
                                      📝 {inst.notes}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Form Crear/Editar Extra (con tipo de pago condicional) ──
function ExtraFormDialog({
  existing,
  onClose,
  onCreate,
  onUpdate,
}: {
  existing: Extra | null;
  onClose: () => void;
  onCreate: (data: {
    name: string;
    price: number;
    cost: number;
    date?: string;
    paymentMode: "unico" | "cuotas";
    installments?: Array<{
      amount: number;
      dueDate: string;
      method?: PaymentMethod;
      notes?: string;
    }>;
    markPaid?: boolean;
    dueDate?: string;
    method?: PaymentMethod;
    notes?: string;
    feePercent?: number;
    feeFixed?: number;
    feeDescription?: string;
  }) => void;
  onUpdate: (
    extraId: string,
    patch: { name?: string; price?: number; cost?: number; date?: string | null },
    plan?: {
      paymentMode: "unico" | "cuotas";
      installments: Array<{
        id?: string;
        amount: number;
        dueDate: string;
        status?: "pendiente" | "pagado";
        paidAt?: string;
        method?: PaymentMethod;
        notes?: string;
        feePercent?: number;
        feeFixed?: number;
        feeDescription?: string;
      }>;
    },
  ) => void;
}) {
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name ?? "");
  const [date, setDate] = useState(existing?.date ?? "");
  const [price, setPrice] = useState(existing ? String(existing.price) : "");
  const [cost, setCost] = useState(existing ? String(existing.cost) : "");
  const [paymentMode, setPaymentMode] = useState<"unico" | "cuotas">(
    existing?.paymentMode ?? "unico",
  );

  // Estado de pago único
  const [singleDueDate, setSingleDueDate] = useState(
    existing?.paymentMode === "unico" && existing.installments[0]
      ? existing.installments[0].dueDate
      : (existing?.date ?? new Date().toISOString().slice(0, 10)),
  );
  const [markPaid, setMarkPaid] = useState(
    existing?.paymentMode === "unico" && existing.installments[0]?.status === "pagado",
  );
  const [singleMethod, setSingleMethod] = useState<PaymentMethod>(
    existing?.paymentMode === "unico"
      ? (existing.installments[0]?.method ?? "transferencia")
      : "transferencia",
  );
  const [singleNotes, setSingleNotes] = useState(
    existing?.paymentMode === "unico" ? (existing.installments[0]?.notes ?? "") : "",
  );
  const existingSingle = existing?.paymentMode === "unico" ? existing.installments[0] : undefined;
  const [singleStripePreset, setSingleStripePreset] = useState<StripePreset>(() => {
    const pct = existingSingle?.feePercent;
    const fix = existingSingle?.feeFixed;
    if (pct === undefined || fix === undefined) return "international";
    if (pct === STRIPE_PRESETS.domestic.percent && fix === STRIPE_PRESETS.domestic.fixed)
      return "domestic";
    if (pct === STRIPE_PRESETS.international.percent && fix === STRIPE_PRESETS.international.fixed)
      return "international";
    return "custom";
  });
  const [singleFeePercent, setSingleFeePercent] = useState<string>(
    String(existingSingle?.feePercent ?? STRIPE_PRESETS.international.percent),
  );
  const [singleFeeFixed, setSingleFeeFixed] = useState<string>(
    String(existingSingle?.feeFixed ?? STRIPE_PRESETS.international.fixed),
  );
  const [singleFeeDescription, setSingleFeeDescription] = useState<string>(
    existingSingle?.feeDescription ?? "",
  );
  function applySinglePreset(p: StripePreset) {
    setSingleStripePreset(p);
    if (p !== "custom") {
      setSingleFeePercent(String(STRIPE_PRESETS[p].percent));
      setSingleFeeFixed(String(STRIPE_PRESETS[p].fixed));
    }
  }

  // Estado de cuotas (incluye fee fields por cuota cuando ya está pagada)
  const [installments, setInstallments] = useState<
    Array<{
      id?: string;
      amount: string;
      dueDate: string;
      method?: PaymentMethod;
      notes?: string;
      feePercent?: string;
      feeFixed?: string;
      feeDescription?: string;
    }>
  >(
    existing?.paymentMode === "cuotas"
      ? existing.installments.map((i) => ({
          id: i.id,
          amount: String(i.amount),
          dueDate: i.dueDate,
          method: i.method,
          notes: i.notes,
          feePercent: typeof i.feePercent === "number" ? String(i.feePercent) : undefined,
          feeFixed: typeof i.feeFixed === "number" ? String(i.feeFixed) : undefined,
          feeDescription: i.feeDescription,
        }))
      : [
          { amount: "", dueDate: new Date().toISOString().slice(0, 10) },
          { amount: "", dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) },
        ],
  );

  const priceNum = Number(price) || 0;
  const costNum = Number(cost) || 0;
  const profit = Math.round((priceNum - costNum) * 100) / 100;
  const installmentsSum = installments.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const installmentsDelta = Math.round((priceNum - installmentsSum) * 100) / 100;

  function distributeEqually() {
    if (installments.length === 0 || priceNum <= 0) return;
    const each = Math.floor((priceNum / installments.length) * 100) / 100;
    const remainder = Math.round((priceNum - each * installments.length) * 100) / 100;
    setInstallments(
      installments.map((i, idx) => ({
        ...i,
        amount:
          idx === installments.length - 1
            ? String(Math.round((each + remainder) * 100) / 100)
            : String(each),
      })),
    );
  }

  function addInstallment() {
    const last = installments[installments.length - 1];
    const nextDate = last
      ? new Date(new Date(last.dueDate).getTime() + 30 * 86400000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    setInstallments([...installments, { amount: "", dueDate: nextDate }]);
  }

  function removeInstallment(idx: number) {
    if (installments.length <= 1) return;
    setInstallments(installments.filter((_, i) => i !== idx));
  }

  function updateInstallment(
    idx: number,
    patch: Partial<{
      amount: string;
      dueDate: string;
      method: PaymentMethod;
      notes: string;
      feePercent: string;
      feeFixed: string;
      feeDescription: string;
    }>,
  ) {
    setInstallments(installments.map((inst, i) => (i === idx ? { ...inst, ...patch } : inst)));
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (priceNum < 0 || costNum < 0) {
      toast.error("Los montos no pueden ser negativos");
      return;
    }
    if (paymentMode === "cuotas") {
      if (installments.length < 1) {
        toast.error("Necesitás al menos 1 cuota");
        return;
      }
      if (Math.abs(installmentsDelta) > 0.05) {
        toast.error(
          `La suma de cuotas (${formatUSD(installmentsSum)}) no coincide con el precio (${formatUSD(priceNum)})`,
        );
        return;
      }
      if (installments.some((i) => !i.dueDate)) {
        toast.error("Cada cuota necesita una fecha de vencimiento");
        return;
      }
    }

    if (isEdit && existing) {
      onUpdate(
        existing.id,
        {
          name: trimmed,
          price: priceNum,
          cost: costNum,
          date: date.trim() || null,
        },
        paymentMode === "unico"
          ? {
              paymentMode: "unico",
              installments: [
                {
                  id: existing.installments[0]?.id,
                  amount: priceNum,
                  dueDate: singleDueDate,
                  status: markPaid ? "pagado" : "pendiente",
                  paidAt: markPaid
                    ? (existing.installments[0]?.paidAt ?? new Date().toISOString().slice(0, 10))
                    : undefined,
                  method: markPaid ? singleMethod : undefined,
                  notes: singleNotes.trim() || undefined,
                  feePercent:
                    markPaid && methodSupportsFee(singleMethod)
                      ? Number(singleFeePercent) || 0
                      : undefined,
                  feeFixed:
                    markPaid && methodSupportsFee(singleMethod)
                      ? Number(singleFeeFixed) || 0
                      : undefined,
                  feeDescription: markPaid ? singleFeeDescription.trim() || undefined : undefined,
                },
              ],
            }
          : {
              paymentMode: "cuotas",
              installments: installments.map((i) => {
                const prev = existing.installments.find((p) => p.id === i.id);
                const method = i.method ?? prev?.method;
                const isPaid = prev?.status === "pagado";
                const supports = isPaid && methodSupportsFee(method);
                return {
                  id: i.id,
                  amount: Number(i.amount) || 0,
                  dueDate: i.dueDate,
                  status: prev?.status,
                  paidAt: prev?.paidAt,
                  method,
                  notes: (i.notes ?? prev?.notes ?? "").trim() || undefined,
                  feePercent: supports
                    ? Number(i.feePercent ?? prev?.feePercent ?? 0) || 0
                    : undefined,
                  feeFixed: supports ? Number(i.feeFixed ?? prev?.feeFixed ?? 0) || 0 : undefined,
                  feeDescription: isPaid
                    ? (i.feeDescription ?? prev?.feeDescription ?? "").trim() || undefined
                    : undefined,
                };
              }),
            },
      );
    } else {
      onCreate({
        name: trimmed,
        price: priceNum,
        cost: costNum,
        date: date.trim() || undefined,
        paymentMode,
        installments:
          paymentMode === "cuotas"
            ? installments.map((i) => ({
                amount: Number(i.amount) || 0,
                dueDate: i.dueDate,
                method: i.method,
                notes: i.notes?.trim() || undefined,
              }))
            : undefined,
        markPaid: paymentMode === "unico" ? markPaid : undefined,
        dueDate: paymentMode === "unico" ? singleDueDate : undefined,
        method: paymentMode === "unico" && markPaid ? singleMethod : undefined,
        notes: paymentMode === "unico" ? singleNotes.trim() || undefined : undefined,
        feePercent:
          paymentMode === "unico" && markPaid && methodSupportsFee(singleMethod)
            ? Number(singleFeePercent) || 0
            : undefined,
        feeFixed:
          paymentMode === "unico" && markPaid && methodSupportsFee(singleMethod)
            ? Number(singleFeeFixed) || 0
            : undefined,
        feeDescription:
          paymentMode === "unico" && markPaid
            ? singleFeeDescription.trim() || undefined
            : undefined,
      });
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-terracotta" />
            {isEdit ? "Editar extra" : "Nuevo extra"}
          </DialogTitle>
          <DialogDescription>
            Servicios adicionales (tours, experiencias, upgrades) separados del viaje base.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="extra-name" className="text-xs">
              Nombre del extra
            </Label>
            <Input
              id="extra-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Tour Petra, Upgrade habitación"
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="extra-date" className="text-xs">
              Fecha del servicio (opcional)
            </Label>
            <Input
              id="extra-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="extra-price" className="text-xs">
                Precio (paga viajera)
              </Label>
              <Input
                id="extra-price"
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <Label htmlFor="extra-cost" className="text-xs">
                Costo proveedor
              </Label>
              <Input
                id="extra-cost"
                type="number"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Precio:</span>
              <span className="font-semibold tabular-nums">{formatUSD(priceNum)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo:</span>
              <span className="font-semibold tabular-nums text-destructive">
                −{formatUSD(costNum)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border/40 pt-1 mt-1">
              <span className="text-muted-foreground">Utilidad:</span>
              <span
                className={
                  profit > 0
                    ? "font-bold tabular-nums text-chart-3"
                    : profit < 0
                      ? "font-bold tabular-nums text-destructive"
                      : "font-bold tabular-nums text-muted-foreground"
                }
              >
                {formatUSD(profit)}
              </span>
            </div>
          </div>

          {/* Tipo de pago */}
          <div>
            <Label className="text-xs mb-1.5 block">Tipo de pago</Label>
            <RadioGroup
              value={paymentMode}
              onValueChange={(v) => setPaymentMode(v as "unico" | "cuotas")}
              className="grid grid-cols-2 gap-2"
            >
              <label
                className={`flex items-center gap-2 rounded border p-2 cursor-pointer text-xs ${paymentMode === "unico" ? "border-terracotta bg-terracotta/5" : "border-border/60"}`}
              >
                <RadioGroupItem value="unico" id="pm-unico" />
                <span>Pago único</span>
              </label>
              <label
                className={`flex items-center gap-2 rounded border p-2 cursor-pointer text-xs ${paymentMode === "cuotas" ? "border-terracotta bg-terracotta/5" : "border-border/60"}`}
              >
                <RadioGroupItem value="cuotas" id="pm-cuotas" />
                <span>Pago en cuotas</span>
              </label>
            </RadioGroup>
          </div>

          {paymentMode === "unico" ? (
            <div className="space-y-2 rounded border border-border/60 p-3">
              <div>
                <Label htmlFor="extra-due" className="text-xs">
                  Fecha límite de pago
                </Label>
                <Input
                  id="extra-due"
                  type="date"
                  value={singleDueDate}
                  onChange={(e) => setSingleDueDate(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={markPaid}
                  onChange={(e) => setMarkPaid(e.target.checked)}
                  className="rounded border-border"
                />
                <span>Marcar como pagado</span>
              </label>
              {markPaid && (
                <div>
                  <Label className="text-xs">Método de pago</Label>
                  <Select
                    value={singleMethod}
                    onValueChange={(v) => setSingleMethod(v as PaymentMethod)}
                  >
                    <SelectTrigger className="h-9 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {markPaid && methodSupportsFee(singleMethod) && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider">
                    {singleMethod === "stripe" ? "Comisión Stripe" : "Comisión (otra pasarela)"}
                  </p>
                  <p className="text-[10px] text-muted-foreground -mt-1">
                    Fee absorbida por la organizadora. Se descuenta del profit del extra y del
                    cobrado neto.
                  </p>
                  <div>
                    <Label className="text-xs">Descripción / referencia</Label>
                    <Input
                      type="text"
                      placeholder={
                        singleMethod === "stripe"
                          ? "Ej: Stripe Internacional"
                          : "Ej: MercadoPago 4.99%"
                      }
                      value={singleFeeDescription}
                      onChange={(e) => setSingleFeeDescription(e.target.value)}
                      className="h-8 mt-1"
                    />
                  </div>
                  {singleMethod === "stripe" && (
                    <div>
                      <Label className="text-xs">Preset</Label>
                      <Select
                        value={singleStripePreset}
                        onValueChange={(v) => applySinglePreset(v as StripePreset)}
                      >
                        <SelectTrigger className="h-8 mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="domestic">{STRIPE_PRESETS.domestic.label}</SelectItem>
                          <SelectItem value="international">
                            {STRIPE_PRESETS.international.label}
                          </SelectItem>
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">% comisión</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={singleFeePercent}
                        onChange={(e) => {
                          setSingleFeePercent(e.target.value);
                          setSingleStripePreset("custom");
                        }}
                        className="h-8 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Fijo (USD)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={singleFeeFixed}
                        onChange={(e) => {
                          setSingleFeeFixed(e.target.value);
                          setSingleStripePreset("custom");
                        }}
                        className="h-8 mt-1"
                      />
                    </div>
                  </div>
                  {(() => {
                    const r = computePaymentNet(
                      priceNum,
                      singleMethod,
                      Number(singleFeePercent) || 0,
                      Number(singleFeeFixed) || 0,
                    );
                    return (
                      <div className="text-[11px] flex items-center justify-between pt-1 border-t border-primary/15">
                        <span className="text-muted-foreground">
                          Comisión:{" "}
                          <span className="text-destructive font-medium">
                            −{formatUSD(r.feeAmount)}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          Neto:{" "}
                          <span className="text-chart-3 font-semibold">
                            {formatUSD(r.netAmount)}
                          </span>
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
              <div>
                <Label htmlFor="extra-notes" className="text-xs">
                  Notas (opcional)
                </Label>
                <Textarea
                  id="extra-notes"
                  value={singleNotes}
                  onChange={(e) => setSingleNotes(e.target.value)}
                  placeholder="Notas internas sobre este extra o pago"
                  className="min-h-[60px] text-xs"
                  maxLength={500}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 rounded border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Cuotas ({installments.length})</Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={distributeEqually}
                  >
                    Distribuir parejo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] gap-1"
                    onClick={addInstallment}
                  >
                    <Plus className="h-3 w-3" /> Cuota
                  </Button>
                </div>
              </div>
              <ul className="space-y-2.5">
                {installments.map((inst, idx) => {
                  const prev =
                    isEdit && existing
                      ? existing.installments.find((p) => p.id === inst.id)
                      : undefined;
                  const isPaid = prev?.status === "pagado";
                  return (
                    <li
                      key={idx}
                      className="space-y-1.5 rounded border border-border/40 p-2 bg-background/40"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground w-6 tabular-nums">
                          #{idx + 1}
                        </span>
                        <Input
                          type="number"
                          value={inst.amount}
                          onChange={(e) => updateInstallment(idx, { amount: e.target.value })}
                          placeholder="Monto"
                          className="h-7 text-xs"
                          min="0"
                          step="0.01"
                        />
                        <Input
                          type="date"
                          value={inst.dueDate}
                          onChange={(e) => updateInstallment(idx, { dueDate: e.target.value })}
                          className="h-7 text-xs"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          onClick={() => removeInstallment(idx)}
                          disabled={installments.length <= 1}
                          title="Quitar cuota"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                      {isPaid && (
                        <>
                          <Select
                            value={inst.method ?? "transferencia"}
                            onValueChange={(v) =>
                              updateInstallment(idx, { method: v as PaymentMethod })
                            }
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Método" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="transferencia">Transferencia</SelectItem>
                              <SelectItem value="efectivo">Efectivo</SelectItem>
                              <SelectItem value="tarjeta">Tarjeta</SelectItem>
                              <SelectItem value="stripe">Stripe</SelectItem>
                              <SelectItem value="otro">Otro</SelectItem>
                            </SelectContent>
                          </Select>
                          {methodSupportsFee(inst.method) &&
                            (() => {
                              const pct =
                                Number(inst.feePercent ?? STRIPE_PRESETS.international.percent) ||
                                0;
                              const fix =
                                Number(inst.feeFixed ?? STRIPE_PRESETS.international.fixed) || 0;
                              const r = computePaymentNet(
                                Number(inst.amount) || 0,
                                inst.method,
                                pct,
                                fix,
                              );
                              return (
                                <div className="rounded border border-primary/20 bg-primary/5 p-2 space-y-1.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider">
                                    {inst.method === "stripe" ? "Comisión Stripe" : "Comisión"}
                                  </p>
                                  <Input
                                    type="text"
                                    placeholder="Descripción / referencia"
                                    value={inst.feeDescription ?? ""}
                                    onChange={(e) =>
                                      updateInstallment(idx, { feeDescription: e.target.value })
                                    }
                                    className="h-7 text-[11px]"
                                  />
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={
                                        inst.feePercent ??
                                        String(STRIPE_PRESETS.international.percent)
                                      }
                                      onChange={(e) =>
                                        updateInstallment(idx, { feePercent: e.target.value })
                                      }
                                      placeholder="% comisión"
                                      className="h-7 text-[11px]"
                                    />
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={
                                        inst.feeFixed ?? String(STRIPE_PRESETS.international.fixed)
                                      }
                                      onChange={(e) =>
                                        updateInstallment(idx, { feeFixed: e.target.value })
                                      }
                                      placeholder="Fijo USD"
                                      className="h-7 text-[11px]"
                                    />
                                  </div>
                                  <div className="text-[10px] flex items-center justify-between pt-0.5 border-t border-primary/15">
                                    <span className="text-muted-foreground">
                                      Comisión:{" "}
                                      <span className="text-destructive">
                                        −{formatUSD(r.feeAmount)}
                                      </span>
                                    </span>
                                    <span className="text-muted-foreground">
                                      Neto:{" "}
                                      <span className="text-chart-3 font-semibold">
                                        {formatUSD(r.netAmount)}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                        </>
                      )}
                      <Textarea
                        value={inst.notes ?? ""}
                        onChange={(e) => updateInstallment(idx, { notes: e.target.value })}
                        placeholder="Notas (opcional)"
                        className="min-h-[40px] text-[11px]"
                        maxLength={300}
                      />
                    </li>
                  );
                })}
              </ul>
              <div className="text-[11px] flex items-center justify-between pt-1 border-t border-border/40">
                <span className="text-muted-foreground">Suma cuotas:</span>
                <span className="tabular-nums font-medium">
                  {formatUSD(installmentsSum)}
                  {Math.abs(installmentsDelta) > 0.05 && (
                    <span className="text-destructive ml-1.5">
                      ({installmentsDelta > 0 ? "+" : ""}
                      {formatUSD(installmentsDelta)} vs precio)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>{isEdit ? "Guardar cambios" : "Crear extra"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contact row con quick actions (WhatsApp, email, copy) ───
function ContactRow({
  enrollee,
  fin,
  isCancelled,
}: {
  enrollee: Enrollee;
  fin: { amountPending: number; nextDue?: Installment | null };
  isCancelled: boolean;
}) {
  function copy(text: string, label: string) {
    if (!text) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiado`));
    }
  }
  function digitsOnly(p: string) {
    return p.replace(/[^\d]/g, "");
  }
  const phoneDigits = digitsOnly(enrollee.phone || "");
  const waMessage = encodeURIComponent(
    fin.nextDue && fin.amountPending > 0
      ? `Hola ${enrollee.name.split(" ")[0]}! Te recuerdo tu próxima cuota del viaje: ${formatUSD(installmentRemaining(fin.nextDue))} con vencimiento ${formatDate(fin.nextDue.dueDate)}. ¡Gracias!`
      : `Hola ${enrollee.name.split(" ")[0]}! Te escribo por tu inscripción al viaje.`,
  );
  const mailSubject = encodeURIComponent("Tu viaje grupal · Viajera");
  const mailBody = encodeURIComponent(
    fin.nextDue && fin.amountPending > 0
      ? `Hola ${enrollee.name.split(" ")[0]},\n\nTe recuerdo tu próxima cuota: ${formatUSD(installmentRemaining(fin.nextDue))} con vencimiento ${formatDate(fin.nextDue.dueDate)}.\n\nSaldo pendiente: ${formatUSD(fin.amountPending)}.\n\n¡Saludos!`
      : `Hola ${enrollee.name.split(" ")[0]},\n\nTe escribo por tu inscripción al viaje.\n\n¡Saludos!`,
  );

  return (
    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      {enrollee.email && (
        <span className="flex items-center gap-1">
          <Mail className="h-3 w-3" /> {enrollee.email}
          <button
            type="button"
            onClick={() => copy(enrollee.email, "Email")}
            className="hover:text-foreground transition-colors"
            title="Copiar email"
          >
            <Copy className="h-2.5 w-2.5" />
          </button>
          {!isCancelled && (
            <a
              href={`mailto:${enrollee.email}?subject=${mailSubject}&body=${mailBody}`}
              className="hover:text-primary transition-colors"
              title="Enviar email"
            >
              <Mail className="h-2.5 w-2.5" />
            </a>
          )}
        </span>
      )}
      {enrollee.phone && (
        <span className="flex items-center gap-1">
          <Phone className="h-3 w-3" /> {enrollee.phone}
          <button
            type="button"
            onClick={() => copy(enrollee.phone, "Teléfono")}
            className="hover:text-foreground transition-colors"
            title="Copiar teléfono"
          >
            <Copy className="h-2.5 w-2.5" />
          </button>
          {!isCancelled && phoneDigits.length >= 8 && (
            <a
              href={`https://wa.me/${phoneDigits}?text=${waMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-chart-3 hover:text-chart-3/80 transition-colors"
              title="Abrir WhatsApp"
            >
              <MessageCircle className="h-3 w-3" />
            </a>
          )}
        </span>
      )}
    </div>
  );
}

// ─── Dialog: Editar contacto ─────────────────────────────────
function EditContactDialog({
  open,
  onOpenChange,
  enrollee,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enrollee: Enrollee;
  onSave: (patch: { name: string; email: string; phone: string }) => void;
}) {
  const [name, setName] = useState(enrollee.name);
  const [email, setEmail] = useState(enrollee.email);
  const [phone, setPhone] = useState(enrollee.phone);

  // Sincronizar al abrir
  const key = `${enrollee.id}:${open}`;
  useMemo(() => {
    if (open) {
      setName(enrollee.name);
      setEmail(enrollee.email);
      setPhone(enrollee.phone);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit() {
    const n = name.trim();
    if (!n) {
      toast.error("El nombre es obligatorio");
      return;
    }
    if (n.length > 100) {
      toast.error("Nombre demasiado largo");
      return;
    }
    if (email.length > 255) {
      toast.error("Email demasiado largo");
      return;
    }
    if (phone.length > 50) {
      toast.error("Teléfono demasiado largo");
      return;
    }
    onSave({ name: n, email: email.trim(), phone: phone.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar contacto</DialogTitle>
          <DialogDescription>Actualiza los datos de contacto de {enrollee.name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nombre completo *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </div>
          <div>
            <Label className="text-xs">Teléfono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Guardar cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Confirmar eliminación de viajera ────────────────
function DeleteEnrolleeDialog({
  open,
  onOpenChange,
  enrolleeName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enrolleeName: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar viajera</DialogTitle>
          <DialogDescription>
            Vas a eliminar permanentemente a <strong>{enrolleeName}</strong> y todo su historial
            (pagos, descuentos, audit log). Esta acción no se puede deshacer.
            <br />
            <br />
            Si la viajera canceló el viaje, considerá usar <strong>Cancelar inscripción</strong> en
            lugar de eliminar, para conservar el registro.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Eliminar definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Audit Log: timeline cronológico por viajera ─────────────
const AUDIT_CONFIG: Record<
  AuditAction,
  { label: string; Icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  inscripcion: { label: "Inscripción", Icon: Users, tone: "text-foreground bg-muted" },
  logistica_editada: { label: "Logística", Icon: Plane, tone: "text-primary bg-primary/10" },
  adjunto_agregado: { label: "Archivo agregado", Icon: Plus, tone: "text-chart-3 bg-chart-3/10" },
  adjunto_eliminado: {
    label: "Archivo eliminado",
    Icon: Trash2,
    tone: "text-destructive bg-destructive/10",
  },
  plan_creado: { label: "Plan creado", Icon: Plus, tone: "text-chart-3 bg-chart-3/10" },
  plan_reemplazado: {
    label: "Plan reemplazado",
    Icon: RefreshCw,
    tone: "text-chart-3 bg-chart-3/10",
  },
  cuota_pagada: { label: "Cuota pagada", Icon: CreditCard, tone: "text-chart-3 bg-chart-3/10" },
  cuota_revertida: {
    label: "Cuota revertida",
    Icon: RotateCcw,
    tone: "text-chart-4 bg-chart-4/10",
  },
  cuota_editada: { label: "Cuota editada", Icon: Pencil, tone: "text-muted-foreground bg-muted" },
  abono_registrado: { label: "Abono", Icon: Wallet, tone: "text-chart-3 bg-chart-3/10" },
  abono_revertido: {
    label: "Abono revertido",
    Icon: RotateCcw,
    tone: "text-chart-4 bg-chart-4/10",
  },
  descuento_aplicado: { label: "Descuento", Icon: Tag, tone: "text-terracotta bg-terracotta/10" },
  descuento_editado: { label: "Descuento", Icon: Tag, tone: "text-terracotta bg-terracotta/10" },
  descuento_removido: { label: "Descuento", Icon: Tag, tone: "text-muted-foreground bg-muted" },
  participacion_aplicada: {
    label: "Participación",
    Icon: Split,
    tone: "text-chart-4 bg-chart-4/10",
  },
  participacion_editada: {
    label: "Participación",
    Icon: Split,
    tone: "text-chart-4 bg-chart-4/10",
  },
  participacion_removida: {
    label: "Participación",
    Icon: Split,
    tone: "text-muted-foreground bg-muted",
  },
  cancelacion: { label: "Cancelación", Icon: Ban, tone: "text-destructive bg-destructive/10" },
  reactivacion: { label: "Reactivación", Icon: RotateCcw, tone: "text-chart-3 bg-chart-3/10" },
  contacto_editado: { label: "Contacto", Icon: Pencil, tone: "text-muted-foreground bg-muted" },
  nota_editada: { label: "Nota", Icon: StickyNote, tone: "text-muted-foreground bg-muted" },
  sobrepago_devuelto: {
    label: "Sobrepago devuelto",
    Icon: RotateCcw,
    tone: "text-chart-3 bg-chart-3/10",
  },
  sobrepago_credito: {
    label: "Crédito a favor",
    Icon: CreditCard,
    tone: "text-chart-4 bg-chart-4/10",
  },
  credito_aplicado: {
    label: "Crédito aplicado",
    Icon: CreditCard,
    tone: "text-chart-3 bg-chart-3/10",
  },
  credito_reservado: {
    label: "Crédito reservado",
    Icon: CreditCard,
    tone: "text-chart-4 bg-chart-4/10",
  },
  credito_recibido: {
    label: "Crédito recibido",
    Icon: CreditCard,
    tone: "text-chart-3 bg-chart-3/10",
  },
  credito_revertido: {
    label: "Crédito revertido",
    Icon: RotateCcw,
    tone: "text-chart-4 bg-chart-4/10",
  },
  extra_creado: { label: "Extra creado", Icon: Plus, tone: "text-terracotta bg-terracotta/10" },
  extra_editado: { label: "Extra editado", Icon: Pencil, tone: "text-muted-foreground bg-muted" },
  extra_eliminado: {
    label: "Extra eliminado",
    Icon: Trash2,
    tone: "text-destructive bg-destructive/10",
  },
  extra_pagado: { label: "Extra pagado", Icon: Wallet, tone: "text-terracotta bg-terracotta/10" },
  extra_pago_revertido: {
    label: "Pago de extra revertido",
    Icon: RotateCcw,
    tone: "text-chart-4 bg-chart-4/10",
  },
};

function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function AuditLogSection({ log }: { log: AuditEntry[] }) {
  if (log.length === 0) return null;
  // Más recientes primero
  const sorted = [...log].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Accordion type="single" collapsible className="mt-3 pt-3 border-t">
      <AccordionItem value="audit" className="border-0">
        <AccordionTrigger className="py-1 hover:no-underline [&>svg]:h-3 [&>svg]:w-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <History className="h-3 w-3" />
            Historial de cambios
            <span className="text-[10px] text-muted-foreground/70">({log.length})</span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-1">
          <ol className="relative ml-1 border-l border-border/60 pl-4 space-y-2.5 mt-1">
            {sorted.map((entry) => {
              const cfg = AUDIT_CONFIG[entry.action];
              const Icon = cfg.Icon;
              return (
                <li key={entry.id} className="relative">
                  <span
                    className={`absolute -left-[22px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ${cfg.tone}`}
                  >
                    <Icon className="h-2.5 w-2.5" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-[11px] font-medium text-foreground leading-tight">
                      {entry.summary}
                    </p>
                    <time className="text-[10px] text-muted-foreground tabular-nums">
                      {formatAuditTimestamp(entry.at)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function PriceCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "muted" | "strong" | "terracotta" | "warning" | "positive";
}) {
  const color =
    tone === "terracotta"
      ? "text-terracotta"
      : tone === "strong"
        ? "text-foreground"
        : tone === "warning"
          ? "text-chart-4"
          : tone === "positive"
            ? "text-chart-3"
            : "text-muted-foreground";
  return (
    <div className="rounded-md border border-border/30 bg-muted/20 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function DiscountForm({
  basePrice,
  current,
  hasPaidInstallments,
  amountPaid,
  onCancel,
  onSave,
  onRemove,
}: {
  basePrice: number;
  current: Discount | null;
  hasPaidInstallments: boolean;
  amountPaid: number;
  onCancel: () => void;
  onSave: (d: Discount) => void;
  onRemove: () => void;
}) {
  const [type, setType] = useState<DiscountType>(current?.type ?? "early_bird");
  const [mode, setMode] = useState<DiscountMode>(current?.mode ?? "percent");
  const [value, setValue] = useState(String(current?.value ?? ""));

  const numValue = parseFloat(value);
  const draft: Discount | null =
    !isNaN(numValue) && numValue > 0 ? { type, mode, value: numValue } : null;
  const previewFinal = draft ? computeFinalPrice(basePrice, draft) : basePrice;
  const previewDiscount = basePrice - previewFinal;
  const wouldBeBelowPaid = hasPaidInstallments && previewFinal < amountPaid;

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        Aplicar promoción / descuento
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Tipo de promoción</Label>
          <Select value={type} onValueChange={(v) => setType(v as DiscountType)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="early_bird">Early Bird</SelectItem>
              <SelectItem value="group">Descuento por grupo</SelectItem>
              <SelectItem value="manual">Descuento manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Modalidad</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as DiscountMode)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Porcentaje (%)</SelectItem>
              <SelectItem value="fixed">Monto fijo (USD)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">
            {mode === "percent" ? "Porcentaje (0-100)" : "Monto en USD"}
          </Label>
          <Input
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-9"
            placeholder={mode === "percent" ? "10" : "200"}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border/50 bg-muted/30 p-3 grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Precio base</p>
          <p className="font-semibold tabular-nums">{formatUSD(basePrice)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Descuento</p>
          <p className="font-semibold tabular-nums text-terracotta">
            −{formatUSD(previewDiscount)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Precio final</p>
          <p className="font-bold tabular-nums text-foreground">{formatUSD(previewFinal)}</p>
        </div>
      </div>

      {wouldBeBelowPaid && (
        <p className="text-[11px] text-destructive">
          ⚠ El precio final ({formatUSD(previewFinal)}) es menor al monto ya pagado (
          {formatUSD(amountPaid)}). Las cuotas pendientes quedarán en 0; no se reembolsan los pagos.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => draft && onSave(draft)} disabled={!draft}>
          Aplicar descuento
        </Button>
        {current && (
          <Button size="sm" variant="outline" onClick={onRemove}>
            Quitar descuento
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Al aplicar el descuento, el saldo restante se redistribuye entre las cuotas pendientes. Los
        pagos ya realizados no se modifican.
      </p>
    </div>
  );
}

function InstallmentRow({
  index,
  installment,
  followingInstallments,
  allInstallments,
  onToggle,
  onUpdate,
  onAddPayment,
  onRemovePayment,
  onUpdatePayment,
  onAttachOrphanMethod,
}: {
  index: number;
  installment: Installment;
  followingInstallments: Installment[];
  allInstallments: Installment[];
  onToggle: () => void;
  onUpdate: (patch: Partial<Installment>) => void;
  onAddPayment: (payment: {
    amount: number;
    paidAt: string;
    notes?: string;
    method?: PaymentMethod;
    feePercent?: number;
    feeFixed?: number;
    feeDescription?: string;
  }) => void;
  onRemovePayment: (paymentId: string) => void;
  onUpdatePayment: (
    paymentId: string,
    patch: {
      amount?: number;
      method?: PaymentMethod;
      feePercent?: number;
      feeFixed?: number;
      feeDescription?: string;
      paidAt?: string;
      notes?: string;
    },
  ) => void;
  onAttachOrphanMethod: (payment: {
    paidAt: string;
    notes?: string;
    method?: PaymentMethod;
    feePercent?: number;
    feeFixed?: number;
    feeDescription?: string;
  }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftDate, setDraftDate] = useState(installment.dueDate);
  const [draftAmount, setDraftAmount] = useState(String(installment.amount));
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [editingPayment, setEditingPayment] = useState<InstallmentPayment | null>(null);
  const [editingOrphan, setEditingOrphan] = useState(false);

  const isPaid = installment.status === "pagado";
  const overdue = !isPaid && isOverdue(installment);
  const payments = installment.payments ?? [];

  function save() {
    const amount = parseFloat(draftAmount);
    if (isNaN(amount) || amount < 0) return;
    onUpdate({ amount, dueDate: draftDate });
    setEditing(false);
  }

  // Color del status badge
  const statusBadgeClass = isPaid
    ? "bg-chart-3/15 text-chart-3"
    : overdue
      ? "bg-destructive/15 text-destructive"
      : "bg-muted text-muted-foreground";

  const statusLabel = isPaid
    ? `Pagado${installment.paidAt ? ` · ${formatDate(installment.paidAt)}` : ""}`
    : overdue
      ? "Vencida"
      : "Pendiente";

  const rowBg = isPaid ? "bg-chart-3/5" : overdue ? "bg-destructive/5" : "";

  return (
    <>
      <TableRow className={rowBg}>
        <TableCell className="text-muted-foreground tabular-nums text-xs align-top pt-3">
          {index}
        </TableCell>
        <TableCell className="align-top pt-3">
          {editing ? (
            <Input
              type="date"
              className="h-8 w-36"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
            />
          ) : (
            <span
              className={`text-sm tabular-nums ${overdue && !isPaid ? "text-destructive font-medium" : ""}`}
            >
              {formatDate(installment.dueDate)}
            </span>
          )}
        </TableCell>
        <TableCell className="text-right align-top pt-3">
          {editing ? (
            <Input
              type="number"
              className="h-8 w-24 text-right ml-auto"
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
            />
          ) : (
            <div className="flex flex-col items-end">
              <span
                className={`font-medium tabular-nums ${overdue && !isPaid ? "text-destructive" : ""}`}
              >
                {formatUSD(installment.amount)}
              </span>
              {(installment.reductions?.length ?? 0) > 0 && installment.originalAmount && (
                <span
                  className="text-[10px] text-chart-3 tabular-nums mt-0.5"
                  title={`Monto original: ${formatUSD(installment.originalAmount)} · reducido por excedente de cuota anterior`}
                >
                  ↓ desde {formatUSD(installment.originalAmount)}
                </span>
              )}
              {isPaid && payments.length > 1 && (
                <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                  {payments.length} abonos
                </span>
              )}
            </div>
          )}
        </TableCell>
        <TableCell className="align-top pt-3">
          <Badge className={`${statusBadgeClass} border-0 text-[11px] w-fit`}>{statusLabel}</Badge>
        </TableCell>
        <TableCell className="align-top pt-2">
          {payments.length === 0 ? (
            <button
              type="button"
              onClick={() => (isPaid ? setEditingOrphan(true) : setShowPaymentDialog(true))}
              title={isPaid ? "Asignar método de pago" : "Registrar abono"}
              className="inline-flex items-center justify-center h-6 w-6 rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
          ) : (
            <div className="flex flex-col gap-1.5">
              {[...payments]
                .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
                .map((p) => {
                  const method = p.method ?? "transferencia";
                  const fee = p.feeAmount ?? 0;
                  const net = p.netAmount ?? p.amount;
                  return (
                    <div key={p.id} className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <PaymentMethodBadge method={method} />
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {formatUSD(p.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingPayment(p)}
                          className="text-muted-foreground/60 hover:text-foreground transition-colors"
                          title="Editar método de pago"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                      {p.feeDescription && (
                        <div
                          className="text-[10px] text-muted-foreground italic leading-tight truncate"
                          title={p.feeDescription}
                        >
                          {p.feeDescription}
                        </div>
                      )}
                      {p.notes && (
                        <div
                          className="text-[10px] text-muted-foreground/80 leading-tight truncate"
                          title={p.notes}
                        >
                          📝 {p.notes}
                        </div>
                      )}
                      {fee > 0 && (
                        <div className="text-[10px] text-muted-foreground tabular-nums leading-tight">
                          Comisión <span className="text-chart-4">{formatUSD(fee)}</span> · Neto{" "}
                          <span className="text-chart-3 font-medium">{formatUSD(net)}</span>
                          {p.feePercent != null && (
                            <span className="text-muted-foreground/70">
                              {" "}
                              ({p.feePercent}%{p.feeFixed ? ` + ${formatUSD(p.feeFixed)}` : ""})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </TableCell>
        <TableCell className="text-right align-top pt-2">
          <div className="flex justify-end gap-0.5 flex-wrap">
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-chart-3"
                  onClick={save}
                  title="Guardar"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditing(false)}
                  title="Cancelar"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                {payments.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowPayments((v) => !v)}
                    title={showPayments ? "Ocultar abonos" : `Ver ${payments.length} abonos`}
                  >
                    {showPayments ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditing(true)}
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                {!isPaid && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] px-2 gap-1"
                    onClick={() => setShowPaymentDialog(true)}
                    title="Registrar abono parcial"
                  >
                    <Wallet className="h-3 w-3" /> Abono
                  </Button>
                )}
                <Button
                  variant={isPaid ? "ghost" : "default"}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={onToggle}
                  title={isPaid ? "Revertir cuota completa" : "Marcar pagado"}
                >
                  {isPaid ? "Revertir" : "Marcar pagado"}
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
      {showPayments && payments.length > 0 && (
        <TableRow className={rowBg}>
          <TableCell colSpan={6} className="py-2">
            <div className="ml-8 border-l-2 border-border/40 pl-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Abonos registrados ({payments.length})
              </p>
              {[...payments]
                .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
                .map((p) => {
                  const method = p.method ?? "transferencia";
                  const fee = p.feeAmount ?? 0;
                  const net = p.netAmount ?? p.amount;
                  return (
                    <div
                      key={p.id}
                      className="flex items-start justify-between gap-2 text-xs bg-background/60 rounded px-2 py-1.5 border border-border/30"
                    >
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Wallet className="h-3 w-3 text-chart-3 shrink-0" />
                          <span className="font-medium tabular-nums">{formatUSD(p.amount)}</span>
                          <PaymentMethodBadge method={method} />
                          <span className="text-muted-foreground tabular-nums">
                            · {formatDate(p.paidAt)}
                          </span>
                          {p.notes && (
                            <span className="text-muted-foreground truncate">· {p.notes}</span>
                          )}
                        </div>
                        {fee > 0 && (
                          <div className="text-[10px] text-muted-foreground tabular-nums pl-5">
                            Comisión <span className="text-chart-4">{formatUSD(fee)}</span> · Neto{" "}
                            <span className="text-chart-3 font-medium">{formatUSD(net)}</span>
                            {p.feePercent != null && (
                              <span className="text-muted-foreground/70">
                                {" "}
                                ({p.feePercent}%{p.feeFixed ? ` + ${formatUSD(p.feeFixed)}` : ""})
                              </span>
                            )}
                          </div>
                        )}
                        {p.feeDescription && (
                          <div className="text-[10px] text-muted-foreground italic pl-5 leading-tight">
                            {p.feeDescription}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingPayment(p)}
                          title="Editar método de pago"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onRemovePayment(p.id)}
                          title="Eliminar abono"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </TableCell>
        </TableRow>
      )}
      {showPaymentDialog && (
        <AddPaymentDialog
          installmentAmount={installment.amount}
          installmentIndex={index}
          followingInstallments={followingInstallments}
          onClose={() => setShowPaymentDialog(false)}
          onSubmit={(payment) => {
            const remaining = installment.amount;
            const followingPendingTotal = followingInstallments
              .filter((i) => i.status === "pendiente")
              .reduce((s, i) => s + i.amount, 0);
            onAddPayment(payment);
            setShowPaymentDialog(false);
            const delta = payment.amount - remaining;
            if (delta > 0.005) {
              const absorbed = Math.min(delta, followingPendingTotal);
              if (absorbed > 0.005) {
                toast.success(
                  `Cuota ${index} cerrada en ${formatUSD(payment.amount)} · excedente ${formatUSD(absorbed)} reduce próximas cuotas`,
                );
              } else {
                toast.success(
                  `Cuota ${index} cerrada en ${formatUSD(payment.amount)} · sobrepago ${formatUSD(delta)} sin asignar`,
                );
              }
            } else if (delta < -0.005) {
              const shortfall = -delta;
              const hasFollowingPending = followingInstallments.some(
                (i) => i.status === "pendiente",
              );
              if (hasFollowingPending) {
                toast.success(
                  `Cuota ${index} cerrada en ${formatUSD(payment.amount)} · faltante ${formatUSD(shortfall)} trasladado a la última cuota pendiente`,
                );
              } else {
                // Faltante en última pendiente → señalizar al padre que abra diálogo
                toast.warning(
                  `Cuota ${index} cerrada en ${formatUSD(payment.amount)} · faltante ${formatUSD(shortfall)} sin asignar`,
                  {
                    description: "Creá una nueva cuota desde el banner amarillo en la ficha.",
                  },
                );
              }
            } else {
              toast.success(`Cuota ${index} pagada · ${formatUSD(payment.amount)}`);
            }
          }}
        />
      )}
      {editingPayment && (
        <EditPaymentDialog
          payment={editingPayment}
          installmentIndex={index}
          installmentId={installment.id}
          allInstallments={allInstallments}
          onClose={() => setEditingPayment(null)}
          onSubmit={(patch) => {
            onUpdatePayment(editingPayment.id, patch);
            setEditingPayment(null);
            toast.success(
              `Abono actualizado · ${PAYMENT_METHOD_LABELS[patch.method ?? "transferencia"]}`,
            );
          }}
        />
      )}
      {editingOrphan && (
        <EditPaymentDialog
          payment={{
            id: "__orphan__",
            amount: installment.amount,
            paidAt: installment.paidAt ?? new Date().toISOString().slice(0, 10),
          }}
          installmentIndex={index}
          installmentId={installment.id}
          allInstallments={allInstallments}
          onClose={() => setEditingOrphan(false)}
          onSubmit={(patch) => {
            onAttachOrphanMethod({
              method: patch.method,
              feePercent: patch.feePercent,
              feeFixed: patch.feeFixed,
              feeDescription: patch.feeDescription,
              paidAt: patch.paidAt,
              notes: patch.notes,
            });
            setEditingOrphan(false);
            toast.success(
              `Método asignado · ${PAYMENT_METHOD_LABELS[patch.method ?? "transferencia"]}`,
            );
          }}
        />
      )}
    </>
  );
}

type StripePreset = "domestic" | "international" | "custom";
const STRIPE_PRESETS: Record<
  Exclude<StripePreset, "custom">,
  { percent: number; fixed: number; label: string }
> = {
  domestic: { percent: 2.9, fixed: 0.3, label: "Doméstica (2.9% + $0.30)" },
  international: { percent: 4.4, fixed: 0.3, label: "Internacional (4.4% + $0.30)" },
};

function AddPaymentDialog({
  installmentAmount,
  installmentIndex,
  followingInstallments,
  onClose,
  onSubmit,
}: {
  installmentAmount: number;
  installmentIndex: number;
  followingInstallments: Installment[];
  onClose: () => void;
  onSubmit: (payment: {
    amount: number;
    paidAt: string;
    notes?: string;
    method?: PaymentMethod;
    feePercent?: number;
    feeFixed?: number;
    feeDescription?: string;
  }) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState(String(installmentAmount));
  const [paidAt, setPaidAt] = useState(today);
  const [notes, setNotes] = useState("");
  const [method, setMethodRaw] = useState<PaymentMethod>("transferencia");
  const [stripePreset, setStripePreset] = useState<StripePreset>("international");
  const [feePercent, setFeePercent] = useState<string>(
    String(STRIPE_PRESETS.international.percent),
  );
  const [feeFixed, setFeeFixed] = useState<string>(String(STRIPE_PRESETS.international.fixed));
  const [feeDescription, setFeeDescription] = useState<string>("");

  function setMethod(next: PaymentMethod) {
    setMethodRaw(next);
    if (next === "stripe") {
      // Re-aplicar preset Internacional al volver a Stripe.
      setStripePreset("international");
      setFeePercent(String(STRIPE_PRESETS.international.percent));
      setFeeFixed(String(STRIPE_PRESETS.international.fixed));
    } else if (next === "otro") {
      // Empezar en 0 — la organizadora completa según la pasarela.
      setFeePercent("0");
      setFeeFixed("0");
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const parsed = parseFloat(amount);
  const valid = !isNaN(parsed) && parsed > 0;
  const pctNum = parseFloat(feePercent);
  const fixedNum = parseFloat(feeFixed);
  const safePct = isNaN(pctNum) ? 0 : pctNum;
  const safeFixed = isNaN(fixedNum) ? 0 : fixedNum;

  // Cuotas pendientes posteriores que pueden absorber excedente o faltante.
  const followingPending = followingInstallments.filter((i) => i.status === "pendiente");
  const followingPendingTotal = followingPending.reduce((s, i) => s + i.amount, 0);
  const lastPendingFollowing = followingPending[followingPending.length - 1];

  const delta = valid ? round2(parsed - installmentAmount) : 0;

  // Cálculo en vivo de comisión / neto.
  const { feeAmount: liveFee, netAmount: liveNet } = valid
    ? computePaymentNet(parsed, method, safePct, safeFixed)
    : { feeAmount: 0, netAmount: 0 };

  function applyPreset(p: StripePreset) {
    setStripePreset(p);
    if (p !== "custom") {
      setFeePercent(String(STRIPE_PRESETS[p].percent));
      setFeeFixed(String(STRIPE_PRESETS[p].fixed));
    }
  }

  // Preview de redistribución del excedente (delta > 0) en orden cronológico.
  type SurplusRow = { idx: number; before: number; after: number; removed: boolean };
  const surplusPreview = (() => {
    if (!valid || delta <= 0.005) return [] as SurplusRow[];
    let leftover = delta;
    const rows: SurplusRow[] = [];
    for (let i = followingInstallments.length - 1; i >= 0 && leftover > 0.005; i--) {
      const inst = followingInstallments[i];
      if (inst.status !== "pendiente") continue;
      if (inst.amount <= 0) continue;
      const reduceBy = round2(Math.min(leftover, inst.amount));
      const after = round2(inst.amount - reduceBy);
      rows.push({
        idx: installmentIndex + 1 + i,
        before: inst.amount,
        after,
        removed: after <= 0.005,
      });
      leftover = round2(leftover - reduceBy);
    }
    return rows.sort((a, b) => a.idx - b.idx);
  })();
  const surplusUnassigned = (() => {
    if (!valid || delta <= 0.005) return 0;
    const absorbed = surplusPreview.reduce((s, r) => s + (r.before - r.after), 0);
    return round2(delta - absorbed);
  })();

  const shortfallTotal = valid && delta < -0.005 ? round2(-delta) : 0;
  const shortfallTarget = lastPendingFollowing
    ? {
        idx: installmentIndex + 1 + followingInstallments.indexOf(lastPendingFollowing),
        before: lastPendingFollowing.amount,
        after: round2(lastPendingFollowing.amount + shortfallTotal),
      }
    : null;

  function handleSubmit() {
    if (!valid) return;
    const supportsFee = method === "stripe" || method === "otro";
    onSubmit({
      amount: round2(parsed),
      paidAt,
      notes: notes.trim() || undefined,
      method,
      feePercent: supportsFee ? safePct : undefined,
      feeFixed: supportsFee ? safeFixed : undefined,
      feeDescription: feeDescription.trim() || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-chart-3" /> Registrar abono
          </DialogTitle>
          <DialogDescription>
            Cuota {installmentIndex} de {formatUSD(installmentAmount)}.
            <span className="block text-[11px] mt-0.5">
              La cuota se cierra al monto que ingreses.
              {followingPendingTotal > 0 && (
                <>
                  {" "}
                  Excedente o faltante se ajusta en la última cuota pendiente (
                  {formatUSD(followingPendingTotal)} disponibles).
                </>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="abono-amount" className="text-xs">
              Monto del abono (USD)
            </Label>
            <Input
              id="abono-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 mt-1"
            />
            {!valid && parsed <= 0 && amount.trim() !== "" && (
              <p className="text-[11px] text-destructive mt-1">Ingresá un monto mayor a 0.</p>
            )}
            {valid && Math.abs(delta) <= 0.005 && (
              <p className="text-[11px] text-chart-3 mt-1">
                ✓ Coincide exactamente con el monto de la cuota.
              </p>
            )}
          </div>

          {/* Método de pago */}
          <div>
            <Label className="text-xs">Método de pago</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method === "stripe" && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Comisión Stripe
              </p>
              <p className="text-[10px] text-muted-foreground -mt-1">
                Fee absorbida por la organizadora. Los presets son atajos; podés editar % y fijo.
              </p>
              <div>
                <Label className="text-xs">Descripción / referencia</Label>
                <Input
                  type="text"
                  placeholder="Ej: Stripe Internacional · ref #1234"
                  value={feeDescription}
                  onChange={(e) => setFeeDescription(e.target.value)}
                  className="h-8 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Preset</Label>
                <Select value={stripePreset} onValueChange={(v) => applyPreset(v as StripePreset)}>
                  <SelectTrigger className="h-8 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domestic">{STRIPE_PRESETS.domestic.label}</SelectItem>
                    <SelectItem value="international">
                      {STRIPE_PRESETS.international.label}
                    </SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">% comisión</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feePercent}
                    onChange={(e) => {
                      setFeePercent(e.target.value);
                      setStripePreset("custom");
                    }}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fijo (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feeFixed}
                    onChange={(e) => {
                      setFeeFixed(e.target.value);
                      setStripePreset("custom");
                    }}
                    className="h-8 mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {(method === "transferencia" || method === "efectivo" || method === "tarjeta") && (
            <div>
              <Label className="text-xs">Descripción / referencia (opcional)</Label>
              <Input
                type="text"
                placeholder="Ej: Banco Galicia · CBU últimos 4: 1234"
                value={feeDescription}
                onChange={(e) => setFeeDescription(e.target.value)}
                className="h-8 mt-1"
              />
            </div>
          )}

          {method === "otro" && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Comisión (otra pasarela)
              </p>
              <p className="text-[10px] text-muted-foreground -mt-1">
                Si la pasarela cobra fee y la absorbés vos, indicá descripción, % y fijo. Dejá en 0
                si no hay comisión.
              </p>
              <div>
                <Label className="text-xs">Descripción</Label>
                <Input
                  type="text"
                  placeholder="Ej: MercadoPago 4.99%"
                  value={feeDescription}
                  onChange={(e) => setFeeDescription(e.target.value)}
                  className="h-8 mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">% comisión</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feePercent}
                    onChange={(e) => setFeePercent(e.target.value)}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fijo (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feeFixed}
                    onChange={(e) => setFeeFixed(e.target.value)}
                    className="h-8 mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Resumen Bruto / Comisión / Neto */}
          {valid && (
            <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 space-y-1 text-xs tabular-nums">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bruto</span>
                <span className="font-medium">{formatUSD(parsed)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Comisión{" "}
                  {(method === "stripe" || method === "otro") &&
                    `(${safePct}% + ${formatUSD(safeFixed)})`}
                </span>
                <span
                  className={liveFee > 0 ? "text-chart-4 font-medium" : "text-muted-foreground"}
                >
                  {liveFee > 0 ? `−${formatUSD(liveFee)}` : formatUSD(0)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-1 mt-1">
                <span className="text-foreground font-semibold">Neto recibido</span>
                <span className="text-chart-3 font-bold">{formatUSD(liveNet)}</span>
              </div>
            </div>
          )}

          {valid && delta > 0.005 && (
            <div className="rounded-md border border-chart-3/30 bg-chart-3/5 p-2.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-chart-3 uppercase tracking-wider">
                Cuota cerrada con excedente
              </p>
              <div className="flex items-center justify-between text-xs">
                <span>Cuota {installmentIndex} cierra en</span>
                <span className="tabular-nums font-medium text-chart-3">{formatUSD(parsed)}</span>
              </div>
              {surplusPreview.length > 0 ? (
                surplusPreview.map((r) => (
                  <div key={r.idx} className="flex items-center justify-between text-xs">
                    <span>
                      Cuota {r.idx} {r.removed ? "se elimina" : "reduce monto"}
                    </span>
                    <span className="tabular-nums font-medium">
                      {formatUSD(r.before)} →{" "}
                      <span className="text-chart-3">{r.removed ? "—" : formatUSD(r.after)}</span>
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-chart-4">
                  No hay cuotas pendientes para absorber el excedente.
                </p>
              )}
              {surplusUnassigned > 0.005 && (
                <p className="text-[11px] text-chart-4">
                  Sobrepago sin asignar: {formatUSD(surplusUnassigned)}
                </p>
              )}
            </div>
          )}

          {valid && delta < -0.005 && (
            <div className="rounded-md border border-chart-4/30 bg-chart-4/5 p-2.5 space-y-1.5">
              <p className="text-[11px] font-semibold text-chart-4 uppercase tracking-wider">
                Cuota cerrada con faltante
              </p>
              <div className="flex items-center justify-between text-xs">
                <span>Cuota {installmentIndex} cierra en</span>
                <span className="tabular-nums font-medium text-chart-3">{formatUSD(parsed)}</span>
              </div>
              {shortfallTarget ? (
                <div className="flex items-center justify-between text-xs">
                  <span>
                    Faltante {formatUSD(shortfallTotal)} → cuota {shortfallTarget.idx}
                  </span>
                  <span className="tabular-nums font-medium">
                    {formatUSD(shortfallTarget.before)} →{" "}
                    <span className="text-chart-4">{formatUSD(shortfallTarget.after)}</span>
                  </span>
                </div>
              ) : (
                <p className="text-[11px]">
                  Es la última cuota pendiente. Faltante de {formatUSD(shortfallTotal)} quedará como{" "}
                  <strong>saldo sin asignar</strong> hasta crear una cuota nueva.
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="abono-date" className="text-xs">
              Fecha del pago
            </Label>
            <Input
              id="abono-date"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="h-9 mt-1"
            />
          </div>
          <div>
            <Label htmlFor="abono-notes" className="text-xs">
              Notas (opcional)
            </Label>
            <Input
              id="abono-notes"
              placeholder="Ej: transferencia, efectivo, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9 mt-1"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!valid}>
            Registrar abono
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PAYMENT_METHOD_BADGE_TONE: Record<PaymentMethod, string> = {
  transferencia: "bg-primary/15 text-primary border-primary/30",
  efectivo: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  tarjeta: "bg-chart-4/15 text-chart-4 border-chart-4/30",
  stripe: "bg-terracotta/15 text-terracotta border-terracotta/30",
  otro: "bg-muted text-muted-foreground border-border",
};

function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider border ${PAYMENT_METHOD_BADGE_TONE[method]}`}
    >
      {PAYMENT_METHOD_LABELS[method]}
    </span>
  );
}

/**
 * Simula la redistribución de delta cuando cambia el monto de un abono.
 * Replica la lógica de `updateInstallmentPayment` (rama amount-changed) sin
 * mutar nada, devolviendo la lista de ajustes para previsualizar en la UI.
 */
function simulatePaymentAmountChange(
  allInstallments: Installment[],
  installmentId: string,
  paymentId: string,
  newPaymentAmount: number,
): {
  newTargetAmount: number;
  oldTargetAmount: number;
  targetDelta: number;
  adjustments: { idx: number; before: number; after: number; removed: boolean }[];
  surplus: number;
  unassigned: number;
} {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const next = allInstallments.map((i) => ({ ...i, payments: i.payments ? [...i.payments] : [] }));
  const startIdx = next.findIndex((i) => i.id === installmentId);
  if (startIdx < 0) {
    return {
      newTargetAmount: 0,
      oldTargetAmount: 0,
      targetDelta: 0,
      adjustments: [],
      surplus: 0,
      unassigned: 0,
    };
  }
  const target = next[startIdx];
  const current = (target.payments ?? []).find((p) => p.id === paymentId);
  // Si es un abono sintético (orphan/new) usamos el amount del target como base "actual".
  const currentAmount = current ? current.amount : 0;
  const newPayments = current
    ? (target.payments ?? []).map((p) =>
        p.id === paymentId ? { ...p, amount: round2(newPaymentAmount) } : p,
      )
    : [
        ...(target.payments ?? []),
        {
          ...({} as InstallmentPayment),
          id: paymentId,
          amount: round2(newPaymentAmount),
          paidAt: "",
        },
      ];
  const newTotalPaid = round2(newPayments.reduce((s, p) => s + p.amount, 0));
  const oldAmount = target.amount;
  const newTargetAmount = newTotalPaid;
  const targetDelta = round2(newTargetAmount - oldAmount);

  next[startIdx] = { ...target, amount: newTargetAmount, payments: newPayments };

  const adjustments: { idx: number; before: number; after: number; removed: boolean }[] = [];
  let surplus = targetDelta > 0 ? targetDelta : 0;
  while (surplus > 0.005) {
    let lastIdx = -1;
    for (let i = next.length - 1; i >= 0; i--) {
      if (i === startIdx) continue;
      const inst = next[i];
      if (inst.status !== "pendiente") continue;
      if ((inst.payments?.length ?? 0) > 0) continue;
      if (inst.amount <= 0) continue;
      lastIdx = i;
      break;
    }
    if (lastIdx < 0) break;
    const inst = next[lastIdx];
    const reduceBy = round2(Math.min(surplus, inst.amount));
    const newAmount = round2(inst.amount - reduceBy);
    if (newAmount <= 0.005) {
      adjustments.push({ idx: lastIdx + 1, before: inst.amount, after: 0, removed: true });
      next.splice(lastIdx, 1);
    } else {
      next[lastIdx] = { ...inst, amount: newAmount };
      adjustments.push({ idx: lastIdx + 1, before: inst.amount, after: newAmount, removed: false });
    }
    surplus = round2(surplus - reduceBy);
  }

  let shortfall = targetDelta < 0 ? round2(-targetDelta) : 0;
  let unassigned = 0;
  if (shortfall > 0.005) {
    let pickIdx = -1;
    for (let i = next.length - 1; i > startIdx; i--) {
      if (next[i].status !== "pendiente") continue;
      pickIdx = i;
      break;
    }
    if (pickIdx < 0) {
      for (let i = next.length - 1; i >= 0; i--) {
        if (i === startIdx) continue;
        const inst = next[i];
        if (inst.status !== "pendiente") continue;
        if ((inst.payments?.length ?? 0) > 0) continue;
        pickIdx = i;
        break;
      }
    }
    if (pickIdx >= 0) {
      const inst = next[pickIdx];
      const before = inst.amount;
      const after = round2(before + shortfall);
      adjustments.push({ idx: pickIdx + 1, before, after, removed: false });
    } else {
      unassigned = shortfall;
    }
  }

  // Ordenar ajustes por número de cuota para una lectura natural.
  adjustments.sort((a, b) => a.idx - b.idx);

  return {
    newTargetAmount,
    oldTargetAmount: oldAmount,
    targetDelta,
    adjustments,
    surplus,
    unassigned,
  };
}

function EditPaymentDialog({
  payment,
  installmentIndex,
  installmentId,
  allInstallments,
  onClose,
  onSubmit,
}: {
  payment: InstallmentPayment;
  installmentIndex: number;
  installmentId: string;
  allInstallments: Installment[];
  onClose: () => void;
  onSubmit: (patch: {
    amount?: number;
    method: PaymentMethod;
    feePercent?: number;
    feeFixed?: number;
    feeDescription?: string;
    paidAt: string;
    notes?: string;
  }) => void;
}) {
  const initialMethod = payment.method ?? "transferencia";
  const [method, setMethodRaw] = useState<PaymentMethod>(initialMethod);
  const [amount, setAmount] = useState<string>(String(payment.amount));
  const [paidAt, setPaidAt] = useState(payment.paidAt);
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [feeDescription, setFeeDescription] = useState<string>(payment.feeDescription ?? "");

  // Detectar preset inicial desde valores existentes (solo aplica a Stripe).
  const initialPreset: StripePreset = (() => {
    if (initialMethod !== "stripe") return "international";
    const pct = payment.feePercent ?? 0;
    const fix = payment.feeFixed ?? 0;
    if (pct === STRIPE_PRESETS.domestic.percent && fix === STRIPE_PRESETS.domestic.fixed)
      return "domestic";
    if (pct === STRIPE_PRESETS.international.percent && fix === STRIPE_PRESETS.international.fixed)
      return "international";
    return "custom";
  })();
  const [stripePreset, setStripePreset] = useState<StripePreset>(initialPreset);
  const [feePercent, setFeePercent] = useState<string>(
    String(
      payment.feePercent ?? (initialMethod === "otro" ? 0 : STRIPE_PRESETS.international.percent),
    ),
  );
  const [feeFixed, setFeeFixed] = useState<string>(
    String(payment.feeFixed ?? (initialMethod === "otro" ? 0 : STRIPE_PRESETS.international.fixed)),
  );

  function setMethod(next: PaymentMethod) {
    setMethodRaw(next);
    if (next === "stripe" && initialMethod !== "stripe") {
      setStripePreset("international");
      setFeePercent(String(STRIPE_PRESETS.international.percent));
      setFeeFixed(String(STRIPE_PRESETS.international.fixed));
    } else if (next === "otro" && initialMethod !== "otro") {
      setFeePercent("0");
      setFeeFixed("0");
    }
  }

  const pctNum = parseFloat(feePercent);
  const fixedNum = parseFloat(feeFixed);
  const safePct = isNaN(pctNum) ? 0 : pctNum;
  const safeFixed = isNaN(fixedNum) ? 0 : fixedNum;
  const amountNum = parseFloat(amount);
  const safeAmount = isNaN(amountNum) || amountNum <= 0 ? 0 : amountNum;
  const amountChanged = Math.abs(safeAmount - payment.amount) > 0.005;
  const { feeAmount: liveFee, netAmount: liveNet } = computePaymentNet(
    safeAmount,
    method,
    safePct,
    safeFixed,
  );

  function applyPreset(p: StripePreset) {
    setStripePreset(p);
    if (p !== "custom") {
      setFeePercent(String(STRIPE_PRESETS[p].percent));
      setFeeFixed(String(STRIPE_PRESETS[p].fixed));
    }
  }

  function handleSubmit() {
    if (safeAmount <= 0) return;
    const supportsFee = method === "stripe" || method === "otro";
    onSubmit({
      amount: amountChanged ? safeAmount : undefined,
      method,
      feePercent: supportsFee ? safePct : undefined,
      feeFixed: supportsFee ? safeFixed : undefined,
      feeDescription: feeDescription.trim() || undefined,
      paidAt,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-chart-3" /> Editar abono
          </DialogTitle>
          <DialogDescription>
            Cuota {installmentIndex}. Editá monto, método, fecha o notas. Si cambia el monto, la
            cuota se cierra al nuevo total y el delta se redistribuye en cuotas pendientes
            posteriores (igual que al registrar un abono nuevo).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Monto del abono (USD)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 mt-1"
            />
            {amountChanged &&
              safeAmount > 0 &&
              (() => {
                const sim = simulatePaymentAmountChange(
                  allInstallments,
                  installmentId,
                  payment.id,
                  safeAmount,
                );
                const isSurplus = sim.targetDelta > 0;
                return (
                  <div className="mt-2 rounded-md border border-chart-4/30 bg-chart-4/5 p-2 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                      <span className="text-chart-4">↻</span>
                      <span>
                        Cuota {installmentIndex}: {formatUSD(sim.oldTargetAmount)} →{" "}
                        {formatUSD(sim.newTargetAmount)}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          ({isSurplus ? "+" : "−"}
                          {formatUSD(Math.abs(sim.targetDelta))})
                        </span>
                      </span>
                    </div>
                    {sim.adjustments.length > 0 && (
                      <div className="space-y-0.5 pl-4 border-l-2 border-chart-4/40">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Ajustes automáticos
                        </p>
                        {sim.adjustments.map((a) => (
                          <div
                            key={a.idx}
                            className="text-[11px] flex items-center gap-1.5 tabular-nums"
                          >
                            {a.removed ? (
                              <>
                                <span className="text-destructive">✕</span>
                                <span className="text-muted-foreground">
                                  Cuota {a.idx} eliminada (era {formatUSD(a.before)})
                                </span>
                              </>
                            ) : (
                              <>
                                <span
                                  className={a.after > a.before ? "text-chart-4" : "text-chart-3"}
                                >
                                  {a.after > a.before ? "↑" : "↓"}
                                </span>
                                <span>
                                  Cuota {a.idx}: {formatUSD(a.before)} → {formatUSD(a.after)}
                                </span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {sim.surplus > 0.005 && (
                      <p className="text-[10px] text-chart-4 pl-4">
                        ⚠ Sobrepago {formatUSD(sim.surplus)} pendiente de asignar (sin cuotas
                        posteriores).
                      </p>
                    )}
                    {sim.unassigned > 0.005 && (
                      <p className="text-[10px] text-chart-4 pl-4">
                        ⚠ Faltante {formatUSD(sim.unassigned)} sin cuota asignada.
                      </p>
                    )}
                    {sim.adjustments.length === 0 &&
                      sim.surplus <= 0.005 &&
                      sim.unassigned <= 0.005 && (
                        <p className="text-[10px] text-muted-foreground pl-4">
                          Sin redistribución: solo cambia el monto de esta cuota.
                        </p>
                      )}
                  </div>
                );
              })()}
          </div>
          <div>
            <Label className="text-xs">Método de pago</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method === "stripe" && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Comisión Stripe
              </p>
              <div>
                <Label className="text-xs">Descripción / referencia</Label>
                <Input
                  type="text"
                  placeholder="Ej: Stripe Internacional · ref #1234"
                  value={feeDescription}
                  onChange={(e) => setFeeDescription(e.target.value)}
                  className="h-8 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Preset</Label>
                <Select value={stripePreset} onValueChange={(v) => applyPreset(v as StripePreset)}>
                  <SelectTrigger className="h-8 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domestic">{STRIPE_PRESETS.domestic.label}</SelectItem>
                    <SelectItem value="international">
                      {STRIPE_PRESETS.international.label}
                    </SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">% comisión</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feePercent}
                    onChange={(e) => {
                      setFeePercent(e.target.value);
                      setStripePreset("custom");
                    }}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fijo (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feeFixed}
                    onChange={(e) => {
                      setFeeFixed(e.target.value);
                      setStripePreset("custom");
                    }}
                    className="h-8 mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {(method === "transferencia" || method === "efectivo" || method === "tarjeta") && (
            <div>
              <Label className="text-xs">Descripción / referencia (opcional)</Label>
              <Input
                type="text"
                placeholder="Ej: Banco Galicia · CBU últimos 4: 1234"
                value={feeDescription}
                onChange={(e) => setFeeDescription(e.target.value)}
                className="h-8 mt-1"
              />
            </div>
          )}

          {method === "otro" && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-2">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                Comisión (otra pasarela)
              </p>
              <p className="text-[10px] text-muted-foreground -mt-1">
                Si la pasarela cobra fee y la absorbés vos, indicá descripción, % y fijo. Dejá en 0
                si no hay comisión.
              </p>
              <div>
                <Label className="text-xs">Descripción</Label>
                <Input
                  type="text"
                  placeholder="Ej: MercadoPago 4.99%"
                  value={feeDescription}
                  onChange={(e) => setFeeDescription(e.target.value)}
                  className="h-8 mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">% comisión</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feePercent}
                    onChange={(e) => setFeePercent(e.target.value)}
                    className="h-8 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fijo (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feeFixed}
                    onChange={(e) => setFeeFixed(e.target.value)}
                    className="h-8 mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 space-y-1 text-xs tabular-nums">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bruto</span>
              <span className="font-medium">{formatUSD(safeAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Comisión{" "}
                {(method === "stripe" || method === "otro") &&
                  `(${safePct}% + ${formatUSD(safeFixed)})`}
              </span>
              <span className={liveFee > 0 ? "text-chart-4 font-medium" : "text-muted-foreground"}>
                {liveFee > 0 ? `−${formatUSD(liveFee)}` : formatUSD(0)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-1 mt-1">
              <span className="text-foreground font-semibold">Neto recibido</span>
              <span className="text-chart-3 font-bold">{formatUSD(liveNet)}</span>
            </div>
          </div>

          <div>
            <Label className="text-xs">Fecha del pago</Label>
            <Input
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="h-9 mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Notas (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9 mt-1" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanForm({
  defaultTotal,
  onCancel,
  onSave,
}: {
  defaultTotal: number;
  onCancel: () => void;
  onSave: (installments: Installment[]) => void;
}) {
  const [total, setTotal] = useState(String(defaultTotal));
  const [count, setCount] = useState<InstallmentCount>(3);
  const today = new Date().toISOString().slice(0, 10);
  const sixMonths = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  })();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(sixMonths);

  const preview = useMemo(() => {
    const t = parseFloat(total);
    if (isNaN(t) || t <= 0) return [];
    return generateInstallments(t, count, from, to);
  }, [total, count, from, to]);

  function handleSave() {
    if (preview.length === 0) return;
    onSave(preview);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        Crear plan de pagos
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Monto total</Label>
          <Input
            type="number"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs">N° de pagos</Label>
          <Select
            value={String(count)}
            onValueChange={(v) => setCount(parseInt(v, 10) as InstallmentCount)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 (pago completo)</SelectItem>
              <SelectItem value="3">3 cuotas</SelectItem>
              <SelectItem value="4">4 cuotas</SelectItem>
              <SelectItem value="6">6 cuotas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Primera fecha</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs">Última fecha</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9"
            disabled={count === 1}
          />
        </div>
      </div>

      {preview.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Vista previa
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {preview.map((p, i) => (
              <div
                key={p.id}
                className="flex justify-between items-center text-xs bg-background rounded px-2 py-1.5 border border-border/40"
              >
                <span className="text-muted-foreground">
                  #{i + 1} · {formatDate(p.dueDate)}
                </span>
                <span className="font-semibold tabular-nums">{formatUSD(p.amount)}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Las fechas y montos pueden editarse cuota por cuota después de crear el plan.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={preview.length === 0}>
          Crear plan
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ─── Form: Cancelación con sugerencia de devolución ──────────
function CancelForm({
  amountPaid,
  tripStartDate,
  refundRules,
  onCancel,
  onSave,
}: {
  amountPaid: number;
  tripStartDate: string;
  refundRules: RefundRule[];
  onCancel: () => void;
  onSave: (c: import("@/lib/finance-types").Cancellation) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [cancelledAt, setCancelledAt] = useState(today);
  const [notes, setNotes] = useState("");

  const suggestion = useMemo(
    () => computeSuggestedRefund(amountPaid, cancelledAt, tripStartDate, refundRules),
    [amountPaid, cancelledAt, tripStartDate, refundRules],
  );

  const [refundType, setRefundType] = useState<RefundType>(
    suggestion.percent === 100 ? "total" : suggestion.percent > 0 ? "parcial" : "ninguna",
  );
  const [refundAmount, setRefundAmount] = useState<string>(String(suggestion.amount));

  // Resugerir cuando cambian las inputs
  const suggestionKey = `${suggestion.amount}:${suggestion.percent}`;
  useMemo(() => {
    setRefundAmount(String(suggestion.amount));
    setRefundType(
      suggestion.percent === 100 ? "total" : suggestion.percent > 0 ? "parcial" : "ninguna",
    );
  }, [suggestionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const numRefund = Math.max(0, Math.min(amountPaid, parseFloat(refundAmount) || 0));
  const retained = Math.max(0, Math.round((amountPaid - numRefund) * 100) / 100);

  function handleQuick(t: RefundType) {
    setRefundType(t);
    if (t === "total") setRefundAmount(String(amountPaid));
    else if (t === "ninguna") setRefundAmount("0");
    else setRefundAmount(String(suggestion.amount));
  }

  function handleSave() {
    onSave({
      cancelledAt,
      refundType,
      suggestedRefund: suggestion.amount,
      refundedAmount: numRefund,
      retainedAmount: retained,
      appliedRuleId: suggestion.ruleId,
      notes: notes || undefined,
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-destructive font-semibold">
        Cancelar inscripción
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Fecha de cancelación</Label>
          <Input
            type="date"
            value={cancelledAt}
            onChange={(e) => setCancelledAt(e.target.value)}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs">Tipo de devolución</Label>
          <Select value={refundType} onValueChange={(v) => handleQuick(v as RefundType)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total">Devolución total</SelectItem>
              <SelectItem value="parcial">Devolución parcial</SelectItem>
              <SelectItem value="ninguna">Sin devolución</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Monto a devolver (USD)</Label>
          <Input
            type="number"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            className="h-9"
            min={0}
            max={amountPaid}
          />
        </div>
        <div>
          <Label className="text-xs">Notas</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Motivo, referencia..."
            className="h-9"
          />
        </div>
      </div>

      <div className="rounded-md border border-border/40 bg-muted/30 p-3 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pagado por la viajera:</span>
          <span className="font-semibold tabular-nums">{formatUSD(amountPaid)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Sugerido por política
            {suggestion.percent > 0 && ` (${suggestion.percent}%)`}:
          </span>
          <span className="tabular-nums">{formatUSD(suggestion.amount)}</span>
        </div>
        <div className="flex justify-between border-t border-border/40 pt-1 mt-1">
          <span className="text-muted-foreground">A devolver:</span>
          <span className="font-semibold tabular-nums text-chart-4">{formatUSD(numRefund)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Retenido (queda como ingreso):</span>
          <span className="font-semibold tabular-nums text-chart-3">{formatUSD(retained)}</span>
        </div>
        {refundRules.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic mt-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> No hay políticas configuradas. Sugerencia = $0.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={handleSave}>
          Confirmar cancelación
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Volver
        </Button>
      </div>
    </div>
  );
}

// ─── Form: Participación parcial ─────────────────────────────
function ParticipationForm({
  current,
  basePriceAfterDiscount,
  totalDays,
  onCancel,
  onSave,
  onRemove,
}: {
  current: Participation | null;
  basePriceAfterDiscount: number;
  totalDays: number;
  onCancel: () => void;
  onSave: (p: Participation) => void;
  onRemove: () => void;
}) {
  const [kind, setKind] = useState<ParticipationKind>(current?.kind ?? "dias");
  const [days, setDays] = useState(String(current?.daysIncluded ?? totalDays));
  const [segmentLabel, setSegmentLabel] = useState(current?.segmentLabel ?? "");
  const [useManual, setUseManual] = useState(typeof current?.manualPrice === "number");
  const [manualPrice, setManualPrice] = useState(
    String(current?.manualPrice ?? basePriceAfterDiscount),
  );

  const numDays = Math.max(0, Math.min(totalDays, parseInt(days || "0", 10)));
  const proportional =
    kind === "dias" && totalDays > 0
      ? Math.round(((basePriceAfterDiscount * numDays) / totalDays) * 100) / 100
      : basePriceAfterDiscount;
  const finalPrice = useManual ? Math.max(0, parseFloat(manualPrice) || 0) : proportional;

  function handleSave() {
    const p: Participation = {
      mode: "parcial",
      kind,
      daysIncluded: kind === "dias" ? numDays : undefined,
      totalDays: kind === "dias" ? totalDays : undefined,
      segmentLabel: kind === "tramo" ? segmentLabel : undefined,
      manualPrice: useManual ? finalPrice : undefined,
    };
    onSave(p);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-chart-4 font-semibold">
        Participación parcial
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as ParticipationKind)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dias">Por días</SelectItem>
              <SelectItem value="tramo">Por destino / tramo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {kind === "dias" ? (
          <div>
            <Label className="text-xs">Días incluidos (de {totalDays})</Label>
            <Input
              type="number"
              min={0}
              max={totalDays}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="h-9"
            />
          </div>
        ) : (
          <div>
            <Label className="text-xs">Destino / tramo</Label>
            <Input
              value={segmentLabel}
              onChange={(e) => setSegmentLabel(e.target.value)}
              placeholder="Ej: Solo Marrakech (días 1-4)"
              className="h-9"
            />
          </div>
        )}
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="manual-price-toggle"
            type="checkbox"
            checked={useManual}
            onChange={(e) => setUseManual(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="manual-price-toggle" className="text-xs cursor-pointer">
            Usar precio manual (override)
          </Label>
        </div>
        {useManual && (
          <div className="sm:col-span-2">
            <Label className="text-xs">Precio final manual (USD)</Label>
            <Input
              type="number"
              min={0}
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              className="h-9"
            />
          </div>
        )}
      </div>

      <div className="rounded-md border border-border/40 bg-muted/30 p-3 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Precio base (tras descuento):</span>
          <span className="tabular-nums">{formatUSD(basePriceAfterDiscount)}</span>
        </div>
        {kind === "dias" && !useManual && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Proporcional ({numDays}/{totalDays} días):
            </span>
            <span className="tabular-nums">{formatUSD(proportional)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border/40 pt-1 mt-1">
          <span className="text-muted-foreground">Precio efectivo:</span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatUSD(finalPrice)}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Las cuotas pendientes se rebalancean automáticamente. Las pagadas se preservan.
        </p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>
          Guardar participación
        </Button>
        {current && (
          <Button size="sm" variant="outline" onClick={onRemove}>
            Marcar completa
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ─── Tab: Resumen Financiero ─────────────────────────────────
function FinancialSummaryTab({ trip }: { trip: TripData }) {
  // Cálculos centralizados — lee directo de los costos del store
  const finance = useMemo(() => calculateTripFinancials(trip, trip.costs), [trip]);
  const collected = useMemo(
    () => aggregateEnrollees(trip.enrollees, trip.pricePerPerson).totalCollected,
    [trip.enrollees, trip.pricePerPerson],
  );
  const headerBaseCurrency = getTripBaseCurrency(trip);
  const headerVariableBasis = trip.capacity;
  const headerTotals = useMemo(() => {
    const isNotIncluded = (c: CostItem) =>
      c.included === false || c.category === "no_incluido";
    const included = trip.costs.filter((c) => !isNotIncluded(c));
    const fixed = included
      .filter((c) => c.category === "fijo")
      .reduce((s, c) => s + costBaseAmount(c, trip), 0);
    const variable = included
      .filter((c) => c.category === "variable")
      .reduce((s, c) => s + costBaseAmount(c, trip) * headerVariableBasis, 0);
    const team = included
      .filter((c) => c.category === "equipo")
      .reduce((s, c) => s + costBaseAmount(c, trip), 0);
    return { fixed, variable, team, total: fixed + variable + team };
  }, [trip, headerVariableBasis]);

  return (
    <div className="mt-4 space-y-6">
      {/* Totales de costos (fijos / variables / equipo / total) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Costos fijos",
            value: formatMoney(headerTotals.fixed, headerBaseCurrency),
            color: "text-primary",
            sub: null as string | null,
          },
          {
            label: "Costos variables",
            value: formatMoney(headerTotals.variable, headerBaseCurrency),
            color: "text-chart-3",
            sub: `× ${headerVariableBasis} viajera${headerVariableBasis === 1 ? "" : "s"} (planificado)`,
          },
          {
            label: "Equipo",
            value: formatMoney(headerTotals.team, headerBaseCurrency),
            color: "text-terracotta",
            sub: null,
          },
          {
            label: "Costo total",
            value: formatMoney(headerTotals.total, headerBaseCurrency),
            color: "text-foreground",
            sub: "variables × capacidad",
          },
        ].map((s) => (
          <Card key={s.label} className="border-border/40">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {s.label}
              </p>
              <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
              {s.sub && (
                <p className="text-[10px] text-muted-foreground mt-1">{s.sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>


      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Comprometido",
            value: formatUSD(finance.revenueCommitted),
            sub: `${finance.activeCount} activas${finance.cancelledCount > 0 ? ` · ${finance.cancelledCount} canc.` : ""}`,
          },
          {
            label: "Ingreso neto",
            value: formatUSD(finance.revenueNet),
            sub:
              finance.revenueFees > 0
                ? `Bruto ${formatUSD(finance.revenueCollected)} − comisión ${formatUSD(finance.revenueFees)} − dev. ${formatUSD(finance.revenueRefunded)}`
                : `Cobrado ${formatUSD(finance.revenueCollected)} − dev. ${formatUSD(finance.revenueRefunded)}`,
          },
          { label: "Costo total", value: formatUSD(finance.totalCostActual), sub: null },
          {
            label: "Utilidad real",
            value: formatUSD(finance.profitActual),
            sub: `${finance.marginActual.toFixed(1)}% margen`,
            alert: finance.profitActual < 0,
          },
          {
            label: "Punto de equilibrio",
            value: isFinite(finance.breakEven) ? `${finance.breakEven} personas` : "—",
            sub: finance.breakEvenReached
              ? "✓ Alcanzado"
              : isFinite(finance.breakEven)
                ? `Faltan ${finance.breakEven - finance.activeCount}`
                : "Precio < variable",
            alert: !finance.breakEvenReached,
          },
        ].map((kpi) => (
          <Card
            key={kpi.label}
            className={`border-border/40 ${kpi.alert ? "ring-1 ring-destructive/30" : ""}`}
          >
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {kpi.label}
              </p>
              <p
                className={`text-lg font-bold tabular-nums ${kpi.alert ? "text-destructive" : "text-foreground"}`}
              >
                {kpi.value}
              </p>
              {kpi.sub && (
                <p
                  className={`text-xs mt-0.5 ${kpi.alert ? "text-destructive/70" : "text-muted-foreground"}`}
                >
                  {kpi.sub}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Desglose de rentabilidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {finance.revenueActual > 0 && (
            <div className="h-4 w-full rounded-full overflow-hidden flex bg-secondary">
              <div
                className="bg-primary/70 h-full"
                style={{ width: `${(finance.totalFixed / finance.revenueActual) * 100}%` }}
                title="Costos fijos"
              />
              <div
                className="bg-chart-3/70 h-full"
                style={{ width: `${(finance.totalVariableActual / finance.revenueActual) * 100}%` }}
                title="Variables"
              />
              <div
                className="bg-terracotta/70 h-full"
                style={{ width: `${(finance.totalTeam / finance.revenueActual) * 100}%` }}
                title="Equipo"
              />
              {finance.profitActual > 0 && (
                <div
                  className="bg-chart-4/70 h-full"
                  style={{ width: `${(finance.profitActual / finance.revenueActual) * 100}%` }}
                  title="Utilidad"
                />
              )}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-primary/70" />
              <span className="text-muted-foreground">Fijos:</span>{" "}
              <span className="font-medium tabular-nums">{formatUSD(finance.totalFixed)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-chart-3/70" />
              <span className="text-muted-foreground">Variables:</span>{" "}
              <span className="font-medium tabular-nums">
                {formatUSD(finance.totalVariableActual)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-terracotta/70" />
              <span className="text-muted-foreground">Equipo:</span>{" "}
              <span className="font-medium tabular-nums">{formatUSD(finance.totalTeam)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-chart-4/70" />
              <span className="text-muted-foreground">Utilidad:</span>{" "}
              <span className="font-medium tabular-nums">{formatUSD(finance.profitActual)}</span>
            </div>
          </div>

          {/* Cobros */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bruto cobrado</span>
              <span className="font-semibold tabular-nums">{formatUSD(collected)}</span>
            </div>
            {finance.revenueFees > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Comisiones (Stripe)</span>
                  <span className="font-semibold tabular-nums text-chart-4">
                    −{formatUSD(finance.revenueFees)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground font-semibold">Neto recibido</span>
                  <span className="font-bold tabular-nums text-chart-3">
                    {formatUSD(finance.revenueCollectedNet)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Por cobrar</span>
              <span className="font-semibold tabular-nums text-chart-4">
                {formatUSD(finance.revenueActual - collected)}
              </span>
            </div>
          </div>

          {/* Projected */}
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Proyección a grupo completo ({trip.capacity} personas)
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ingreso proyectado</span>
              <span className="font-semibold tabular-nums">{formatUSD(finance.revenueMax)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Utilidad proyectada</span>
              <span className="font-semibold tabular-nums text-primary">
                {formatUSD(finance.profitMax)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No incluido — estimado que la viajera debe traer */}
      {finance.totalNotIncluded > 0 && (
        <Card className="border-dashed border-terracotta/40 bg-terracotta/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-terracotta" />
              No incluido en el paquete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-md bg-background/60 border border-border/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Estimado por viajera
                </p>
                <p className="text-2xl font-bold tabular-nums text-terracotta">
                  ~{formatUSD(finance.notIncludedPerPerson)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Dinero aproximado que cada viajera debería llevar para gastos personales
                </p>
              </div>
              <div className="rounded-md bg-background/60 border border-border/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Total no incluido (grupo)
                </p>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {formatUSD(finance.totalNotIncluded)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Suma de todos los ítems marcados como no incluidos en el itinerario
                </p>
              </div>
            </div>
            <div className="rounded-md border border-terracotta/20 bg-terracotta/[0.06] p-3 text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Auditoría:</span> estos costos se
              excluyen de la utilidad real y del punto de equilibrio. Se listan aparte porque los
              cubre cada viajera con su propio dinero, no la organización.
            </div>
          </CardContent>
        </Card>
      )}

      <ScenarioSimulator trip={trip} />
    </div>
  );
}

// ─── Simulador de escenarios ─────────────────────────────────
function ScenarioSimulator({ trip }: { trip: TripData }) {
  const [people, setPeople] = useState<number>(
    trip.enrolled > 0 ? trip.enrolled : Math.max(1, Math.min(trip.capacity, 8)),
  );

  // Usa la función centralizada de simulación
  const sim = useMemo(() => simulateScenario(trip, trip.costs, people), [trip, people]);
  const real = useMemo(() => calculateTripFinancials(trip, trip.costs), [trip]);
  const deltaVsReal = sim.profit - real.profitActual;

  const quickOptions = [6, 8, 10, trip.capacity].filter(
    (n, i, arr) => n > 0 && arr.indexOf(n) === i,
  );

  return (
    <Card className="border-dashed border-primary/30 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          Simulador de escenarios
          <Badge variant="secondary" className="text-[10px] font-normal ml-1">
            solo análisis · no modifica datos reales
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Personas a simular</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                min={0}
                value={people}
                onChange={(e) => setPeople(Math.max(0, parseInt(e.target.value || "0", 10)))}
                className="w-28 h-9"
              />
              <div className="flex flex-wrap gap-1.5">
                {quickOptions.map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={people === n ? "default" : "outline"}
                    className="h-8 px-2.5 text-xs"
                    onClick={() => setPeople(n)}
                  >
                    {n} {n === trip.capacity ? "(máx)" : ""}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={people === trip.enrolled ? "default" : "ghost"}
                  className="h-8 px-2.5 text-xs"
                  onClick={() => setPeople(trip.enrolled)}
                  title="Volver al valor real"
                >
                  Real ({trip.enrolled})
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiMini label="Ingresos" value={formatUSD(sim.revenue)} />
          <KpiMini label="Costo total" value={formatUSD(sim.totalCost)} />
          <KpiMini label="Costo / persona" value={formatUSD(sim.costPerPerson)} />
          <KpiMini
            label="Utilidad"
            value={formatUSD(sim.profit)}
            tone={sim.profit >= 0 ? "positive" : "negative"}
            sub={`${sim.margin.toFixed(1)}% margen`}
          />
          <KpiMini
            label="Punto equilibrio"
            value={isFinite(sim.breakEven) ? `${sim.breakEven} pers.` : "—"}
            tone={sim.breakEvenReached ? "positive" : "negative"}
            sub={
              sim.breakEvenReached
                ? "✓ Alcanzado"
                : isFinite(sim.breakEven)
                  ? `Faltan ${sim.breakEven - people}`
                  : "Precio < variable"
            }
          />
        </div>

        {people !== trip.enrolled && (
          <div className="text-xs text-muted-foreground border-t pt-3 flex items-center justify-between">
            <span>Diferencia vs escenario real ({trip.enrolled} personas)</span>
            <span
              className={`font-semibold tabular-nums ${deltaVsReal >= 0 ? "text-chart-3" : "text-destructive"}`}
            >
              {deltaVsReal >= 0 ? "+" : ""}
              {formatUSD(deltaVsReal)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiMini({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative";
}) {
  const valColor =
    tone === "positive"
      ? "text-chart-3"
      : tone === "negative"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-background p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-base font-bold tabular-nums ${valColor}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Sección "Requieren atención" ───────────────────────────
// Solo cuotas vencidas: pendientes cuya fecha estipulada de pago ya pasó.
function AttentionSection({
  overdue,
  onSelectEnrollee,
}: {
  overdue: { e: Enrollee; count: number; amount: number }[];
  onSelectEnrollee: (enrolleeId: string) => void;
}) {
  const total = overdue.length;


  const renderRow = (enrolleeId: string, name: string, detail: string) => (
    <li key={enrolleeId}>
      <button
        type="button"
        onClick={() => onSelectEnrollee(enrolleeId)}
        className="w-full flex items-center justify-between text-sm bg-background/50 hover:bg-background rounded-md px-3 py-1.5 border border-border/40 transition-colors text-left group"
      >
        <span className="font-medium truncate group-hover:text-primary transition-colors">
          {name}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap ml-2">
          {detail}
        </span>
      </button>
    </li>
  );

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <Accordion type="single" collapsible defaultValue="atencion">
        <AccordionItem value="atencion" className="border-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-2 text-left">
              <span className="text-base">🔔</span>
              <span className="font-semibold text-sm">Requieren atención</span>
              <Badge variant="destructive" className="text-[10px] h-5">
                {total}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 pt-0 space-y-4">
            {overdue.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-destructive flex items-center gap-1.5 mb-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Cuotas vencidas ({overdue.length})
                </p>
                <ul className="space-y-1">
                  {overdue.map(({ e, count, amount }) =>
                    renderRow(
                      e.id,
                      e.name,
                      `${count} ${count === 1 ? "cuota" : "cuotas"} · ${formatUSD(amount)}`,
                    ),
                  )}
                </ul>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

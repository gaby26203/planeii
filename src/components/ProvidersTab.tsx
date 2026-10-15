import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  Building2,
  Bus,
  MapPin,
  UtensilsCrossed,
  Ticket,
  Package as PackageIcon,
  Link2,
  Link2Off,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  CostItem,
  Provider,
  ProviderCategory,
  ProviderStatus,
  TripData,
} from "@/lib/finance-types";
import {
  costBaseAmount,
  formatMoney,
  getTripBaseCurrency,
  getProviderLinkedCostIds,
} from "@/lib/finance-types";
import { Checkbox } from "@/components/ui/checkbox";
import { useTripsStore } from "@/lib/trips-store";
import { usePermissions } from "@/lib/access";

const CATEGORY_META: Record<
  ProviderCategory,
  { label: string; icon: typeof Building2; color: string }
> = {
  alojamiento: { label: "Alojamiento", icon: Building2, color: "bg-primary/10 text-primary" },
  transporte: { label: "Transporte", icon: Bus, color: "bg-secondary text-secondary-foreground" },
  guia: { label: "Guía", icon: MapPin, color: "bg-terracotta/15 text-terracotta" },
  actividad: { label: "Actividad", icon: Ticket, color: "bg-primary/10 text-primary" },
  comida: { label: "Comida", icon: UtensilsCrossed, color: "bg-secondary text-secondary-foreground" },
  otro: { label: "Otro", icon: PackageIcon, color: "bg-muted text-muted-foreground" },
};

const STATUS_META: Record<ProviderStatus, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-muted text-muted-foreground" },
  contactado: { label: "Contactado", className: "bg-primary/15 text-primary" },
  confirmado: { label: "Confirmado", className: "bg-terracotta/15 text-terracotta" },
  pagado: { label: "Pagado", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
};

const STATUS_ORDER: ProviderStatus[] = ["pendiente", "contactado", "confirmado", "pagado"];

interface Props {
  tripId: string;
  providers: Provider[] | undefined;
  costs: CostItem[];
  trip: TripData;
}

export function ProvidersTab({ tripId, providers, costs, trip }: Props) {
  const baseCurrency = getTripBaseCurrency(trip);
  const list = providers ?? [];
  const { canEditProveedores } = usePermissions(tripId);
  const addProvider = useTripsStore((s) => s.addProvider);
  const updateProvider = useTripsStore((s) => s.updateProvider);
  const removeProvider = useTripsStore((s) => s.removeProvider);
  const setProviderStatus = useTripsStore((s) => s.setProviderStatus);

  const [filter, setFilter] = useState<ProviderStatus | "todos">("todos");
  const [editing, setEditing] = useState<Provider | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Provider | null>(null);

  const filtered = useMemo(
    () => (filter === "todos" ? list : list.filter((p) => p.status === filter)),
    [list, filter],
  );

  const counts = useMemo(() => {
    const c: Record<ProviderStatus, number> = {
      pendiente: 0,
      contactado: 0,
      confirmado: 0,
      pagado: 0,
    };
    for (const p of list) c[p.status]++;
    return c;
  }, [list]);

  // Cantidad de viajeras para la vista de proveedores: si el viaje está
  // "cerrado" y hay inscriptas reales, usamos ese número; de lo contrario
  // se proyecta sobre la capacidad (planificación). Los proveedores suelen
  // cobrar por grupo, así que este divisor rige los totales grupales.
  const travelers = useMemo(() => {
    const enrolled = (trip.enrollees ?? []).filter((e) => e.status !== "cancelada").length || trip.enrolled || 0;
    if (trip.status === "cerrado" && enrolled > 0) return enrolled;
    return trip.capacity || enrolled || 1;
  }, [trip.status, trip.capacity, trip.enrolled, trip.enrollees]);

  // Calcula, para un proveedor, la lista de costos vinculados y sus totales
  // en moneda base: `perGroup` (lo que se le paga al proveedor por todo el
  // grupo) y `perPerson` (prorrateo por viajera).
  const computeProviderTotals = (p: Provider) => {
    const ids = getProviderLinkedCostIds(p);
    const linked = ids
      .map((id) => costs.find((c) => c.id === id))
      .filter((c): c is CostItem => !!c);
    let perGroup = 0;
    for (const c of linked) {
      const base = costBaseAmount(c, trip);
      perGroup += c.perPerson ? base * travelers : base;
    }
    const perPerson = travelers > 0 ? perGroup / travelers : perGroup;
    return { linked, perGroup, perPerson };
  };

  const committedUSD = useMemo(() => {
    let total = 0;
    for (const p of list) total += computeProviderTotals(p).perGroup;
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, costs, trip, travelers]);

  const readOnlyMsg = "No tenés permiso para editar proveedores.";

  return (
    <Card className="mt-4">
      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              <strong className="text-foreground">{counts.confirmado}</strong> confirmados
            </span>
            <span className="text-muted-foreground">
              · <strong className="text-foreground">{counts.contactado}</strong> contactados
            </span>
            <span className="text-muted-foreground">
              · <strong className="text-foreground">{counts.pendiente}</strong> pendientes
            </span>
            <span className="text-muted-foreground">
              · <strong className="text-foreground">{counts.pagado}</strong> pagados
            </span>
            {committedUSD > 0 && (
              <span className="text-muted-foreground">
                · <strong className="text-foreground">{formatMoney(committedUSD, baseCurrency)}</strong> comprometido
              </span>
            )}
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as ProviderStatus | "todos")}>
              <SelectTrigger className="h-8 flex-1 sm:w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => {
                if (!canEditProveedores) return toast.error(readOnlyMsg);
                setCreating(true);
              }}
              disabled={!canEditProveedores}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />{" "}
              <span className="whitespace-nowrap">Agregar proveedor</span>
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            {list.length === 0
              ? "Todavía no hay proveedores registrados."
              : "No hay proveedores con este filtro."}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <Table className="min-w-[560px] md:min-w-0">
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha servicio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden lg:table-cell">Contacto</TableHead>
                  <TableHead className="hidden md:table-cell">Servicios vinculados</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Total grupo</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Por persona</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const catMeta = CATEGORY_META[p.category];
                  const CatIcon = catMeta.icon;
                  const { linked, perGroup, perPerson } = computeProviderTotals(p);
                  return (
                    <TableRow key={p.id}>

                      <TableCell>
                        <div className="font-medium text-sm">{p.name}</div>
                        {p.reservationCode && (
                          <div className="text-[11px] text-muted-foreground">
                            Ref: {p.reservationCode}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${catMeta.color}`}>
                          <CatIcon className="h-3 w-3" /> {catMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {p.serviceDate ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={p.status}
                          onValueChange={(v) => {
                            if (!canEditProveedores) return toast.error(readOnlyMsg);
                            setProviderStatus(tripId, p.id, v as ProviderStatus);
                          }}
                          disabled={!canEditProveedores}
                        >
                          <SelectTrigger
                            className={`h-7 px-2 text-xs border-0 ${STATUS_META[p.status].className}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_ORDER.map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_META[s].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">
                        {p.contactName && <div>{p.contactName}</div>}
                        {p.contactPhone && (
                          <div className="text-muted-foreground">{p.contactPhone}</div>
                        )}
                        {p.contactEmail && (
                          <div className="text-muted-foreground">{p.contactEmail}</div>
                        )}
                        {!p.contactName && !p.contactPhone && !p.contactEmail && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        {linked.length === 0 ? (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Link2Off className="h-3 w-3" /> Sin costos
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            {linked.map((c) => (
                              <div key={c.id} className="flex items-center gap-1 text-primary">
                                <Link2 className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[180px]" title={c.description}>
                                  {c.description}
                                </span>
                                <span className="text-muted-foreground shrink-0">
                                  · {formatMoney(costBaseAmount(c, trip) * (c.perPerson ? travelers : 1), baseCurrency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-right">
                        {linked.length > 0 ? (
                          <span className="font-medium">{formatMoney(perGroup, baseCurrency)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-right">
                        {linked.length > 0 ? (
                          <span className="text-muted-foreground">
                            {formatMoney(perPerson, baseCurrency)} <span className="text-[10px]">/ pers</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              if (!canEditProveedores) return toast.error(readOnlyMsg);
                              setEditing(p);
                            }}
                            disabled={!canEditProveedores}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (!canEditProveedores) return toast.error(readOnlyMsg);
                              setConfirmDelete(p);
                            }}
                            disabled={!canEditProveedores}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {(creating || editing) && (
        <ProviderDialog
          open
          initial={editing}
          costs={costs}
          trip={trip}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(values) => {
            if (editing) {
              updateProvider(tripId, editing.id, values);
              toast.success("Proveedor actualizado");
            } else {
              addProvider(tripId, values);
              toast.success("Proveedor agregado");
            }
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proveedor</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar a <strong>{confirmDelete?.name}</strong>? El costo vinculado (si hay) se
              mantiene intacto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) {
                  removeProvider(tripId, confirmDelete.id);
                  toast.success("Proveedor eliminado");
                }
                setConfirmDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Dialog ──────────────────────────────────────────────────
interface DialogProps {
  open: boolean;
  initial: Provider | null;
  costs: CostItem[];
  trip: TripData;
  onClose: () => void;
  onSave: (values: Omit<Provider, "id" | "createdAt">) => void;
}

function ProviderDialog({ open, initial, costs, trip, onClose, onSave }: DialogProps) {
  const baseCurrency = getTripBaseCurrency(trip);
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<ProviderCategory>(initial?.category ?? "alojamiento");
  const [status, setStatus] = useState<ProviderStatus>(initial?.status ?? "pendiente");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [reservationCode, setReservationCode] = useState(initial?.reservationCode ?? "");
  const [serviceDate, setServiceDate] = useState(initial?.serviceDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [linkedCostIds, setLinkedCostIds] = useState<string[]>(
    initial ? getProviderLinkedCostIds(initial) : [],
  );
  const toggleCost = (id: string, on: boolean) =>
    setLinkedCostIds((prev) => (on ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    onSave({
      name: name.trim(),
      category,
      status,
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      reservationCode: reservationCode.trim() || undefined,
      serviceDate: serviceDate || undefined,
      notes: notes.trim() || undefined,
      linkedCostIds,
      linkedCostId: linkedCostIds[0] ?? null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="prov-name">Nombre</Label>
            <Input
              id="prov-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Hotel Riad Yasmine"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoría</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ProviderCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_META) as ProviderCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_META[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProviderStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prov-service-date">Fecha de servicio</Label>
              <Input
                id="prov-service-date"
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="prov-code">Reserva / voucher</Label>
              <Input
                id="prov-code"
                value={reservationCode}
                onChange={(e) => setReservationCode(e.target.value)}
                placeholder="Nº o código"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="prov-contact">Persona de contacto</Label>
            <Input
              id="prov-contact"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Nombre"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prov-phone">Teléfono</Label>
              <Input
                id="prov-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+52..."
              />
            </div>
            <div>
              <Label htmlFor="prov-email">Email</Label>
              <Input
                id="prov-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contacto@..."
              />
            </div>
          </div>

          <div>
            <Label>Costos vinculados</Label>
            {costs.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                Todavía no hay costos en este viaje.
              </p>
            ) : (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border p-2 space-y-1">
                {costs.map((c) => {
                  const checked = linkedCostIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-start gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-1"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleCost(c.id, v === true)}
                        className="mt-0.5"
                      />
                      <span className="flex-1">
                        <span className="font-medium">{c.description || "(sin descripción)"}</span>
                        <span className="text-muted-foreground">
                          {" "}— {formatMoney(costBaseAmount(c, trip), baseCurrency)}
                          {c.perPerson ? " / pers" : ""}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Podés vincular varios servicios de un mismo proveedor (ej. Mestizaje = 3 tours). Los
              montos siguen viviendo en Costos; acá sólo se referencian.
            </p>
          </div>


          <div>
            <Label htmlFor="prov-notes">Notas</Label>
            <Textarea
              id="prov-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Detalles, requisitos, links, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {initial ? "Guardar cambios" : "Agregar proveedor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

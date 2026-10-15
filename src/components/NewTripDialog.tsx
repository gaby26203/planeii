// Diálogo wizard para crear un viaje y opcionalmente invitar a una organizadora.
// Paso 1: datos básicos del viaje → llama a createTrip del store.
// Paso 2: invitación opcional → crea invitación y muestra link para copiar.

import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Loader2, Plus, ArrowRight, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { useTripsStore } from "@/lib/trips-store";
import { generateId, CURRENCIES, EXCHANGE_RATES, suggestLocalCurrency, type Currency } from "@/lib/finance-types";
import type { TripData } from "@/lib/finance-types";
import { createTripInvitation } from "@/lib/trip-invitations.functions";
import { getAccountDefaults } from "@/lib/account-defaults.functions";
import { FACTORY_DEFAULTS } from "@/lib/factory-defaults";
import { createDialogShortcuts } from "@/hooks/use-submit-on-enter";
import {
  defaultsForRole,
  PERM_LABELS,
  PERM_KEYS,
  type TripPermMap,
} from "@/lib/trip-permissions";
import { TripCoverPicker } from "@/components/TripCoverPicker";


const GRADIENTS = [
  "from-[oklch(0.55_0.14_35)] to-[oklch(0.45_0.10_25)]",
  "from-[oklch(0.50_0.08_150)] to-[oklch(0.40_0.06_160)]",
  "from-[oklch(0.65_0.12_75)] to-[oklch(0.50_0.10_60)]",
  "from-[oklch(0.55_0.12_290)] to-[oklch(0.40_0.10_280)]",
  "from-[oklch(0.60_0.14_15)] to-[oklch(0.45_0.10_10)]",
];

interface Props {
  trigger?: React.ReactNode;
}

export function NewTripDialog({ trigger }: Props) {
  const navigate = useNavigate();
  const createTrip = useTripsStore((s) => s.createTrip);
  const createInvite = useServerFn(createTripInvitation);
  const loadDefaults = useServerFn(getAccountDefaults);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);

  // Paso 1
  const [name, setName] = useState("");
  const [isMulti, setIsMulti] = useState(false);
  const [destination, setDestination] = useState("");
  const [destinationsList, setDestinationsList] = useState<string[]>([""]);
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currency, setCurrency] = useState<TripData["currency"]>("USD");
  const [localCurrency, setLocalCurrency] = useState<string>("none");
  const [localCurrencyTouched, setLocalCurrencyTouched] = useState(false);
  const [capacity, setCapacity] = useState<number>(10);
  const [pricePerPerson, setPricePerPerson] = useState<number>(0);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  // ID pre-generado para que TripCoverPicker pueda subir al bucket antes de crear el viaje.
  const [pendingTripId] = useState(() => generateId());


  const [createdTripId, setCreatedTripId] = useState<string | null>(null);

  // Paso 2
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"organizadora" | "tour_leader">("organizadora");
  const [perms, setPerms] = useState<TripPermMap>(defaultsForRole("organizadora"));
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  // Sugerencia automática de moneda local desde país/destino. Solo mientras
  // la organizadora no la haya tocado manualmente.
  useEffect(() => {
    if (localCurrencyTouched) return;
    const suggested = suggestLocalCurrency(
      country,
      isMulti ? destinationsList.join(" ") : destination,
    );
    if (suggested) setLocalCurrency(suggested);
  }, [country, destination, destinationsList, isMulti, localCurrencyTouched]);


  function reset() {
    setStep(1);
    setName("");
    setIsMulti(false);
    setDestination("");
    setDestinationsList([""]);
    setCountry("");
    setStartDate("");
    setEndDate("");
    setCurrency("USD");
    setLocalCurrency("none");
    setLocalCurrencyTouched(false);
    setCapacity(10);
    setPricePerPerson(0);
    setCoverImage(null);

    setCreatedTripId(null);
    setEmail("");
    setRole("organizadora");
    setPerms(defaultsForRole("organizadora"));
    setInviteLink(null);
    setSaving(false);
  }

  function handleOpenChange(next: boolean) {
    if (saving) return;
    setOpen(next);
    if (!next) setTimeout(reset, 200);
  }

  async function handleCreateTrip() {
    const cleanDestinations = destinationsList.map((d) => d.trim()).filter(Boolean);
    const destinationSummary = isMulti
      ? cleanDestinations.join(" · ")
      : destination.trim();

    if (!name.trim() || !destinationSummary) {
      toast.error("Completá nombre y destino.");
      return;
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      toast.error("La fecha de fin no puede ser anterior al inicio.");
      return;
    }
    setSaving(true);
    // Cargar plantillas (fallback silencioso a defaults de fábrica).
    let refundRules = FACTORY_DEFAULTS.refundRules;
    let costPresets = FACTORY_DEFAULTS.costPresets;
    try {
      const d = await loadDefaults();
      if (d?.refundRules?.length) refundRules = d.refundRules;
      if (d?.costPresets?.length) costPresets = d.costPresets;
    } catch {
      /* usar fábrica */
    }
    const id = pendingTripId;
    const now = Date.now();
    const seededCosts = costPresets.map((p, i) => ({
      id: generateId(),
      description: p.description,
      notes: p.notes ?? "",
      category: p.category,
      amount: p.defaultAmount ?? 0,
      currency: currency as any,
      amountUSD: 0,
      perPerson: false,
      itineraryDay: null,
      createdAt: now + i,
    }));
    // Multimoneda: baseCurrency = currency; localCurrency opcional; tasa
    // inicial sugerida desde la tabla estática (edición fina en el chip
    // del header del viaje).
    const baseCur = currency as Currency;
    const localCur = localCurrency === "none" ? undefined : (localCurrency as Currency);
    const inferredRate =
      localCur && baseCur
        ? Math.round(((EXCHANGE_RATES[localCur] ?? 1) / (EXCHANGE_RATES[baseCur] ?? 1)) * 1000000) /
          1000000
        : undefined;
    const trip: TripData = {
      id,
      name: name.trim(),
      destination: destinationSummary,
      country: country.trim() || undefined,
      isMultiDestination: isMulti || undefined,
      destinations: isMulti ? cleanDestinations : undefined,
      startDate,
      endDate,
      status: "planificando",
      capacity: Math.max(1, capacity),
      enrolled: 0,
      pricePerPerson: Math.max(0, pricePerPerson),
      currency,
      baseCurrency: baseCur,
      localCurrency: localCur,
      exchangeRate: inferredRate,
      exchangeRateUpdatedAt: inferredRate != null ? new Date().toISOString() : undefined,
      coverGradient: GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)],
      coverImage: coverImage ?? null,

      itinerary: [],
      costs: seededCosts,
      enrollees: [],
      refundRules: refundRules.map((r) => ({ ...r })),
      providers: [],
    };
    try {
      await createTrip(trip);
      setCreatedTripId(id);
      setStep(2);
      toast.success("Viaje creado");
    } catch (e: any) {
      const raw = String(e?.message ?? e ?? "");
      let title = "No se pudo crear el viaje";
      let description = raw || "Ocurrió un error inesperado. Volvé a intentarlo.";
      if (/uuid|invalid input syntax/i.test(raw)) {
        title = "Datos inválidos";
        description = "Alguno de los campos tiene un formato incorrecto. Revisá fechas y valores numéricos.";
      } else if (/unauthorized|jwt|auth/i.test(raw)) {
        title = "Sesión expirada";
        description = "Volvé a iniciar sesión y probá de nuevo.";
      } else if (/network|fetch|failed to fetch|timeout/i.test(raw)) {
        title = "Sin conexión con el servidor";
        description = "Revisá tu conexión a internet y reintentá en unos segundos.";
      } else if (/duplicate|already exists|unique/i.test(raw)) {
        title = "Viaje duplicado";
        description = "Ya existe un viaje con esos datos. Cambiá el nombre o el destino.";
      } else if (/zod|validation|expected|required/i.test(raw)) {
        title = "Datos incompletos";
        description = "Faltan campos obligatorios o hay valores fuera de rango. Revisá el formulario.";
      } else if (/permission|rls|policy/i.test(raw)) {
        title = "Sin permisos";
        description = "Tu cuenta no tiene permisos para crear viajes. Contactá al owner.";
      } else if (/database|postgres|pg |db /i.test(raw)) {
        title = "Error de base de datos";
      }
      toast.error(title, { description });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateInvite() {
    if (!createdTripId) return;
    if (!email.trim() || !/.+@.+\..+/.test(email)) {
      toast.error("Ingresá un email válido.");
      return;
    }
    setSaving(true);
    try {
      const res: any = await createInvite({
        data: {
          tripId: createdTripId,
          email: email.trim(),
          role,
          permissions: perms,
        },
      });
      const url = `${window.location.origin}/invitacion/${res.token}`;
      setInviteLink(url);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Invitación creada y link copiado");
      } catch {
        toast.success("Invitación creada");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear la invitación");
    } finally {
      setSaving(false);
    }
  }

  function goToTrip() {
    if (!createdTripId) return;
    setOpen(false);
    setTimeout(() => {
      navigate({ to: "/viajes/$tripId", params: { tripId: createdTripId } });
      reset();
    }, 100);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2 shadow-md shadow-primary/10">
            <Plus className="h-4 w-4" />
            Nuevo viaje
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        onKeyDown={createDialogShortcuts({
          onSubmit: () => {
            if (step === 1) handleCreateTrip();
            else if (step === 2 && !inviteLink) handleCreateInvite();
            else if (step === 2 && inviteLink) goToTrip();
          },
          onCancel: () => handleOpenChange(false),
          canSubmit: !saving,
        })}
      >
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Nuevo viaje" : "Invitar organizadora"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Datos básicos para arrancar. Podés completar el resto después."
              : "Opcional. Si preferís, saltalo y hacelo más tarde desde el viaje."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="trip-name">Nombre del viaje *</Label>
              <Input
                id="trip-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Marruecos Esencial"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="trip-dest">Destino *</Label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={isMulti}
                    onCheckedChange={(v) => setIsMulti(Boolean(v))}
                  />
                  Multi-destino
                </label>
              </div>
              {!isMulti ? (
                <Input
                  id="trip-dest"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Marrakech"
                />
              ) : (
                <div className="space-y-2">
                  {destinationsList.map((d, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={d}
                        onChange={(e) => {
                          const next = [...destinationsList];
                          next[i] = e.target.value;
                          setDestinationsList(next);
                        }}
                        placeholder={`Destino ${i + 1}`}
                      />
                      {destinationsList.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={() =>
                            setDestinationsList(destinationsList.filter((_, j) => j !== i))
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setDestinationsList([...destinationsList, ""])}
                    className="gap-2"
                  >
                    <Plus className="h-3 w-3" />
                    Añadir destino
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="trip-country">País</Label>
              <Input
                id="trip-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Marruecos"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="trip-start">Inicio (opcional)</Label>
                <Input
                  id="trip-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trip-end">Fin (opcional)</Label>
                <Input
                  id="trip-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="trip-cur">Moneda base</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
                  <SelectTrigger id="trip-cur"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trip-local">
                  Moneda local
                  {!localCurrencyTouched && localCurrency !== "none" && (
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">(sugerida)</span>
                  )}
                </Label>
                <Select
                  value={localCurrency}
                  onValueChange={(v) => {
                    setLocalCurrency(v);
                    setLocalCurrencyTouched(true);
                  }}
                >
                  <SelectTrigger id="trip-local"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— sin moneda local —</SelectItem>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">

              <div className="space-y-2">
                <Label htmlFor="trip-cap">Cupos</Label>
                <Input
                  id="trip-cap"
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trip-price">Precio/persona</Label>
                <Input
                  id="trip-price"
                  type="number"
                  min={0}
                  value={pricePerPerson}
                  onChange={(e) => setPricePerPerson(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-2 pt-1">
              <Label>Foto de portada (opcional)</Label>
              <TripCoverPicker
                tripId={pendingTripId}
                value={coverImage}
                onChange={setCoverImage}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleCreateTrip} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Crear viaje
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            {!inviteLink ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="inv-email">Email de la organizadora</Label>
                  <Input
                    id="inv-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@ejemplo.com"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => {
                      const r = v as "organizadora" | "tour_leader";
                      setRole(r);
                      setPerms(defaultsForRole(r));
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organizadora">Organizadora</SelectItem>
                      <SelectItem value="tour_leader">Tour leader</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Permisos</Label>
                  <div className="grid grid-cols-1 gap-2 rounded-md border p-3 max-h-64 overflow-y-auto">
                    {PERM_KEYS.map((k) => (
                      <label key={k} className="flex items-start gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={perms[k]}
                          onCheckedChange={(v) => setPerms((p) => ({ ...p, [k]: Boolean(v) }))}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-medium">{PERM_LABELS[k].title}</div>
                          <div className="text-xs text-muted-foreground">{PERM_LABELS[k].desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <DialogFooter className="pt-2">
                  <Button variant="ghost" onClick={goToTrip} disabled={saving}>
                    Saltar
                  </Button>
                  <Button onClick={handleCreateInvite} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Crear invitación
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                  <p className="text-sm font-medium">Invitación lista para compartir</p>
                  <p className="text-xs text-muted-foreground">
                    Copiá este link y envialo por WhatsApp o email a{" "}
                    <span className="font-medium">{email}</span>. Expira en 7 días.
                  </p>
                  <div className="flex gap-2">
                    <Input readOnly value={inviteLink} className="text-xs" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteLink);
                          toast.success("Link copiado");
                        } catch {
                          toast.error("No se pudo copiar");
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={goToTrip} className="gap-2">
                    Ir al viaje
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

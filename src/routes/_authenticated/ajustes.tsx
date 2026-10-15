// Ajustes → Plantillas globales por usuario.
// Solo owners. 4 tabs: reembolsos, fees por método, presets de costos, presets de extras.
// Guarda en public.account_defaults; los cambios NO afectan viajes ya creados.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DisplayNameCard } from "@/components/DisplayNameCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


import {
  getAccountDefaults,
  saveAccountDefaults,
} from "@/lib/account-defaults.functions";
import {
  FACTORY_DEFAULTS,
  FACTORY_REFUND_RULES,
  FACTORY_PAYMENT_METHOD_FEES,
  FACTORY_COST_PRESETS,
  FACTORY_EXTRA_PRESETS,
  type AccountDefaults,
  type CostPreset,
  type ExtraPreset,
  type PaymentMethodFeeDefaults,
} from "@/lib/factory-defaults";
import {
  PAYMENT_METHOD_LABELS,
  methodSupportsFee,
  type PaymentMethod,
  type RefundRule,
  type CostCategory,
} from "@/lib/finance-types";


export const Route = createFileRoute("/_authenticated/ajustes")({
  component: SettingsPage,
});

const uid = () => `d_${Math.random().toString(36).slice(2, 10)}`;

const CATEGORY_LABELS: Record<CostCategory, string> = {
  fijo: "Fijo",
  variable: "Variable",
  equipo: "Equipo",
  no_incluido: "No incluido",
};

function SettingsPage() {
  
  const loadFn = useServerFn(getAccountDefaults);
  const saveFn = useServerFn(saveAccountDefaults);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defs, setDefs] = useState<AccountDefaults>(FACTORY_DEFAULTS);

  useEffect(() => {
    loadFn()
      .then((d) => setDefs(d))
      .catch((e: any) => toast.error(e?.message ?? "No se pudieron cargar los ajustes"))
      .finally(() => setLoading(false));
  }, [loadFn]);

  async function handleSave() {
    setSaving(true);
    try {
      await saveFn({ data: defs });
      toast.success("Plantillas guardadas");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }




  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando plantillas…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Plantillas</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Estos valores se clonan a cada viaje nuevo. Podés editarlos por viaje sin
            afectar la plantilla, y los cambios acá no modifican viajes ya creados.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar cambios
        </Button>
      </header>

      <DisplayNameCard />

      <Tabs defaultValue="refunds" className="space-y-4">
        <TabsList>
          <TabsTrigger value="refunds">Reembolsos</TabsTrigger>
          <TabsTrigger value="methods">Métodos de pago</TabsTrigger>
          <TabsTrigger value="costs">Costos</TabsTrigger>
          <TabsTrigger value="extras">Extras</TabsTrigger>
        </TabsList>

        <TabsContent value="refunds">
          <RefundsEditor
            rules={defs.refundRules}
            onChange={(refundRules) => setDefs((d) => ({ ...d, refundRules }))}
          />
        </TabsContent>

        <TabsContent value="methods">
          <PaymentFeesEditor
            fees={defs.paymentMethodFees}
            onChange={(paymentMethodFees) => setDefs((d) => ({ ...d, paymentMethodFees }))}
          />
        </TabsContent>

        <TabsContent value="costs">
          <CostPresetsEditor
            presets={defs.costPresets}
            onChange={(costPresets) => setDefs((d) => ({ ...d, costPresets }))}
          />
        </TabsContent>

        <TabsContent value="extras">
          <ExtraPresetsEditor
            presets={defs.extraPresets}
            onChange={(extraPresets) => setDefs((d) => ({ ...d, extraPresets }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionShell({
  title,
  description,
  onAdd,
  onReset,
  children,
}: {
  title: string;
  description: string;
  onAdd: () => void;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-lg">{title}</h2>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Fábrica
          </Button>
          <Button size="sm" onClick={onAdd} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function RefundsEditor({
  rules,
  onChange,
}: {
  rules: RefundRule[];
  onChange: (r: RefundRule[]) => void;
}) {
  const update = (id: string, patch: Partial<RefundRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => onChange(rules.filter((r) => r.id !== id));

  return (
    <SectionShell
      title="Reglas de reembolso"
      description="Aplican cuando una viajera cancela. Se ordenan por días antes del viaje."
      onAdd={() => onChange([...rules, { id: uid(), daysBefore: 0, percent: 0, notes: "" }])}
      onReset={() => onChange(FACTORY_REFUND_RULES.map((r) => ({ ...r, id: uid() })))}
    >
      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sin reglas configuradas.</p>
      )}
      {rules.map((r) => (
        <div key={r.id} className="grid grid-cols-12 gap-2 items-end rounded-md border p-3">
          <div className="col-span-3 space-y-1">
            <Label className="text-xs">Días antes</Label>
            <Input
              type="number"
              min={0}
              value={r.daysBefore}
              onChange={(e) => update(r.id, { daysBefore: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">% Reembolso</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={r.percent}
              onChange={(e) => update(r.id, { percent: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="col-span-6 space-y-1">
            <Label className="text-xs">Notas</Label>
            <Input
              value={r.notes ?? ""}
              onChange={(e) => update(r.id, { notes: e.target.value })}
              placeholder="Descripción visible en el viaje"
            />
          </div>
          <div className="col-span-1 flex justify-end">
            <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </SectionShell>
  );
}

function PaymentFeesEditor({
  fees,
  onChange,
}: {
  fees: PaymentMethodFeeDefaults;
  onChange: (f: PaymentMethodFeeDefaults) => void;
}) {
  const methods: PaymentMethod[] = ["transferencia", "efectivo", "tarjeta", "stripe", "otro"];

  return (
    <section className="rounded-lg border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-lg">Comisiones por método de pago</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Se prellenan al registrar un abono. Solo Stripe y "Otro" (pasarelas
            digitales) soportan comisión.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(FACTORY_PAYMENT_METHOD_FEES)}
          className="gap-1.5 shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Fábrica
        </Button>
      </div>

      <div className="space-y-3">
        {methods.map((m) => {
          const supports = methodSupportsFee(m);
          const f = fees[m] ?? { feePercent: 0, feeFixed: 0, feeDescription: "" };
          return (
            <div key={m} className="grid grid-cols-12 gap-2 items-end rounded-md border p-3">
              <div className="col-span-3">
                <p className="font-medium">{PAYMENT_METHOD_LABELS[m]}</p>
                {!supports && (
                  <p className="text-[10px] text-muted-foreground">Sin comisión</p>
                )}
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">% Fee</Label>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!supports}
                  value={f.feePercent}
                  onChange={(e) =>
                    onChange({ ...fees, [m]: { ...f, feePercent: Number(e.target.value) || 0 } })
                  }
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Fee fijo (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  disabled={!supports}
                  value={f.feeFixed}
                  onChange={(e) =>
                    onChange({ ...fees, [m]: { ...f, feeFixed: Number(e.target.value) || 0 } })
                  }
                />
              </div>
              <div className="col-span-5 space-y-1">
                <Label className="text-xs">Descripción</Label>
                <Input
                  disabled={!supports}
                  value={f.feeDescription}
                  onChange={(e) =>
                    onChange({ ...fees, [m]: { ...f, feeDescription: e.target.value } })
                  }
                  placeholder="Ej: Stripe internacional"
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CostPresetsEditor({
  presets,
  onChange,
}: {
  presets: CostPreset[];
  onChange: (p: CostPreset[]) => void;
}) {
  const update = (id: string, patch: Partial<CostPreset>) =>
    onChange(presets.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id: string) => onChange(presets.filter((p) => p.id !== id));

  return (
    <SectionShell
      title="Presets de costos"
      description="Atajos rápidos al cargar costos del viaje. Podrás elegirlos desde el formulario de costos."
      onAdd={() =>
        onChange([
          ...presets,
          { id: uid(), description: "", category: "fijo", notes: "" },
        ])
      }
      onReset={() => onChange(FACTORY_COST_PRESETS.map((p) => ({ ...p, id: uid() })))}
    >
      {presets.map((p) => (
        <div key={p.id} className="grid grid-cols-12 gap-2 items-end rounded-md border p-3">
          <div className="col-span-4 space-y-1">
            <Label className="text-xs">Descripción</Label>
            <Input
              value={p.description}
              onChange={(e) => update(p.id, { description: e.target.value })}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Categoría</Label>
            <Select
              value={p.category}
              onValueChange={(v) => update(p.id, { category: v as CostCategory })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as CostCategory[]).map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-5 space-y-1">
            <Label className="text-xs">Notas</Label>
            <Input
              value={p.notes}
              onChange={(e) => update(p.id, { notes: e.target.value })}
            />
          </div>
          <div className="col-span-1 flex justify-end">
            <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </SectionShell>
  );
}

function ExtraPresetsEditor({
  presets,
  onChange,
}: {
  presets: ExtraPreset[];
  onChange: (p: ExtraPreset[]) => void;
}) {
  const update = (id: string, patch: Partial<ExtraPreset>) =>
    onChange(presets.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id: string) => onChange(presets.filter((p) => p.id !== id));

  return (
    <SectionShell
      title="Presets de extras"
      description="Atajos para servicios adicionales (tours, upgrades). Se ofrecen al crear un extra en el viaje."
      onAdd={() => onChange([...presets, { id: uid(), name: "", notes: "" }])}
      onReset={() => onChange(FACTORY_EXTRA_PRESETS.map((p) => ({ ...p, id: uid() })))}
    >
      {presets.map((p) => (
        <div key={p.id} className="grid grid-cols-12 gap-2 items-end rounded-md border p-3">
          <div className="col-span-4 space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Precio sugerido</Label>
            <Input
              type="number"
              min={0}
              value={p.suggestedPrice ?? ""}
              onChange={(e) =>
                update(p.id, {
                  suggestedPrice: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Costo sugerido</Label>
            <Input
              type="number"
              min={0}
              value={p.suggestedCost ?? ""}
              onChange={(e) =>
                update(p.id, {
                  suggestedCost: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="col-span-3 space-y-1">
            <Label className="text-xs">Notas</Label>
            <Input
              value={p.notes ?? ""}
              onChange={(e) => update(p.id, { notes: e.target.value })}
            />
          </div>
          <div className="col-span-1 flex justify-end">
            <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </SectionShell>
  );
}

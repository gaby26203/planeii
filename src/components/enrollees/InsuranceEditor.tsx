// Diálogo de edición del seguro de viaje de una viajera.

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createDialogShortcuts } from "@/hooks/use-submit-on-enter";
import { insuranceState } from "@/lib/enrollee-logistics";
import type { InsuranceInfo } from "@/lib/finance-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrolleeName: string;
  value: InsuranceInfo | undefined;
  tripStart?: string | null;
  tripEnd?: string | null;
  onSave: (next: InsuranceInfo) => void;
}

export function InsuranceEditor({
  open,
  onOpenChange,
  enrolleeName,
  value,
  tripStart,
  tripEnd,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<InsuranceInfo>(value ?? { hasInsurance: false });

  useEffect(() => {
    if (open) setDraft(value ?? { hasInsurance: false });
  }, [open, value]);

  const state = insuranceState(draft, tripStart, tripEnd);

  const submit = () => {
    onSave({
      hasInsurance: !!draft.hasInsurance,
      provider: draft.provider?.trim() || undefined,
      policyNumber: draft.policyNumber?.trim() || undefined,
      validFrom: draft.validFrom || undefined,
      validTo: draft.validTo || undefined,
      notes: draft.notes?.trim() || undefined,
    });
    onOpenChange(false);
  };

  const shortcuts = createDialogShortcuts({
    onSubmit: submit,
    onCancel: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onKeyDown={shortcuts}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Seguro de viaje
          </DialogTitle>
          <DialogDescription>{enrolleeName}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
          <Label htmlFor="has-insurance" className="text-sm">
            Tiene seguro contratado
          </Label>
          <Switch
            id="has-insurance"
            checked={!!draft.hasInsurance}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, hasInsurance: v }))}
          />
        </div>

        {draft.hasInsurance && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Aseguradora</Label>
              <Input
                value={draft.provider ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value }))}
                placeholder="Assist Card"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">N° de póliza</Label>
              <Input
                value={draft.policyNumber ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, policyNumber: e.target.value }))}
                placeholder="AC-993214"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Vigencia desde</Label>
              <Input
                type="date"
                value={draft.validFrom ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, validFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Vigencia hasta</Label>
              <Input
                type="date"
                value={draft.validTo ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, validTo: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notas</Label>
              <Textarea
                value={draft.notes ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                rows={2}
                placeholder="Cobertura, teléfono de asistencia..."
              />
            </div>
          </div>
        )}

        {state === "cobertura_incompleta" && (
          <p className="rounded-md bg-secondary/70 px-3 py-2 text-xs text-muted-foreground">
            La vigencia no cubre todas las fechas del viaje.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

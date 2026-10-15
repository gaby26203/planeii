// Diálogo de edición de un tramo aéreo (ida o vuelta) de una viajera.
// Enter guarda, Esc cancela y restaura el valor original.

import { useEffect, useState } from "react";
import { Plane } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createDialogShortcuts } from "@/hooks/use-submit-on-enter";
import { flightDateWarning } from "@/lib/enrollee-logistics";
import type { FlightSegment } from "@/lib/finance-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leg: "outbound" | "inbound";
  enrolleeName: string;
  value: FlightSegment | undefined;
  tripStart?: string | null;
  tripEnd?: string | null;
  onSave: (next: FlightSegment) => void;
}

const EMPTY: FlightSegment = {};

export function FlightSegmentEditor({
  open,
  onOpenChange,
  leg,
  enrolleeName,
  value,
  tripStart,
  tripEnd,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<FlightSegment>(value ?? EMPTY);

  useEffect(() => {
    if (open) setDraft(value ?? EMPTY);
  }, [open, value]);

  const set = (k: keyof FlightSegment) => (v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const warning = flightDateWarning(draft, leg, tripStart, tripEnd);

  const submit = () => {
    const cleaned: FlightSegment = {};
    (Object.keys(draft) as (keyof FlightSegment)[]).forEach((k) => {
      const v = draft[k];
      if (typeof v === "string" && v.trim() !== "") cleaned[k] = v.trim();
    });
    onSave(cleaned);
    onOpenChange(false);
  };

  const shortcuts = createDialogShortcuts({
    onSubmit: submit,
    onCancel: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" onKeyDown={shortcuts}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-primary" />
            {leg === "outbound" ? "Vuelo de ida" : "Vuelo de vuelta"}
          </DialogTitle>
          <DialogDescription>{enrolleeName}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Aerolínea">
            <Input
              value={draft.airline ?? ""}
              onChange={(e) => set("airline")(e.target.value)}
              placeholder="Aeroméxico"
              autoFocus
            />
          </Field>
          <Field label="N° de vuelo">
            <Input
              value={draft.flightNumber ?? ""}
              onChange={(e) => set("flightNumber")(e.target.value)}
              placeholder="AM 404"
            />
          </Field>
          <Field label="Código de reserva">
            <Input
              value={draft.bookingCode ?? ""}
              onChange={(e) => set("bookingCode")(e.target.value)}
              placeholder="XR4T9K"
            />
          </Field>
          <Field label="Terminal">
            <Input
              value={draft.terminal ?? ""}
              onChange={(e) => set("terminal")(e.target.value)}
              placeholder="T2"
            />
          </Field>
          <Field label="Aeropuerto de salida">
            <Input
              value={draft.fromAirport ?? ""}
              onChange={(e) => set("fromAirport")(e.target.value)}
              placeholder="MEX"
            />
          </Field>
          <Field label="Aeropuerto de llegada">
            <Input
              value={draft.toAirport ?? ""}
              onChange={(e) => set("toAirport")(e.target.value)}
              placeholder="OAX"
            />
          </Field>
          <Field label="Salida (fecha y hora)">
            <Input
              type="datetime-local"
              value={draft.departAt ?? ""}
              onChange={(e) => set("departAt")(e.target.value)}
            />
          </Field>
          <Field label="Llegada (fecha y hora)">
            <Input
              type="datetime-local"
              value={draft.arriveAt ?? ""}
              onChange={(e) => set("arriveAt")(e.target.value)}
            />
          </Field>
          <Field label="Escalas">
            <Input
              value={draft.stops ?? ""}
              onChange={(e) => set("stops")(e.target.value)}
              placeholder="Directo / CDMX 2h"
            />
          </Field>
          <Field label="Equipaje">
            <Input
              value={draft.baggage ?? ""}
              onChange={(e) => set("baggage")(e.target.value)}
              placeholder="1 maleta 23kg + carry on"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notas">
              <Textarea
                value={draft.notes ?? ""}
                onChange={(e) => set("notes")(e.target.value)}
                placeholder="Detalles, asiento, cambios..."
                rows={2}
              />
            </Field>
          </div>
        </div>

        {warning && (
          <p className="rounded-md bg-secondary/70 px-3 py-2 text-xs text-muted-foreground">
            {warning}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

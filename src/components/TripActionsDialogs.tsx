// Diálogos de confirmación fuerte para acciones destructivas sobre viajes:
// Duplicar (confirmación simple + opción de copiar fechas) y Eliminar (mueve
// a papelera; exige tipeo exacto del nombre para habilitar el botón).

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

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
import { Checkbox } from "@/components/ui/checkbox";
import { useTripsStore } from "@/lib/trips-store";
import { createDialogShortcuts } from "@/hooks/use-submit-on-enter";

interface DuplicateTripDialogProps {
  tripId: string;
  tripName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si true, navega al nuevo viaje al terminar. Default: true. */
  navigateAfter?: boolean;
}

export function DuplicateTripDialog({
  tripId,
  tripName,
  open,
  onOpenChange,
  navigateAfter = true,
}: DuplicateTripDialogProps) {
  const duplicateTrip = useTripsStore((s) => s.duplicateTrip);
  const navigate = useNavigate();
  const [copyDates, setCopyDates] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const newId = await duplicateTrip(tripId, { copyDates });
      if (!newId) {
        toast.error("No se pudo duplicar el viaje.");
        return;
      }
      toast.success("Viaje duplicado", {
        description: `Se creó una copia independiente de "${tripName}".`,
      });
      onOpenChange(false);
      if (navigateAfter) {
        navigate({ to: "/viajes/$tripId", params: { tripId: newId } });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al duplicar el viaje.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (loading ? null : onOpenChange(v))}>
      <DialogContent
        onKeyDown={createDialogShortcuts({
          onSubmit: handleConfirm,
          onCancel: () => !loading && onOpenChange(false),
          canSubmit: !loading,
        })}
      >
        <DialogHeader>
          <DialogTitle>Duplicar viaje</DialogTitle>
          <DialogDescription>
            Vas a duplicar <span className="font-medium text-foreground">{tripName}</span>. Se
            creará una copia independiente con la estructura base del viaje original.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-border/60 bg-secondary/40 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-foreground">Se copian:</p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              <li>Nombre (con "(copia)"), destino, cover y capacidad</li>
              <li>Moneda base, moneda local y tasa del viaje</li>
              <li>Itinerario y días</li>
              <li>Costos, categorías y proveedores (con nuevos IDs)</li>
              <li>Reglas de devolución y configuración general</li>
            </ul>
            <p className="text-xs font-semibold text-foreground pt-1">No se copian:</p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              <li>Viajeras, inscripciones y pagos</li>
              <li>Miembros, invitaciones e historial</li>
              <li>Datos de ejecución real del viaje original</li>
            </ul>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={copyDates}
              onCheckedChange={(v) => setCopyDates(v === true)}
              disabled={loading}
            />
            <span className="text-sm text-foreground">Copiar también las fechas del viaje</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Duplicar viaje
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteTripDialogProps {
  tripId: string;
  tripName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si true, navega a "/" al terminar (útil cuando se elimina desde el detalle). */
  navigateHomeAfter?: boolean;
}

export function DeleteTripDialog({
  tripId,
  tripName,
  open,
  onOpenChange,
  navigateHomeAfter = false,
}: DeleteTripDialogProps) {
  const trashTrip = useTripsStore((s) => s.trashTrip);
  const restoreTrip = useTripsStore((s) => s.restoreTrip);
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);

  const canConfirm = typed.trim() === tripName.trim() && !loading;

  function handleClose(v: boolean) {
    if (loading) return;
    if (!v) setTyped("");
    onOpenChange(v);
  }

  async function handleConfirm() {
    if (!canConfirm) return;
    setLoading(true);
    try {
      await trashTrip(tripId);
      toast.success("Viaje enviado a la papelera", {
        description: "Podés recuperarlo durante los próximos 7 días.",
        action: {
          label: "Restaurar",
          onClick: async () => {
            try {
              await restoreTrip(tripId);
              toast.success("Viaje restaurado");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "No se pudo restaurar el viaje.");
            }
          },
        },
        cancel: {
          label: "Ir a la papelera",
          onClick: () => {
            navigate({ to: "/papelera" });
          },
        },

      });

      setTyped("");
      onOpenChange(false);
      if (navigateHomeAfter) navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar el viaje.");
    } finally {
      setLoading(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        onKeyDown={createDialogShortcuts({
          onSubmit: handleConfirm,
          onCancel: () => handleClose(false),
          canSubmit: canConfirm,
        })}
      >
        <DialogHeader>
          <DialogTitle className="text-destructive">Eliminar viaje</DialogTitle>
          <DialogDescription>
            Este viaje se moverá a la papelera y podrá recuperarse durante 7 días. Después de ese
            plazo se eliminará definitivamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
            Escribí <span className="font-semibold">{tripName}</span> para confirmar que querés
            eliminarlo.
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delete-trip-confirm" className="text-xs text-muted-foreground">
              Nombre del viaje
            </Label>
            <Input
              id="delete-trip-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={tripName}
              autoComplete="off"
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canConfirm}>
            {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Mover a la papelera
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

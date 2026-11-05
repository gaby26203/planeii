import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, RotateCcw, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useTripsStore } from "@/lib/trips-store";
import { usePermissions } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/papelera")({
  component: TrashPage,
  head: () => ({
    meta: [{ title: "Papelera · Viajera" }],
  }),
});

function daysUntil(iso?: string): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (isNaN(t)) return 0;
  return Math.max(0, Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000)));
}

interface Row {
  id: string;
  name: string;
  destination: string;
  purgeAt?: string;
  deletedAt?: string;
}

function TrashedTripRow({ trip, canManage }: { trip: Row; canManage: boolean }) {
  const restoreTrip = useTripsStore((s) => s.restoreTrip);
  const purgeTrip = useTripsStore((s) => s.purgeTrip);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const remaining = daysUntil(trip.purgeAt);

  async function handleRestore() {
    setBusy(true);
    try {
      await restoreTrip(trip.id);
      toast.success("Viaje restaurado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo restaurar");
    } finally {
      setBusy(false);
    }
  }

  async function handlePurge() {
    setBusy(true);
    try {
      await purgeTrip(trip.id);
      toast.success("Viaje eliminado definitivamente");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setBusy(false);
      setPurgeOpen(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/30 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-foreground truncate">{trip.name}</p>
          <p className="text-xs text-muted-foreground">
            {trip.destination || "Sin destino"} · Se elimina en {remaining} día
            {remaining === 1 ? "" : "s"}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleRestore} disabled={busy}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Restaurar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setPurgeOpen(true)}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Eliminar ya
            </Button>
          </div>
        )}
      </div>
      <AlertDialog open={purgeOpen} onOpenChange={(v) => (busy ? null : setPurgeOpen(v))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Eliminar definitivamente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará "{trip.name}" y todos sus datos
              asociados de forma permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handlePurge();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TrashPage() {
  const trips = useTripsStore((s) => s.trips);
  const hydrated = useTripsStore((s) => s.hydrated);
  const hydrating = useTripsStore((s) => s.hydrating);
  const { canCreateTrip } = usePermissions();

  const trashed = useMemo<Row[]>(
    () =>
      Object.values(trips)
        .filter((t) => t.isDeleted)
        .map((t) => ({
          id: t.id,
          name: t.name,
          destination: t.destination,
          purgeAt: t.purgeAt,
          deletedAt: t.deletedAt,
        }))
        .sort((a, b) => (a.deletedAt ?? "").localeCompare(b.deletedAt ?? "")),
    [trips],
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl">
      <Link
        to="/ajustes"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a Ajustes
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <Trash2 className="h-5 w-5 text-muted-foreground" />
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground tracking-tight">
          Papelera
        </h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Los viajes en la papelera se eliminan definitivamente después de 7 días.
      </p>

      {!hydrated && hydrating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      )}

      {hydrated && trashed.length === 0 && (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            La papelera está vacía.
          </CardContent>
        </Card>
      )}

      {trashed.length > 0 && (
        <div className="space-y-2">
          {trashed.map((t) => (
            <TrashedTripRow key={t.id} trip={t} canManage={canCreateTrip} />
          ))}
        </div>
      )}
    </div>
  );
}

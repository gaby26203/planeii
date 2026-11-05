import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  RefreshCw,
  Check,
  Minus,
  ChevronDown,
  ChevronRight,
  History,
  ExternalLink,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getMyAccessAudit } from "@/lib/my-access.functions";
import { PERM_KEYS, PERM_LABELS, normalize } from "@/lib/trip-permissions";
import { refreshAccess } from "@/lib/access";
import { DisplayNameCard } from "@/components/DisplayNameCard";

export const Route = createFileRoute("/_authenticated/mis-accesos")({
  head: () => ({
    meta: [
      { title: "Mis accesos — Planeii" },
      {
        name: "description",
        content:
          "Consulta tus roles y membresías por viaje, los permisos habilitados y el historial de cambios de acceso.",
      },
      { property: "og:title", content: "Mis accesos — Planeii" },
      {
        property: "og:description",
        content:
          "Panel de auditoría personal: roles por viaje, permisos habilitados y últimos cambios de acceso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MisAccesosPage,
});

const ACTION_LABELS: Record<string, string> = {
  member_added: "Te agregaron al viaje",
  member_updated: "Actualizaron tu rol o permisos",
  member_role_updated: "Cambiaron tu rol",
  member_permissions_updated: "Actualizaron tus permisos",
  member_removed: "Te quitaron del viaje",
  invitation_created: "Te enviaron una invitación",
  invitation_accepted: "Aceptaste la invitación",
  invitation_revoked: "Revocaron una invitación",
  owner_role_granted: "Te dieron rol de dueña de cuenta",
  owner_role_revoked: "Quitaron tu rol de dueña de cuenta",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MisAccesosPage() {
  const fetchAudit = useServerFn(getMyAccessAudit);
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["my-access-audit"],
    queryFn: () => fetchAudit(),
  });

  async function handleRefresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-access-audit"] }),
      refreshAccess(),
    ]);
  }

  const trips = data?.trips ?? [];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Encabezado */}
        <div className="rounded-xl bg-secondary/80 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Mis accesos
              </h1>
              <p className="text-sm text-muted-foreground">
                {data?.email ?? "—"}
                {" · "}
                <span className="text-foreground/80">
                  {data?.isOwner ? "Dueña de la cuenta" : "Organizadora invitada"}
                </span>
                {" · "}
                {trips.length} {trips.length === 1 ? "viaje con acceso" : "viajes con acceso"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Este panel es solo de lectura. Los permisos los define la dueña de la cuenta.
          </p>
        </div>

        <DisplayNameCard />

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            No pudimos cargar tus accesos. Intenta actualizar.
          </div>
        )}

        {isLoading && (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/50" />
            ))}
          </div>
        )}

        {!isLoading && trips.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <Compass className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 font-medium">Aún no tienes viajes asignados</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pide a la dueña de la cuenta que te invite a un viaje.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/">Ir al dashboard</Link>
            </Button>
          </div>
        )}

        {/* Tarjetas por viaje */}
        <div className="grid gap-4">
          {trips.map((trip) => {
            const perms = normalize(trip.permissions, trip.role);
            const activeCount = PERM_KEYS.filter((k) => perms[k]).length;
            const usingDefaults = trip.permissions === null;
            return (
              <div key={trip.tripId} className="overflow-hidden rounded-xl border">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-secondary/80 px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-lg font-semibold">{trip.tripName}</h2>
                    <p className="text-xs text-muted-foreground">
                      {trip.destination ? `${trip.destination} · ` : ""}
                      Acceso desde {fmtDate(trip.memberSince)}
                      {trip.lastPermissionChangeAt
                        ? ` · Últ. cambio ${fmtDate(trip.lastPermissionChangeAt)}${
                            trip.lastPermissionChangeBy ? ` (${trip.lastPermissionChangeBy})` : ""
                          }`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant={trip.role === "organizadora" ? "default" : "secondary"}
                    className="shrink-0 capitalize"
                  >
                    {trip.role === "organizadora" ? "Organizadora" : "Tour leader"}
                  </Badge>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {PERM_KEYS.map((key) => {
                      const on = perms[key];
                      return (
                        <Tooltip key={key}>
                          <TooltipTrigger asChild>
                            <div
                              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${
                                on
                                  ? "border-primary/30 bg-primary/10 text-foreground"
                                  : "border-border bg-muted/40 text-muted-foreground line-through decoration-muted-foreground/40"
                              }`}
                            >
                              {on ? (
                                <Check className="h-3 w-3 shrink-0 text-primary" />
                              ) : (
                                <Minus className="h-3 w-3 shrink-0" />
                              )}
                              <span className="truncate">{PERM_LABELS[key].title}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>{PERM_LABELS[key].desc}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <Link to="/viajes/$tripId" params={{ tripId: trip.tripId }}>
                        Abrir viaje
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Permisos: {activeCount} de {PERM_KEYS.length}
                      {usingDefaults ? " · según defaults del rol" : ""}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Historial */}
        {!isLoading && (
          <div className="rounded-xl border">
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/40"
            >
              {historyOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <History className="h-4 w-4 text-muted-foreground" />
              Historial de cambios
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({data?.history.length ?? 0})
              </span>
            </button>
            {historyOpen && (
              <div className="border-t">
                {(data?.history.length ?? 0) === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    Todavía no hay cambios registrados en tus accesos.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {data?.history.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2.5 text-sm">
                        <span className="font-medium">
                          {ACTION_LABELS[h.action] ?? h.action.replace(/_/g, " ")}
                        </span>
                        {h.tripName && (
                          <span className="text-muted-foreground">· {h.tripName}</span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {fmtDateTime(h.createdAt)}
                          {h.actorEmail ? ` · ${h.actorEmail}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

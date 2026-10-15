import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Compass, Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  lookupTripInvitation,
  acceptTripInvitation,
} from "@/lib/trip-invitations.functions";

export const Route = createFileRoute("/invitacion/$token")({
  ssr: false,
  component: InvitationPage,
});

type LookupResult =
  | { found: false }
  | {
      found: true;
      id: string;
      tripId: string;
      tripName: string;
      email: string;
      role: "organizadora" | "tour_leader";
      status: "pending" | "accepted" | "revoked";
      expired: boolean;
      matchesEmail: boolean;
      currentEmail: string | null;
      isMember: boolean;
    };

function InvitationPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const lookup = useServerFn(lookupTripInvitation);
  const accept = useServerFn(acceptTripInvitation);

  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "unauth" }
    | { kind: "loaded"; data: LookupResult }
    | { kind: "accepting" }
    | { kind: "accepted"; tripId: string }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  /** Guarda el token también en sessionStorage como respaldo del parámetro de URL. */
  function rememberToken() {
    try {
      sessionStorage.setItem("pending_invite_token", token);
    } catch {}
  }

  function goToAuth(extra?: { email?: string }) {
    rememberToken();
    navigate({
      to: "/auth",
      search: { invite: token, ...(extra?.email ? { email: extra.email } : {}) },
      replace: true,
    });
  }

  async function acceptNow(): Promise<boolean> {
    setState({ kind: "accepting" });
    try {
      const res = (await accept({ data: { token } })) as { tripId: string };
      try {
        sessionStorage.removeItem("pending_invite_token");
      } catch {}
      setState({ kind: "accepted", tripId: res.tripId });
      return true;
    } catch (e: any) {
      setState({ kind: "error", message: e?.message ?? "No se pudo aceptar la invitación" });
      return false;
    }
  }

  async function bootstrap() {
    setState({ kind: "loading" });
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      // Sin sesión: el token viaja en la URL de /auth (y queda en sessionStorage
      // como respaldo) para que sobreviva la confirmación de email u OAuth.
      rememberToken();
      setState({ kind: "unauth" });
      return;
    }
    try {
      const res = (await lookup({ data: { token } })) as LookupResult;
      // Aceptación automática: si todo está en orden, no hace falta pulsar nada.
      if (
        res.found &&
        res.matchesEmail &&
        !res.expired &&
        (res.status === "pending" || (res.status === "accepted" && res.isMember))
      ) {
        const ok = await acceptNow();
        if (ok) {
          toast.success("¡Ya tenés acceso al viaje!");
          navigate({ to: "/viajes/$tripId", params: { tripId: res.tripId }, replace: true });
          return;
        }
        return;
      }
      setState({ kind: "loaded", data: res });
    } catch (e: any) {
      setState({ kind: "error", message: e?.message ?? "No se pudo cargar la invitación" });
    }
  }

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleAccept() {
    const ok = await acceptNow();
    if (ok) toast.success("¡Te uniste al viaje!");
  }

  async function switchAccount(email?: string) {
    await supabase.auth.signOut();
    goToAuth({ email });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Compass className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight">PLANEI OS</span>
        </div>

        <Card>
          <CardContent className="p-6">
            {state.kind === "loading" && (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-3">Cargando invitación…</p>
              </div>
            )}

            {state.kind === "unauth" && (
              <div className="space-y-4">
                <div className="text-center">
                  <Mail className="h-8 w-8 mx-auto text-primary" />
                  <h1 className="font-display text-xl font-semibold mt-3">
                    Invitación a un viaje
                  </h1>
                  <p className="text-xs text-muted-foreground mt-1">
                    Creá tu cuenta o iniciá sesión con el correo al que te enviaron la
                    invitación. En cuanto entres, el acceso al viaje se activa solo.
                  </p>
                </div>
                <Button className="w-full" onClick={() => goToAuth()}>
                  Continuar
                </Button>
              </div>
            )}

            {state.kind === "loaded" && !state.data.found && (
              <div className="text-center py-6 space-y-3">
                <XCircle className="h-8 w-8 mx-auto text-destructive" />
                <h1 className="font-display text-lg font-semibold">Invitación no encontrada</h1>
                <p className="text-xs text-muted-foreground">
                  El link puede haber sido revocado o es incorrecto.
                </p>
                <Button variant="outline" onClick={() => navigate({ to: "/" })}>
                  Ir al inicio
                </Button>
              </div>
            )}

            {state.kind === "loaded" && state.data.found && (
              <InvitationDetails
                data={state.data}
                onAccept={handleAccept}
                onSwitch={() =>
                  switchAccount(state.data.found ? state.data.email : undefined)
                }
                onOpenTrip={(tripId) => navigate({ to: "/viajes/$tripId", params: { tripId } })}
                onCancel={() => navigate({ to: "/" })}
              />
            )}

            {state.kind === "accepting" && (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-3">Activando tu acceso…</p>
              </div>
            )}

            {state.kind === "accepted" && (
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="h-10 w-10 mx-auto text-primary" />
                <h1 className="font-display text-lg font-semibold">¡Listo!</h1>
                <p className="text-xs text-muted-foreground">Ya tenés acceso al viaje.</p>
                <Button
                  className="w-full"
                  onClick={() =>
                    navigate({ to: "/viajes/$tripId", params: { tripId: state.tripId } })
                  }
                >
                  Abrir viaje
                </Button>
              </div>
            )}

            {state.kind === "error" && (
              <div className="text-center py-6 space-y-3">
                <XCircle className="h-8 w-8 mx-auto text-destructive" />
                <p className="text-sm">{state.message}</p>
                <Button variant="outline" onClick={() => void bootstrap()}>
                  Reintentar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InvitationDetails({
  data,
  onAccept,
  onSwitch,
  onOpenTrip,
  onCancel,
}: {
  data: Extract<LookupResult, { found: true }>;
  onAccept: () => void;
  onSwitch: () => void;
  onOpenTrip: (tripId: string) => void;
  onCancel: () => void;
}) {
  if (data.status === "accepted") {
    return (
      <div className="text-center py-4 space-y-3">
        <CheckCircle2 className="h-8 w-8 mx-auto text-primary" />
        <p className="text-sm">
          {data.isMember
            ? "Ya tenés acceso a este viaje."
            : "Esta invitación ya fue aceptada por otra cuenta."}
        </p>
        {data.isMember ? (
          <Button onClick={() => onOpenTrip(data.tripId)}>Abrir viaje</Button>
        ) : (
          <Button variant="outline" onClick={onCancel}>Ir al inicio</Button>
        )}
      </div>
    );
  }
  if (data.status === "revoked") {
    return (
      <div className="text-center py-4 space-y-3">
        <XCircle className="h-8 w-8 mx-auto text-destructive" />
        <p className="text-sm">Esta invitación fue cancelada.</p>
        <p className="text-xs text-muted-foreground">
          Pedile a la administradora que te envíe un enlace nuevo.
        </p>
        <Button variant="outline" onClick={onCancel}>Ir al inicio</Button>
      </div>
    );
  }
  if (data.expired) {
    return (
      <div className="text-center py-4 space-y-3">
        <XCircle className="h-8 w-8 mx-auto text-destructive" />
        <p className="text-sm">Esta invitación expiró.</p>
        <p className="text-xs text-muted-foreground">
          Pedile a la administradora que te envíe un enlace nuevo.
        </p>
        <Button variant="outline" onClick={onCancel}>Ir al inicio</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <Mail className="h-8 w-8 mx-auto text-primary" />
        <h1 className="font-display text-xl font-semibold">Te invitaron a un viaje</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{data.tripName}</span>
        </p>
        <div className="flex justify-center">
          <Badge variant="secondary" className="text-[10px]">
            Rol: {data.role === "organizadora" ? "Organizadora" : "Tour leader"}
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border p-3 bg-secondary/30 text-xs space-y-1">
        <p>
          <span className="text-muted-foreground">Enviada a: </span>
          <span className="font-medium">{data.email}</span>
        </p>
        {data.currentEmail && (
          <p>
            <span className="text-muted-foreground">Tu sesión: </span>
            <span className="font-medium">{data.currentEmail}</span>
          </p>
        )}
      </div>

      {data.matchesEmail ? (
        <div className="space-y-2">
          <Button className="w-full" onClick={onAccept}>
            Aceptar invitación
          </Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            Ahora no
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-destructive text-center">
            Esta invitación es para <b>{data.email}</b> y estás usando{" "}
            <b>{data.currentEmail ?? "otra cuenta"}</b>. Entrá con{" "}
            <b>{data.email}</b> para activar tu acceso.
          </p>
          <Button variant="outline" className="w-full" onClick={onSwitch}>
            Cerrar sesión y entrar con {data.email}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePermissions, useAccess, type Permissions } from "@/lib/access";
import type { ReactNode } from "react";

interface Props {
  can: keyof Permissions;
  tripId?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function AccessGate({ can, tripId, children, fallback }: Props) {
  const { loading, refresh } = useAccess();
  const perms = usePermissions(tripId);
  const allowed = Boolean(perms[can]);

  // Reintento de cortesía: si al montar todavía no hay permiso, recargamos
  // membresías/rol una vez antes de mostrar el bloqueo. Evita falsos
  // "Sin acceso" cuando la membresía se creó después de cargar el contexto
  // (por ejemplo, al aceptar una invitación recién registrada).
  const retried = useRef(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (loading || allowed || retried.current) return;
    retried.current = true;
    setRetrying(true);
    void refresh().finally(() => setRetrying(false));
  }, [loading, allowed, refresh]);

  if (loading || (!allowed && retrying)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Cargando permisos…
      </div>
    );
  }

  if (allowed) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <ShieldAlert className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Sin acceso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta todavía no tiene acceso a esta sección. Si te invitaron a este viaje, pedile a
          la organizadora principal que verifique tu invitación con este mismo correo.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setRetrying(true);
              void refresh().finally(() => setRetrying(false));
            }}
          >
            Reintentar
          </Button>
          <Button asChild>
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

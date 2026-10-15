import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTripsStore } from "@/lib/trips-store";
import { acceptMyPendingInvitations } from "@/lib/trip-invitations.functions";
import { refreshAccess } from "@/lib/access";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <>
      <TripsSyncer />
      <Outlet />
    </>
  );
}

/**
 * Dispara la carga de viajes desde Supabase al montar el layout autenticado y
 * limpia el store cuando la sesión termina. Idempotente: el store ignora
 * llamadas concurrentes o ya completadas.
 */
function TripsSyncer() {
  useEffect(() => {
    // Cierra invitaciones pendientes del email de la cuenta antes de listar los
    // viajes: así quien se registró desde un enlace entra con acceso ya activo.
    void (async () => {
      try {
        const res = await acceptMyPendingInvitations();
        if (res?.accepted?.length) {
          await useTripsStore.getState().hydrateFromSupabase({ force: true });
          // Los permisos se cargan una sola vez al montar: sin este refresh la
          // membresía recién creada no se vería y el viaje diría "Sin acceso".
          await refreshAccess();
        }
      } catch {
        // Silencioso: no bloquea la carga de la app.
      }
    })();
    void useTripsStore.getState().hydrateFromSupabase();

    // Debounced re-hydratación: agrupamos ráfagas de eventos Realtime
    // (varias filas cambiando en secuencia) en una sola recarga.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRehydrate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void useTripsStore.getState().hydrateFromSupabase({ force: true });
      }, 300);
    };

    // Cambios de membresía / rol / invitaciones también refrescan permisos.
    let accessTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleAccessRefresh = () => {
      if (accessTimer) clearTimeout(accessTimer);
      accessTimer = setTimeout(() => {
        void refreshAccess();
      }, 300);
    };

    const TABLES = [
      "trips",
      "trip_members",
      "trip_notes",
      "trip_todos",
      "trip_documents",
      "trip_invitations",
    ] as const;

    const ACCESS_TABLES = new Set<string>(["trip_members", "trip_invitations", "user_roles"]);

    const channel = supabase.channel("trips-live-sync");
    for (const table of [...TABLES, "user_roles" as const]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          if (table !== "user_roles") scheduleRehydrate();
          if (ACCESS_TABLES.has(table)) scheduleAccessRefresh();
        },
      );
    }
    channel.subscribe();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        useTripsStore.getState().resetTrips();
      } else if (event === "SIGNED_IN") {
        void useTripsStore.getState().hydrateFromSupabase();
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      if (accessTimer) clearTimeout(accessTimer);
      supabase.removeChannel(channel);
      sub.subscription.unsubscribe();
    };
  }, []);
  return null;
}

import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalize, type TripPermMap } from "@/lib/trip-permissions";

export type TripRole = "organizadora" | "tour_leader";

export interface MembershipInfo {
  role: TripRole;
  perms: TripPermMap; // efectivos (defaults del rol + overrides del owner)
}

export interface AccessState {
  loading: boolean;
  userId: string | null;
  isOwner: boolean;
  memberships: Record<string, MembershipInfo>; // tripId -> info
  refresh: () => Promise<void>;
}

const AccessContext = createContext<AccessState | null>(null);

// Refresher registrado por el provider para poder recargar permisos desde
// fuera de React (p. ej. tras aceptar invitaciones o eventos Realtime).
let externalRefresh: (() => Promise<void>) | null = null;

export async function refreshAccess() {
  if (externalRefresh) await externalRefresh();
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [memberships, setMemberships] = useState<Record<string, MembershipInfo>>({});

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setIsOwner(false);
      setMemberships({});
      setLoading(false);
      return;
    }
    const [rolesRes, membersRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("trip_members").select("trip_id, role, permissions").eq("user_id", uid),
    ]);
    const owner = (rolesRes.data ?? []).some((r) => r.role === "owner");
    const map: Record<string, MembershipInfo> = {};
    for (const m of membersRes.data ?? []) {
      const role = m.role as TripRole;
      map[m.trip_id as string] = {
        role,
        perms: normalize(m.permissions, role),
      };
    }
    setIsOwner(owner);
    setMemberships(map);
    setLoading(false);
  }

  useEffect(() => {
    externalRefresh = load;
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void load();
      }
    });
    return () => {
      if (externalRefresh === load) externalRefresh = null;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AccessState>(
    () => ({ loading, userId, isOwner, memberships, refresh: load }),
    [loading, userId, isOwner, memberships],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessState {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    return {
      loading: false,
      userId: null,
      isOwner: false,
      memberships: {},
      refresh: async () => {},
    };
  }
  return ctx;
}

export interface Permissions {
  isOwner: boolean;
  tripRole: TripRole | null;
  // Global pages
  canSeeGlobalOps: boolean;
  canSeeGlobalCrm: boolean;
  canSeeGlobalPagos: boolean;
  canSeeGlobalReportes: boolean;
  canSeeGlobalFinanzas: boolean;
  canCreateTrip: boolean;
  // Per-trip
  canAccessTrip: boolean;
  canEditTrip: boolean;
  canManageTravelers: boolean;
  canSeeFinances: boolean;
  canEditItinerary: boolean;
  canEditProveedores: boolean;
  canEditCosts: boolean;
  canRegisterPayments: boolean;
  canEditExtras: boolean;
  canMarkOperational: boolean;
  canInviteMembers: boolean;
}

export function usePermissions(tripId?: string): Permissions {
  const { isOwner, memberships } = useAccess();
  const info = tripId ? memberships[tripId] ?? null : null;
  const tripRole: TripRole | null = info?.role ?? null;
  // El owner global tiene todo por defecto; para miembros aplican los perms efectivos.
  const p = info?.perms;
  const grant = (key: keyof TripPermMap) => isOwner || Boolean(p?.[key]);

  const hasAnyOrganizadora = Object.values(memberships).some((m) => m.role === "organizadora");

  return {
    isOwner,
    tripRole,
    canSeeGlobalOps: isOwner,
    canSeeGlobalCrm: isOwner,
    canSeeGlobalPagos: isOwner,
    canSeeGlobalReportes: isOwner,
    canSeeGlobalFinanzas: isOwner || hasAnyOrganizadora,
    canCreateTrip: isOwner,
    canAccessTrip: isOwner || tripRole !== null,
    canEditTrip: isOwner || tripRole === "organizadora",
    canManageTravelers: grant("gestionar_viajeras"),
    canSeeFinances: grant("ver_finanzas"),
    canEditItinerary: grant("editar_itinerario"),
    canEditProveedores: grant("editar_proveedores"),
    canEditCosts: grant("editar_costos"),
    canRegisterPayments: grant("registrar_pagos"),
    canEditExtras: grant("editar_extras"),
    canMarkOperational: grant("marcar_operativo"),
    canInviteMembers: isOwner,
  };
}


// Panel de auditoría propia: cada usuaria puede ver sus roles/membresías,
// permisos efectivos y el historial de cambios que le afectan.
// Solo lectura y siempre limitado al usuario autenticado.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface MyAccessTrip {
  tripId: string;
  tripName: string;
  tripStatus: string | null;
  destination: string | null;
  role: "organizadora" | "tour_leader";
  permissions: Record<string, boolean> | null;
  memberSince: string;
  lastPermissionChangeAt: string | null;
  lastPermissionChangeBy: string | null;
}

export interface MyAccessAuditEntry {
  id: string;
  tripId: string | null;
  tripName: string | null;
  action: string;
  actorEmail: string | null;
  createdAt: string;
  detailsText: string | null;
}

export interface MyAccessAudit {
  userId: string;
  email: string | null;
  isOwner: boolean;
  trips: MyAccessTrip[];
  history: MyAccessAuditEntry[];
}

export const getMyAccessAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAccessAudit> => {
    const { supabase, userId, claims } = context;
    const email = ((claims as Record<string, unknown> | null)?.["email"] as string | null) ?? null;

    const [rolesRes, membersRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("trip_members")
        .select("trip_id, role, permissions, created_at")
        .eq("user_id", userId),
    ]);
    if (rolesRes.error) throw new Error(rolesRes.error.message);
    if (membersRes.error) throw new Error(membersRes.error.message);

    const isOwner = (rolesRes.data ?? []).some((r) => r.role === "owner");
    const memberships = membersRes.data ?? [];
    const tripIds = memberships.map((m) => m.trip_id as string);

    const tripInfo: Record<string, { name: string; status: string | null; destination: string | null }> = {};
    if (tripIds.length > 0) {
      const { data: trips } = await supabase
        .from("trips")
        .select("id, name, status, destination")
        .in("id", tripIds);
      for (const t of trips ?? []) {
        tripInfo[t.id as string] = {
          name: (t.name as string) ?? "Viaje",
          status: (t.status as string | null) ?? null,
          destination: (t.destination as string | null) ?? null,
        };
      }
    }

    // El historial vive en access_audit_log, cuya política solo permite lectura
    // al owner global. Lo leemos con el cliente privilegiado pero filtrado
    // estrictamente a las entradas cuyo objetivo es esta misma usuaria.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let auditRows: Array<Record<string, unknown>> = [];
    {
      const filter = email
        ? `target_user_id.eq.${userId},target_email.eq.${email.toLowerCase()}`
        : `target_user_id.eq.${userId}`;
      const { data, error } = await supabaseAdmin
        .from("access_audit_log")
        .select("id, trip_id, action, actor_email, details, created_at, target_user_id, target_email")
        .or(filter)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error) auditRows = (data ?? []) as Array<Record<string, unknown>>;
    }

    // Nombres de viajes que aparecen en el historial pero ya no son membresías
    const historyTripIds = Array.from(
      new Set(
        auditRows
          .map((r) => r["trip_id"] as string | null)
          .filter((id): id is string => Boolean(id) && !tripInfo[id as string]),
      ),
    );
    const extraTripNames: Record<string, string> = {};
    if (historyTripIds.length > 0) {
      const { data: extra } = await supabaseAdmin
        .from("trips")
        .select("id, name")
        .in("id", historyTripIds);
      for (const t of extra ?? []) extraTripNames[t.id as string] = (t.name as string) ?? "Viaje";
    }

    const tripNameFor = (id: string | null) =>
      id ? tripInfo[id]?.name ?? extraTripNames[id] ?? null : null;

    const permChangeActions = new Set([
      "member_permissions_updated",
      "member_updated",
      "member_role_updated",
      "member_added",
      "invitation_accepted",
    ]);

    const trips: MyAccessTrip[] = memberships.map((m) => {
      const tripId = m.trip_id as string;
      const info = tripInfo[tripId];
      const lastChange = auditRows.find(
        (r) => r["trip_id"] === tripId && permChangeActions.has(String(r["action"])),
      );
      return {
        tripId,
        tripName: info?.name ?? "Viaje",
        tripStatus: info?.status ?? null,
        destination: info?.destination ?? null,
        role: m.role as "organizadora" | "tour_leader",
        permissions: (m.permissions as Record<string, boolean> | null) ?? null,
        memberSince: m.created_at as string,
        lastPermissionChangeAt: lastChange ? (lastChange["created_at"] as string) : null,
        lastPermissionChangeBy: lastChange ? ((lastChange["actor_email"] as string | null) ?? null) : null,
      };
    });

    trips.sort((a, b) => a.tripName.localeCompare(b.tripName));

    const history: MyAccessAuditEntry[] = auditRows.map((r) => ({
      id: r["id"] as string,
      tripId: (r["trip_id"] as string | null) ?? null,
      tripName: tripNameFor((r["trip_id"] as string | null) ?? null),
      action: String(r["action"]),
      actorEmail: (r["actor_email"] as string | null) ?? null,
      createdAt: r["created_at"] as string,
      detailsText: (() => {
        const d = r["details"] as Record<string, unknown> | null;
        if (!d || Object.keys(d).length === 0) return null;
        try {
          return JSON.stringify(d);
        } catch {
          return null;
        }
      })(),
    }));

    return { userId, email, isOwner, trips, history };
  });

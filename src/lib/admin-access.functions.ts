// Server functions para el panel global de accesos (solo owner).
// Todas verifican has_role('owner') antes de ejecutar y usan supabaseAdmin
// dinámicamente para consultar cross-user / cross-trip.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "owner",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo el owner puede acceder al panel de accesos.");
}

const roleSchema = z.enum(["organizadora", "tour_leader"]);
const permsSchema = z.record(z.string(), z.boolean()).nullable().optional();

// ============= Listar todos los usuarios =============
export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profRes, rolesRes, authRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, email, display_name, avatar_url, created_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ perPage: 200 }),
    ]);
    if (profRes.error) throw new Error(profRes.error.message);
    if (rolesRes.error) throw new Error(rolesRes.error.message);

    const owners = new Set<string>();
    for (const r of rolesRes.data ?? []) {
      if ((r as any).role === "owner") owners.add((r as any).user_id as string);
    }
    const lastSignIn: Record<string, string | null> = {};
    for (const u of authRes.data?.users ?? []) {
      lastSignIn[u.id] = u.last_sign_in_at ?? null;
    }
    return (profRes.data ?? []).map((p: any) => ({
      id: p.id as string,
      email: (p.email as string | null) ?? null,
      displayName: (p.display_name as string | null) ?? null,
      avatarUrl: (p.avatar_url as string | null) ?? null,
      isOwner: owners.has(p.id as string),
      lastSignInAt: lastSignIn[p.id as string] ?? null,
      createdAt: p.created_at as string,
    }));
  });

// ============= Otorgar / revocar rol owner =============
export const setOwnerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().min(1), isOwner: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logAccessAudit } = await import("@/lib/access-audit.server");
    const actorEmail = ((context.claims as any)?.email ?? null) as string | null;

    const { data: targetProf } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", data.userId)
      .maybeSingle();
    const targetEmail = (targetProf as any)?.email ?? null;

    if (!data.isOwner) {
      // Impedir que el último owner se auto-revoque.
      if (data.userId === context.userId) {
        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "owner");
        if ((count ?? 0) <= 1) {
          throw new Error("No podés revocarte a vos misma siendo la única owner.");
        }
      }
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "owner");
      if (error) throw new Error(error.message);
      await logAccessAudit({
        action: "owner_revoked",
        actorId: context.userId,
        actorEmail,
        targetUserId: data.userId,
        targetEmail,
      });
      return { ok: true as const };
    }

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: "owner" });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      throw new Error(error.message);
    }
    await logAccessAudit({
      action: "owner_granted",
      actorId: context.userId,
      actorEmail,
      targetUserId: data.userId,
      targetEmail,
    });
    return { ok: true as const };
  });

// ============= Listar todas las invitaciones =============
export const listAllInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("trip_invitations")
      .select(
        "id, trip_id, email, role, permissions, token, status, expires_at, accepted_at, created_at, invited_by",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const tripIds = Array.from(new Set((rows ?? []).map((r: any) => r.trip_id as string)));
    const inviterIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.invited_by as string).filter(Boolean)),
    );

    const [tripsRes, invitersRes] = await Promise.all([
      tripIds.length
        ? supabaseAdmin.from("trips").select("id, name").in("id", tripIds)
        : Promise.resolve({ data: [], error: null }),
      inviterIds.length
        ? supabaseAdmin
            .from("profiles")
            .select("id, email, display_name")
            .in("id", inviterIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const tripName: Record<string, string> = {};
    for (const t of (tripsRes.data as any[]) ?? []) tripName[t.id] = t.name;
    const inviter: Record<string, { email: string | null; displayName: string | null }> = {};
    for (const p of (invitersRes.data as any[]) ?? []) {
      inviter[p.id] = { email: p.email ?? null, displayName: p.display_name ?? null };
    }

    const now = Date.now();
    return (rows ?? []).map((r: any) => {
      const expired = new Date(r.expires_at as string).getTime() < now;
      const status = r.status as "pending" | "accepted" | "revoked";
      return {
        id: r.id as string,
        tripId: r.trip_id as string,
        tripName: tripName[r.trip_id as string] ?? "Viaje",
        email: r.email as string,
        role: r.role as "organizadora" | "tour_leader",
        permissions: (r.permissions as Record<string, boolean> | null) ?? null,
        token: r.token as string,
        status,
        expired: status === "pending" && expired,
        expiresAt: r.expires_at as string,
        acceptedAt: (r.accepted_at as string | null) ?? null,
        createdAt: r.created_at as string,
        invitedBy: (r.invited_by as string | null) ?? null,
        invitedByEmail: r.invited_by ? inviter[r.invited_by]?.email ?? null : null,
        invitedByName: r.invited_by ? inviter[r.invited_by]?.displayName ?? null : null,
      };
    });
  });

// ============= Listar todas las membresías =============
export const listAllMemberships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("trip_members")
      .select("id, trip_id, user_id, role, permissions, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const tripIds = Array.from(new Set((rows ?? []).map((r: any) => r.trip_id as string)));
    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id as string)));

    const [tripsRes, profsRes] = await Promise.all([
      tripIds.length
        ? supabaseAdmin.from("trips").select("id, name").in("id", tripIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, email, display_name").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const tripName: Record<string, string> = {};
    for (const t of (tripsRes.data as any[]) ?? []) tripName[t.id] = t.name;
    const profile: Record<string, { email: string | null; displayName: string | null }> = {};
    for (const p of (profsRes.data as any[]) ?? []) {
      profile[p.id] = { email: p.email ?? null, displayName: p.display_name ?? null };
    }

    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      tripId: r.trip_id as string,
      tripName: tripName[r.trip_id as string] ?? "Viaje",
      userId: r.user_id as string,
      email: profile[r.user_id as string]?.email ?? null,
      displayName: profile[r.user_id as string]?.displayName ?? null,
      role: r.role as "organizadora" | "tour_leader",
      permissions: (r.permissions as Record<string, boolean> | null) ?? null,
      createdAt: r.created_at as string,
    }));
  });

// ============= Bitácora de accesos =============
export const listAccessAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        tripId: z.string().optional(),
        targetUserId: z.string().optional(),
        targetEmail: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("access_audit_log")
      .select(
        "id, trip_id, actor_id, actor_email, target_user_id, target_email, action, details, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.tripId) q = q.eq("trip_id", data.tripId);
    if (data.targetUserId) q = q.eq("target_user_id", data.targetUserId);
    if (data.targetEmail) q = q.eq("target_email", data.targetEmail.toLowerCase());

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const tripIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.trip_id).filter(Boolean) as string[]),
    );
    const userIds = Array.from(
      new Set(
        [
          ...((rows ?? []).map((r: any) => r.actor_id).filter(Boolean) as string[]),
          ...((rows ?? []).map((r: any) => r.target_user_id).filter(Boolean) as string[]),
        ],
      ),
    );

    const [tripsRes, profsRes] = await Promise.all([
      tripIds.length
        ? supabaseAdmin.from("trips").select("id, name").in("id", tripIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, email, display_name").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const tripName: Record<string, string> = {};
    for (const t of (tripsRes.data as any[]) ?? []) tripName[t.id] = t.name;
    const profile: Record<string, { email: string | null; displayName: string | null }> = {};
    for (const p of (profsRes.data as any[]) ?? []) {
      profile[p.id] = { email: p.email ?? null, displayName: p.display_name ?? null };
    }

    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      action: r.action as string,
      createdAt: r.created_at as string,
      tripId: (r.trip_id as string | null) ?? null,
      tripName: r.trip_id ? tripName[r.trip_id as string] ?? "Viaje" : null,
      actorId: (r.actor_id as string | null) ?? null,
      actorEmail: (r.actor_email as string | null) ?? profile[r.actor_id as string]?.email ?? null,
      actorName: profile[r.actor_id as string]?.displayName ?? null,
      targetUserId: (r.target_user_id as string | null) ?? null,
      targetEmail:
        (r.target_email as string | null) ??
        profile[r.target_user_id as string]?.email ??
        null,
      targetName: profile[r.target_user_id as string]?.displayName ?? null,
      details: (r.details ?? {}) as Record<string, any>,
    }));
  });


// ============= Listar viajes (para el selector del panel global) =============
export const listAllTripsBasic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("trips")
      .select("id, name, status")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((t: any) => ({
      id: t.id as string,
      name: (t.name as string) ?? "Viaje",
      status: (t.status as string) ?? null,
    }));
  });

// ============= Crear invitación desde el panel global =============
// Wrapper equivalente a createTripInvitation, pero con validación owner
// duplicada para dejar claro el punto de entrada global.
export const createGlobalInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        tripId: z.string().min(1),
        email: z.string().email(),
        role: roleSchema,
        permissions: permsSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const emailLower = data.email.trim().toLowerCase();

    // ¿Ya es miembro?
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("email", emailLower)
      .maybeSingle();
    if (prof) {
      const { data: existing } = await context.supabase
        .from("trip_members")
        .select("id")
        .eq("trip_id", data.tripId)
        .eq("user_id", (prof as any).id as string)
        .maybeSingle();
      if (existing) throw new Error("Ese email ya es miembro del viaje.");
    }

    const { data: prev } = await context.supabase
      .from("trip_invitations")
      .select("id")
      .eq("trip_id", data.tripId)
      .eq("email", emailLower)
      .eq("status", "pending")
      .maybeSingle();

    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { logAccessAudit } = await import("@/lib/access-audit.server");
    const actorEmail = ((context.claims as any)?.email ?? null) as string | null;

    if (prev) {
      const { error } = await context.supabase
        .from("trip_invitations")
        .update({
          role: data.role,
          permissions: data.permissions ?? null,
          token,
          expires_at: expiresAt,
        })
        .eq("id", (prev as any).id);
      if (error) throw new Error(error.message);
      await logAccessAudit({
        action: "invitation_updated",
        actorId: context.userId,
        actorEmail,
        tripId: data.tripId,
        targetEmail: emailLower,
        details: { role: data.role, permissions: data.permissions ?? null, source: "global" },
      });
      return { ok: true as const, token, reused: true };
    }

    const { error } = await context.supabase.from("trip_invitations").insert({
      trip_id: data.tripId,
      email: emailLower,
      role: data.role,
      permissions: data.permissions ?? null,
      token,
      invited_by: context.userId,
      expires_at: expiresAt,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    await logAccessAudit({
      action: "invitation_created",
      actorId: context.userId,
      actorEmail,
      tripId: data.tripId,
      targetEmail: emailLower,
      details: { role: data.role, permissions: data.permissions ?? null, source: "global" },
    });
    return { ok: true as const, token, reused: false };
  });

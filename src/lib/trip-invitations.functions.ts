// Server functions para invitaciones a viajes por email + token.
// Solo el owner global puede crear/listar/revocar. Aceptar requiere estar
// autenticado con el mismo email que la invitación (o al menos con un email
// verificado que coincida, case-insensitive).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "owner",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo el owner puede gestionar invitaciones.");
}

function randomToken(): string {
  // 24 bytes base64url ~ 32 chars, sin colisiones prácticas.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const roleSchema = z.enum(["organizadora", "tour_leader"]);
const permsSchema = z.record(z.string(), z.boolean()).nullable().optional();

// ============= Listar invitaciones de un viaje =============
export const listTripInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("trip_invitations")
      .select("id, email, role, permissions, token, status, expires_at, accepted_at, created_at")
      .eq("trip_id", data.tripId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      email: r.email as string,
      role: r.role as "organizadora" | "tour_leader",
      permissions: (r.permissions as Record<string, boolean> | null) ?? null,
      token: r.token as string,
      status: r.status as "pending" | "accepted" | "revoked",
      expiresAt: r.expires_at as string,
      acceptedAt: (r.accepted_at as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  });

// ============= Crear invitación =============
export const createTripInvitation = createServerFn({ method: "POST" })
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
        .eq("user_id", prof.id as string)
        .maybeSingle();
      if (existing) throw new Error("Ese email ya es miembro del viaje.");
    }

    // Reutilizar / reciclar invitación pendiente previa
    const { data: prev } = await context.supabase
      .from("trip_invitations")
      .select("id")
      .eq("trip_id", data.tripId)
      .eq("email", emailLower)
      .eq("status", "pending")
      .maybeSingle();

    const token = randomToken();
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
        details: { role: data.role, permissions: data.permissions ?? null, source: "trip" },
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
      details: { role: data.role, permissions: data.permissions ?? null, source: "trip" },
    });
    return { ok: true as const, token, reused: false };
  });

// ============= Revocar invitación =============
export const revokeTripInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: inv } = await context.supabase
      .from("trip_invitations")
      .select("trip_id, email, role")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("trip_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    if (inv) {
      const { logAccessAudit } = await import("@/lib/access-audit.server");
      await logAccessAudit({
        action: "invitation_revoked",
        actorId: context.userId,
        actorEmail: ((context.claims as any)?.email ?? null) as string | null,
        tripId: (inv as any).trip_id as string,
        targetEmail: (inv as any).email as string,
        details: { role: (inv as any).role },
      });
    }
    return { ok: true as const };
  });

// ============= Ver detalles de una invitación por token (público-autenticado) =============
// El invitado debe estar autenticado; se valida via RLS (email en JWT coincide).
export const lookupTripInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    // Buscamos usando el cliente admin para poder leer aunque el email del usuario
    // aún no coincida, pero devolvemos meta segura + flag matchesEmail.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("trip_invitations")
      .select("id, trip_id, email, role, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) return { found: false as const };

    const { data: trip } = await supabaseAdmin
      .from("trips")
      .select("id, name, data")
      .eq("id", inv.trip_id as string)
      .maybeSingle();
    const tripName =
      (trip as any)?.name ??
      (trip?.data as any)?.tripInfo?.name ??
      (trip?.data as any)?.name ??
      "Viaje";

    const jwtEmail = ((context.claims as any)?.email ?? "").toString().toLowerCase();
    const invEmail = (inv.email as string).toLowerCase();

    const now = Date.now();
    const expired = new Date(inv.expires_at as string).getTime() < now;

    const { data: mem } = await supabaseAdmin
      .from("trip_members")
      .select("id")
      .eq("trip_id", inv.trip_id as string)
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      found: true as const,
      id: inv.id as string,
      tripId: inv.trip_id as string,
      tripName: tripName as string,
      email: inv.email as string,
      role: inv.role as "organizadora" | "tour_leader",
      status: inv.status as "pending" | "accepted" | "revoked",
      expired,
      matchesEmail: jwtEmail === invEmail,
      currentEmail: jwtEmail || null,
      isMember: Boolean(mem),
    };
  });


// ============= Aceptar invitación =============
export const acceptTripInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const jwtEmail = ((context.claims as any)?.email ?? "").toString().toLowerCase();
    if (!jwtEmail) throw new Error("Tu cuenta no tiene un email asociado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("trip_invitations")
      .select("id, trip_id, email, role, permissions, status, expires_at, accepted_by")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitación no encontrada.");
    if ((inv.email as string).toLowerCase() !== jwtEmail) {
      throw new Error(
        `Esta invitación es para ${inv.email}. Iniciá sesión con ese correo para aceptarla.`,
      );
    }
    if (inv.status === "accepted") {
      // Reapertura del enlace: si ya es miembro (o la aceptó esta misma cuenta),
      // no es un error — simplemente devolvemos el viaje.
      const { data: mem } = await supabaseAdmin
        .from("trip_members")
        .select("id")
        .eq("trip_id", inv.trip_id as string)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (mem || inv.accepted_by === context.userId) {
        return { ok: true as const, tripId: inv.trip_id as string };
      }
      throw new Error("Esta invitación ya fue aceptada por otra cuenta.");
    }
    if (inv.status !== "pending") {
      throw new Error("Esta invitación fue revocada.");
    }

    if (new Date(inv.expires_at as string).getTime() < Date.now()) {
      throw new Error("Esta invitación expiró. Pedile a la organizadora que te envíe una nueva.");
    }

    const tripId = inv.trip_id as string;

    // Asegurar profile para el nuevo usuario (por si el trigger no corrió).
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: context.userId, email: jwtEmail },
        { onConflict: "id" },
      );

    // Insertar en trip_members (usando admin: RLS de trip_members solo deja
    // a organizadoras / owners insertar; el invitado no cumple ese requisito).
    const { error: memErr } = await supabaseAdmin.from("trip_members").upsert(
      {
        trip_id: tripId,
        user_id: context.userId,
        role: inv.role,
        permissions: (inv.permissions as any) ?? null,
        invited_by: null,
      },
      { onConflict: "trip_id,user_id" },
    );
    if (memErr) throw new Error(memErr.message);

    const { error: updErr } = await supabaseAdmin
      .from("trip_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: context.userId,
      })
      .eq("id", inv.id as string);
    if (updErr) throw new Error(updErr.message);

    const { logAccessAudit } = await import("@/lib/access-audit.server");
    await logAccessAudit({
      action: "invitation_accepted",
      actorId: context.userId,
      actorEmail: jwtEmail,
      tripId,
      targetUserId: context.userId,
      targetEmail: jwtEmail,
      details: { role: inv.role, permissions: (inv.permissions as any) ?? null },
    });
    await logAccessAudit({
      action: "member_added",
      actorId: context.userId,
      actorEmail: jwtEmail,
      tripId,
      targetUserId: context.userId,
      targetEmail: jwtEmail,
      details: { role: inv.role, permissions: (inv.permissions as any) ?? null, via: "invitation" },
    });

    return { ok: true as const, tripId };
  });

// ============= Aceptar automáticamente invitaciones pendientes del email =============
// Se llama al iniciar sesión / entrar a la app. Cierra cualquier invitación
// `pending` no vencida cuyo email coincida con el de la cuenta, creando la
// membresía correspondiente. Idempotente y seguro: solo actúa sobre el email
// verificado del JWT del usuario que llama.
export const acceptMyPendingInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const jwtEmail = ((context.claims as any)?.email ?? "").toString().toLowerCase();
    if (!jwtEmail) return { accepted: [] as string[] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("trip_invitations")
      .select("id, trip_id, role, permissions")
      .eq("email", jwtEmail)
      .eq("status", "pending")
      .gt("expires_at", nowIso);
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { accepted: [] as string[] };

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: context.userId, email: jwtEmail }, { onConflict: "id" });

    const accepted: string[] = [];
    const { logAccessAudit } = await import("@/lib/access-audit.server");

    for (const inv of rows as any[]) {
      const { error: memErr } = await supabaseAdmin.from("trip_members").upsert(
        {
          trip_id: inv.trip_id as string,
          user_id: context.userId,
          role: inv.role,
          permissions: (inv.permissions as any) ?? null,
          invited_by: null,
        },
        { onConflict: "trip_id,user_id" },
      );
      if (memErr) continue;
      const { error: updErr } = await supabaseAdmin
        .from("trip_invitations")
        .update({ status: "accepted", accepted_at: nowIso, accepted_by: context.userId })
        .eq("id", inv.id as string)
        .eq("status", "pending");
      if (updErr) continue;
      accepted.push(inv.trip_id as string);
      await logAccessAudit({
        action: "invitation_accepted",
        actorId: context.userId,
        actorEmail: jwtEmail,
        tripId: inv.trip_id as string,
        targetUserId: context.userId,
        targetEmail: jwtEmail,
        details: { role: inv.role, via: "auto_on_login" },
      });
    }

    return { accepted };
  });

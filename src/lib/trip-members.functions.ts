// Gestión de miembros de viaje + permisos granulares.
// Solo el owner global puede listar/agregar/editar/quitar; RLS ya bloquea
// escrituras a no-owners pero re-verificamos en el handler para dar mensajes claros.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "owner" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo el owner puede gestionar miembros del viaje.");
}

const roleSchema = z.enum(["organizadora", "tour_leader"]);
const permsSchema = z.record(z.string(), z.boolean()).nullable().optional();

export const listTripMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("trip_members")
      .select("id, user_id, role, permissions, created_at")
      .eq("trip_id", data.tripId);
    if (error) throw new Error(error.message);
    const userIds = (rows ?? []).map((r) => r.user_id as string);
    let profiles: Record<string, { email: string | null; display_name: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds);
      for (const p of profs ?? []) {
        profiles[p.id as string] = {
          email: (p.email as string | null) ?? null,
          display_name: (p.display_name as string | null) ?? null,
        };
      }
    }
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      role: r.role as "organizadora" | "tour_leader",
      permissions: (r.permissions as Record<string, boolean> | null) ?? null,
      email: profiles[r.user_id as string]?.email ?? null,
      displayName: profiles[r.user_id as string]?.display_name ?? null,
    }));
  });

export const addTripMember = createServerFn({ method: "POST" })
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
    const { data: prof, error: profErr } = await context.supabase
      .from("profiles")
      .select("id, email")
      .eq("email", data.email.toLowerCase())
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);
    if (!prof) throw new Error("No hay una cuenta registrada con ese email.");
    const { error } = await context.supabase.from("trip_members").insert({
      trip_id: data.tripId,
      user_id: prof.id as string,
      role: data.role,
      permissions: data.permissions ?? null,
      invited_by: context.userId,
    });
    if (error) {
      if (error.message.toLowerCase().includes("duplicate")) {
        throw new Error("Ese usuario ya es miembro del viaje.");
      }
      throw new Error(error.message);
    }
    const { logAccessAudit } = await import("@/lib/access-audit.server");
    await logAccessAudit({
      action: "member_added",
      actorId: context.userId,
      actorEmail: ((context.claims as any)?.email ?? null) as string | null,
      tripId: data.tripId,
      targetUserId: prof.id as string,
      targetEmail: ((prof as any).email as string | null) ?? data.email.toLowerCase(),
      details: { role: data.role, permissions: data.permissions ?? null, via: "direct" },
    });
    return { ok: true as const };
  });

export const updateTripMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().min(1),
        role: roleSchema,
        permissions: permsSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: prev } = await context.supabase
      .from("trip_members")
      .select("trip_id, user_id, role, permissions")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("trip_members")
      .update({ role: data.role, permissions: data.permissions ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (prev) {
      const { logAccessAudit } = await import("@/lib/access-audit.server");
      await logAccessAudit({
        action: "member_updated",
        actorId: context.userId,
        actorEmail: ((context.claims as any)?.email ?? null) as string | null,
        tripId: (prev as any).trip_id as string,
        targetUserId: (prev as any).user_id as string,
        details: {
          from: { role: (prev as any).role, permissions: (prev as any).permissions ?? null },
          to: { role: data.role, permissions: data.permissions ?? null },
        },
      });
    }
    return { ok: true as const };
  });

export const removeTripMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: prev } = await context.supabase
      .from("trip_members")
      .select("trip_id, user_id, role, permissions")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("trip_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (prev) {
      const { logAccessAudit } = await import("@/lib/access-audit.server");
      await logAccessAudit({
        action: "member_removed",
        actorId: context.userId,
        actorEmail: ((context.claims as any)?.email ?? null) as string | null,
        tripId: (prev as any).trip_id as string,
        targetUserId: (prev as any).user_id as string,
        details: { role: (prev as any).role, permissions: (prev as any).permissions ?? null },
      });
    }
    return { ok: true as const };
  });

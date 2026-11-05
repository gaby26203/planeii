// Server functions para persistir viajes en Supabase.
// El store en memoria (Zustand) sigue siendo la fuente de verdad para la UI;
// estas funciones sincronizan cada viaje contra la fila correspondiente en
// `public.trips` — la columna `data` almacena el blob completo de TripData.
// RLS filtra la lectura por membresía. La base no deja a nadie actualizar `trips`
// directamente: `updateTripData` compara el blob nuevo con el guardado, valida los
// permisos efectivos del miembro (defaults del rol + overrides del owner) y recién
// entonces escribe con la clave de servicio.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalize, type TripPermMap } from "@/lib/trip-permissions";
import { requiredWriteScopes, writeScopeError } from "@/lib/trip-write-scopes";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const tripPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  destination: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  data: z.any(),
});

type TripPayload = z.infer<typeof tripPayloadSchema>;

function toRow(data: TripPayload) {
  const emptyToNull = (v: string | null | undefined) => (v && v.trim() ? v : null);
  return {
    name: data.name,
    destination: emptyToNull(data.destination),
    start_date: emptyToNull(data.startDate),
    end_date: emptyToNull(data.endDate),
    status: emptyToNull(data.status) ?? "planificando",
    data: data.data,
  };
}

// ── Helpers de permisos ────────────────────────────────────────────
async function loadEffectivePerms(
  supabase: any,
  userId: string,
  tripId: string,
): Promise<{
  isOwner: boolean;
  perms: TripPermMap | null;
  isMember: boolean;
  isTripOwner: boolean;
}> {
  const [ownerRes, tripRes, memberRes] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "owner" }),
    supabase.from("trips").select("owner_id").eq("id", tripId).maybeSingle(),
    supabase
      .from("trip_members")
      .select("role, permissions")
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const isOwner = !!ownerRes.data;
  const isTripOwner = tripRes.data?.owner_id === userId;
  if (!memberRes.data) {
    return { isOwner, perms: null, isMember: false, isTripOwner };
  }
  const role = memberRes.data.role as "organizadora" | "tour_leader";
  return {
    isOwner,
    perms: normalize(memberRes.data.permissions, role),
    isMember: true,
    isTripOwner,
  };
}

/**
 * Devuelve todos los viajes visibles para el usuario autenticado.
 * RLS ya filtra por membresía/ownership.
 */
export const listMyTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("trips")
      .select("id, name, destination, start_date, end_date, status, data")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id as string,
      name: r.name as string | null,
      destination: r.destination as string | null,
      startDate: r.start_date as string | null,
      endDate: r.end_date as string | null,
      status: r.status as string | null,
      data: r.data as JsonValue,
    }));
  });

/**
 * Crea un viaje. Solo el owner global puede hacerlo (RLS + verificación aquí).
 */
export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tripPayloadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isOwner, error: ownerErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (ownerErr) throw new Error(ownerErr.message);
    if (!isOwner) throw new Error("Solo el owner global puede crear viajes.");

    const { error: insertErr } = await context.supabase.from("trips").insert({
      id: data.id,
      owner_id: context.userId,
      ...toRow(data),
    });
    if (insertErr) throw new Error(insertErr.message);
    // `trip_members` solo se escribe desde el servidor; quien crea queda como organizadora.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: memberErr } = await supabaseAdmin.from("trip_members").insert({
      trip_id: data.id,
      user_id: context.userId,
      role: "organizadora",
      invited_by: context.userId,
    });
    if (memberErr && !memberErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(memberErr.message);
    }
    if (!memberErr) {
      const { logAccessAudit } = await import("@/lib/access-audit.server");
      await logAccessAudit({
        action: "member_added",
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | undefined)?.email ?? null,
        tripId: data.id,
        targetUserId: context.userId,
        details: { role: "organizadora", permissions: null, via: "trip_created" },
      });
    }
    return { ok: true as const };
  });

/**
 * Columnas de `trips` que repiten datos del blob. En un guardado salen del blob, no de los
 * campos sueltos del pedido, para que la lista de viajes no muestre otra cosa que el viaje.
 */
function rowFromBlob(data: TripPayload) {
  const blob = (data.data && typeof data.data === "object" ? data.data : {}) as Record<
    string,
    unknown
  >;
  const text = (v: unknown, fallback: string | null | undefined) =>
    typeof v === "string" ? v : fallback;
  return toRow({
    ...data,
    name: text(blob.name, data.name) || data.name,
    destination: text(blob.destination, data.destination),
    startDate: text(blob.startDate, data.startDate),
    endDate: text(blob.endDate, data.endDate),
    status: text(blob.status, data.status),
    data: { ...blob, id: data.id },
  });
}

/**
 * Guarda el blob completo de un viaje.
 * Compara contra el blob previo y valida que el miembro tenga los permisos
 * granulares necesarios para las secciones que cambiaron.
 */
export const updateTripData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tripPayloadSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Se lee con la sesión de quien guarda: si la RLS no le deja ver el viaje, no existe.
    const { data: existing, error: readErr } = await context.supabase
      .from("trips")
      .select("data")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!existing) throw new Error("Viaje no encontrado.");

    const { isOwner, perms, isMember, isTripOwner } = await loadEffectivePerms(
      context.supabase,
      context.userId,
      data.id,
    );

    if (!isOwner && !isTripOwner) {
      if (!isMember) throw new Error("No eres miembro de este viaje.");
      const denied = writeScopeError(requiredWriteScopes(existing.data, data.data), perms);
      if (denied) throw new Error(denied);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("trips").update(rowFromBlob(data)).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Elimina un viaje. Solo owner global u owner del viaje. */
export const deleteTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const [ownerRes, tripRes] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "owner" }),
      context.supabase.from("trips").select("owner_id").eq("id", data.id).maybeSingle(),
    ]);
    const isOwner = !!ownerRes.data;
    const isTripOwner = tripRes.data?.owner_id === context.userId;
    if (!isOwner && !isTripOwner) {
      throw new Error("Solo el owner puede eliminar un viaje.");
    }
    const { error } = await context.supabase.from("trips").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

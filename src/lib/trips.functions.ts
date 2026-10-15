// Server functions para persistir viajes en Supabase.
// El store en memoria (Zustand) sigue siendo la fuente de verdad para la UI;
// estas funciones sincronizan cada viaje contra la fila correspondiente en
// `public.trips` — la columna `data` almacena el blob completo de TripData.
// RLS filtra por membresía; el gating fino por acción se hace aquí abajo
// comparando el blob nuevo vs. el existente y validando los permisos
// efectivos del miembro (defaults del rol + overrides del owner).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalize, type TripPermKey, type TripPermMap } from "@/lib/trip-permissions";

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
  const emptyToNull = (v: string | null | undefined) =>
    v && v.trim() ? v : null;
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
): Promise<{ isOwner: boolean; perms: TripPermMap | null; isMember: boolean; isTripOwner: boolean }> {
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

// Diff coarse-grained: qué permisos requiere el cambio propuesto.
function requiredScopes(oldData: any, newData: any): TripPermKey[] {
  const scopes = new Set<TripPermKey>();
  const eq = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

  if (!eq(oldData?.itinerary, newData?.itinerary)) scopes.add("editar_itinerario");
  if (
    !eq(oldData?.costs, newData?.costs) ||
    !eq(oldData?.refundRules, newData?.refundRules) ||
    oldData?.pricePerPerson !== newData?.pricePerPerson ||
    oldData?.currency !== newData?.currency ||
    oldData?.capacity !== newData?.capacity
  ) {
    scopes.add("editar_costos");
  }
  if (oldData?.status !== newData?.status) scopes.add("marcar_operativo");
  if (!eq(oldData?.providers, newData?.providers)) scopes.add("editar_proveedores");

  // Metadata de nivel superior (nombre, destino, fechas, cover) requiere editar_costos.
  if (
    oldData?.name !== newData?.name ||
    oldData?.destination !== newData?.destination ||
    oldData?.startDate !== newData?.startDate ||
    oldData?.endDate !== newData?.endDate ||
    oldData?.coverGradient !== newData?.coverGradient
  ) {
    scopes.add("editar_costos");
  }

  // Enrollees (viajeras)
  const oldE: any[] = Array.isArray(oldData?.enrollees) ? oldData.enrollees : [];
  const newE: any[] = Array.isArray(newData?.enrollees) ? newData.enrollees : [];
  const oldById = new Map(oldE.map((e) => [e.id, e]));
  const newById = new Map(newE.map((e) => [e.id, e]));

  const added = [...newById.keys()].filter((k) => !oldById.has(k));
  const removed = [...oldById.keys()].filter((k) => !newById.has(k));
  if (added.length || removed.length) scopes.add("gestionar_viajeras");

  const stripDynamic = (e: any) => {
    const { installments: _i, extras: _x, ...rest } = e ?? {};
    return rest;
  };
  const stripInstPayments = (list: any[]) =>
    (list ?? []).map((i: any) => ({ ...i, payments: undefined }));
  const stripExtraStructure = (list: any[]) =>
    (list ?? []).map((x: any) => ({
      ...x,
      installments: (x.installments ?? []).map((i: any) => ({ ...i, payments: undefined })),
    }));
  const collectInstPayments = (list: any[]) =>
    JSON.stringify((list ?? []).map((i: any) => i.payments ?? []));
  const collectExtraPayments = (list: any[]) =>
    JSON.stringify(
      (list ?? []).map((x: any) =>
        (x.installments ?? []).map((i: any) => i.payments ?? []),
      ),
    );

  for (const [id, newEnr] of newById) {
    const oldEnr = oldById.get(id);
    if (!oldEnr) continue;

    if (!eq(stripDynamic(oldEnr), stripDynamic(newEnr))) scopes.add("gestionar_viajeras");

    const oldInst = oldEnr.installments ?? [];
    const newInst = newEnr.installments ?? [];
    if (!eq(stripInstPayments(oldInst), stripInstPayments(newInst))) {
      // Cambios estructurales en cuotas (crear plan, editar montos, etc.)
      scopes.add("gestionar_viajeras");
    }
    if (collectInstPayments(oldInst) !== collectInstPayments(newInst)) {
      scopes.add("registrar_pagos");
    }

    const oldEx = oldEnr.extras ?? [];
    const newEx = newEnr.extras ?? [];
    if (!eq(stripExtraStructure(oldEx), stripExtraStructure(newEx))) {
      scopes.add("editar_extras");
    }
    if (collectExtraPayments(oldEx) !== collectExtraPayments(newEx)) {
      scopes.add("registrar_pagos");
    }
  }

  return [...scopes];
}

function assertScopes(scopes: TripPermKey[], perms: TripPermMap | null) {
  if (scopes.length === 0) return;
  const missing = scopes.filter((s) => !perms?.[s]);
  if (missing.length > 0) {
    throw new Error(
      `No tenés permiso para: ${missing.join(", ")}. Pedile al owner que te habilite estos accesos.`,
    );
  }
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
    const { error: memberErr } = await context.supabase.from("trip_members").insert({
      trip_id: data.id,
      user_id: context.userId,
      role: "organizadora",
    });
    if (memberErr && !memberErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(memberErr.message);
    }
    return { ok: true as const };
  });

/**
 * Guarda el blob completo de un viaje.
 * Compara contra el blob previo y valida que el miembro tenga los permisos
 * granulares necesarios para las secciones que cambiaron.
 */
export const updateTripData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => tripPayloadSchema.parse(input))
  .handler(async ({ data, context }) => {
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
      if (!isMember) throw new Error("No sos miembro de este viaje.");
      const scopes = requiredScopes(existing.data, data.data);
      assertScopes(scopes, perms);
    }

    const { error } = await context.supabase
      .from("trips")
      .update(toRow(data))
      .eq("id", data.id);
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

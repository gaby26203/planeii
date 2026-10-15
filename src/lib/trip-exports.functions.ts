// Server functions para generar exports (PDF/XLSX) del viaje.
// La generación corre en el servidor: RLS filtra que el usuario sea miembro
// del viaje y validamos el permiso granular `ver_finanzas` antes de incluir
// la sección de análisis financiero.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalize } from "@/lib/trip-permissions";

const inputSchema = z.object({
  tripId: z.string().min(1),
  format: z.enum(["pdf", "xlsx"]),
  includeFinance: z.boolean().optional(),
});

function toBase64(bytes: Uint8Array): string {
  // Worker runtime (nodejs_compat) exposes Buffer.
  return Buffer.from(bytes).toString("base64");
}

async function canSeeFinance(supabase: any, userId: string, tripId: string): Promise<boolean> {
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
  if (ownerRes.data) return true;
  if (tripRes.data?.owner_id === userId) return true;
  if (!memberRes.data) return false;
  const perms = normalize(memberRes.data.permissions, memberRes.data.role);
  return perms.ver_finanzas === true;
}

export const generateTripExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // RLS filtra: solo miembros del viaje ven la fila.
    const { data: row, error } = await context.supabase
      .from("trips")
      .select("id, name, data")
      .eq("id", data.tripId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Viaje no encontrado o sin acceso.");

    const requested = data.includeFinance !== false;
    const allowedFinance = requested
      ? await canSeeFinance(context.supabase, context.userId, data.tripId)
      : false;

    const { buildTripPDF, buildTripXLSX } = await import("./trip-exports.server");
    // La columna `name` es la fuente de verdad del nombre (se actualiza junto
    // con el blob); evita títulos/archivos desactualizados en el export.
    const trip = { ...(row.data as any), name: (row as any).name ?? (row.data as any)?.name };
    const built =
      data.format === "pdf"
        ? buildTripPDF(trip, { includeFinance: allowedFinance })
        : buildTripXLSX(trip, { includeFinance: allowedFinance });

    return {
      filename: built.filename,
      mime: data.format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: toBase64(built.bytes),
      financeIncluded: allowedFinance,
      financeRequested: requested,
    };
  });

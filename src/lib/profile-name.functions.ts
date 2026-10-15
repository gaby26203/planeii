// Nombre para mostrar: cada usuaria edita el suyo; la dueña de la cuenta puede
// corregir el de cualquier miembro de viaje (organizadora / tour leader).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const nameSchema = z
  .string()
  .trim()
  .min(1, "El nombre no puede estar vacío")
  .max(60, "Máximo 60 caracteres");

export const getMyDisplayName = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      displayName: (data?.display_name as string | null) ?? null,
      email: (data?.email as string | null) ?? null,
    };
  });

export const updateMyDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ displayName: nameSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ display_name: data.displayName })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, displayName: data.displayName };
  });

export const updateMemberDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), displayName: nameSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isOwner, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isOwner) throw new Error("Solo la dueña de la cuenta puede editar el nombre de un miembro.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.displayName })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, displayName: data.displayName };
  });

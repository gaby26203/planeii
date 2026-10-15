// Server functions para cargar y actualizar las plantillas por usuario.
// Los defaults viven en public.account_defaults (un registro por usuario).
// Si el usuario nunca los tocó, devolvemos los valores de fábrica sin crear
// la fila; se crea al primer guardado explícito.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  FACTORY_DEFAULTS,
  type AccountDefaults,
  type PaymentMethodFeeDefaults,
  type CostPreset,
  type ExtraPreset,
} from "./factory-defaults";
import type { RefundRule } from "./finance-types";

const refundRuleSchema = z.object({
  id: z.string(),
  daysBefore: z.number(),
  percent: z.number(),
  notes: z.string().optional(),
});

const feeSchema = z.object({
  feePercent: z.number(),
  feeFixed: z.number(),
  feeDescription: z.string(),
});

const costPresetSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: z.enum(["fijo", "variable", "equipo", "no_incluido"]),
  notes: z.string(),
  defaultAmount: z.number().optional(),
});

const extraPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  suggestedPrice: z.number().optional(),
  suggestedCost: z.number().optional(),
  notes: z.string().optional(),
});

const defaultsSchema = z.object({
  refundRules: z.array(refundRuleSchema),
  paymentMethodFees: z.record(z.string(), feeSchema),
  costPresets: z.array(costPresetSchema),
  extraPresets: z.array(extraPresetSchema),
});

function normalize(row: any): AccountDefaults {
  return {
    refundRules: Array.isArray(row?.refund_rules) && row.refund_rules.length > 0
      ? (row.refund_rules as RefundRule[])
      : FACTORY_DEFAULTS.refundRules,
    paymentMethodFees:
      row?.payment_method_fees && Object.keys(row.payment_method_fees).length > 0
        ? (row.payment_method_fees as PaymentMethodFeeDefaults)
        : FACTORY_DEFAULTS.paymentMethodFees,
    costPresets: Array.isArray(row?.cost_presets) && row.cost_presets.length > 0
      ? (row.cost_presets as CostPreset[])
      : FACTORY_DEFAULTS.costPresets,
    extraPresets: Array.isArray(row?.extra_presets) && row.extra_presets.length > 0
      ? (row.extra_presets as ExtraPreset[])
      : FACTORY_DEFAULTS.extraPresets,
  };
}

export const getAccountDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("account_defaults")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return normalize(data);
  });

export const saveAccountDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => defaultsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      user_id: userId,
      refund_rules: data.refundRules,
      payment_method_fees: data.paymentMethodFees,
      cost_presets: data.costPresets,
      extra_presets: data.extraPresets,
    };
    const { error } = await supabase
      .from("account_defaults")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

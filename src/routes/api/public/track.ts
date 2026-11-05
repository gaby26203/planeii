import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isInternalTripAnalyticsActor } from "@/lib/trip-analytics-access";

const payloadSchema = z.object({
  tripId: z.string().uuid(),
  event: z.enum(["view", "click", "form_start", "form_submit"]),
  target: z.string().max(200).optional(),
  device: z.enum(["celular", "computadora"]).optional(),
  referrer: z.string().max(60).optional(),
});

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof payloadSchema>;
        try {
          payload = payloadSchema.parse(await request.json());
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const url = process.env["SUPABASE_URL"]!;
        const createServerClient = (authorization?: string) => createClient<Database>(url, key, {
          auth: { persistSession: false },
          global: {
            ...(authorization ? { headers: { Authorization: authorization } } : {}),
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const supabasePublic = createServerClient();

        const authorization = request.headers.get("authorization");
        if (authorization) {
          const match = authorization.match(/^Bearer\s+(.+)$/i);
          if (!match) return new Response("Invalid authorization", { status: 401 });
          const token = match[1];
          if (!token) return new Response("Invalid authorization", { status: 401 });
          const supabaseUser = createServerClient(`Bearer ${token}`);
          const { data: authData, error: authError } = await supabaseUser.auth.getUser(token);
          if (authError || !authData.user) return new Response("Invalid authorization", { status: 401 });

          const [tripResult, membershipResult] = await Promise.all([
            supabaseUser.from("trips").select("owner_id").eq("id", payload.tripId).maybeSingle(),
            supabaseUser
              .from("trip_members")
              .select("user_id, role")
              .eq("trip_id", payload.tripId)
              .eq("user_id", authData.user.id),
          ]);
          if (tripResult.error || membershipResult.error) {
            return new Response("Could not verify analytics actor", { status: 500 });
          }
          if (
            isInternalTripAnalyticsActor({
              userId: authData.user.id,
              ownerId: tripResult.data?.owner_id ?? null,
              memberships: (membershipResult.data ?? []).map((membership) => ({
                userId: membership.user_id,
                role: membership.role,
              })),
            })
          ) {
            return new Response("ignored", { status: 202 });
          }
        }

        const country =
          request.headers.get("cf-ipcountry") ??
          request.headers.get("x-vercel-ip-country") ??
          request.headers.get("x-country-code") ??
          null;

        const { error } = await supabasePublic.from("trip_page_events").insert({
          trip_id: payload.tripId,
          event: payload.event,
          target: payload.target ?? null,
          country: country && country !== "XX" ? country : null,
          device: payload.device ?? null,
          referrer: payload.referrer ?? null,
        });
        if (error) return new Response("Could not track", { status: 500 });
        return new Response("ok");
      },
    },
  },
});

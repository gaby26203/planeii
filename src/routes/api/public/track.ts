import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isInternalTripAnalyticsActor } from "@/lib/trip-analytics-access";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

// Una visita real genera una vista y unos pocos clics. Más que esto desde la misma IP y para el
// mismo viaje en cinco minutos no se cuenta.
const limiter = createRateLimiter({ limit: 40, windowMs: 5 * 60 * 1000 });

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

        // Sin IP (un proxy que no la informa) no se limita: todas las visitas caerían en la misma
        // cuenta y se dejaría de contar a todo el mundo. En Cloudflare siempre viene.
        const ip = clientIp(request.headers);
        if (ip && !limiter.hit(`${ip}|${payload.tripId}`)) {
          return new Response("Too many events", { status: 429 });
        }

        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const url = process.env["SUPABASE_URL"]!;
        const createServerClient = (authorization?: string) =>
          createClient<Database>(url, key, {
            auth: { persistSession: false },
            global: {
              ...(authorization ? { headers: { Authorization: authorization } } : {}),
              fetch: (input, init) => {
                const h = new Headers(init?.headers);
                if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
                  h.delete("Authorization");
                h.set("apikey", key);
                return fetch(input, { ...init, headers: h });
              },
            },
          });

        const authorization = request.headers.get("authorization");
        if (authorization) {
          const match = authorization.match(/^Bearer\s+(.+)$/i);
          if (!match) return new Response("Invalid authorization", { status: 401 });
          const token = match[1];
          if (!token) return new Response("Invalid authorization", { status: 401 });
          const supabaseUser = createServerClient(`Bearer ${token}`);
          const { data: authData, error: authError } = await supabaseUser.auth.getUser(token);
          if (authError || !authData.user)
            return new Response("Invalid authorization", { status: 401 });

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

        // Solo esta ruta escribe eventos: la base no acepta INSERT de anon ni de authenticated.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: page, error: pageError } = await supabaseAdmin
          .from("trip_pages")
          .select("trip_id")
          .eq("trip_id", payload.tripId)
          .limit(1)
          .maybeSingle();
        if (pageError) return new Response("Could not track", { status: 500 });
        if (!page) return new Response("Unknown page", { status: 404 });

        const { error } = await supabaseAdmin.from("trip_page_events").insert({
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

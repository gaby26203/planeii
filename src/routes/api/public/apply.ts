import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { normalizeEditorDocument, type EditorDocument } from "@/lib/trip-editor";
import { NEUTRAL_TRIP_DATA } from "@/data/neutral-trip";
import { formatAnswer, validateAnswers } from "@/lib/booking-form";

const payloadSchema = z.object({
  slug: z.string().min(1).max(120),
  fullName: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().regex(/^\+\d{7,16}$/),
  email: z.string().trim().toLowerCase().email().max(255),
  answers: z.record(z.string().max(40), z.unknown()).default({}),
  consent: z.boolean().default(false),
  website: z.string().max(0).optional(), // campo trampa anti-spam: debe venir vacío
  utm: z
    .object({
      source: z.string().max(120).optional(),
      medium: z.string().max(120).optional(),
      campaign: z.string().max(160).optional(),
    })
    .default({}),
  referrer: z.string().max(200).optional(),
});

const fail = (message: string, status = 400) => Response.json({ ok: false, error: message }, { status });

export const Route = createFileRoute("/api/public/apply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: z.infer<typeof payloadSchema>;
        try {
          payload = payloadSchema.parse(await request.json());
        } catch {
          return fail("Revisá los datos: nombre, WhatsApp con código de país y correo válido.");
        }
        if (payload.website) return Response.json({ ok: true }); // bot: fingimos éxito

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: page, error: pageError } = await supabaseAdmin
          .from("trip_pages")
          .select("trip_id, slug, document")
          .eq("slug", payload.slug)
          .maybeSingle();
        if (pageError) return fail("No se pudo enviar la solicitud. Intentá de nuevo.", 500);
        if (!page) return fail("Este viaje no existe.", 404);

        const document = normalizeEditorDocument(page.document as unknown as EditorDocument, NEUTRAL_TRIP_DATA);
        const form = document.bookingForm;
        if (!form || form.mode !== "internal") return fail("Este viaje no recibe solicitudes aquí.", 409);
        if (form.consent.enabled && !payload.consent) return fail("Necesitamos tu aceptación para contactarte.");

        const checked = validateAnswers(form, payload.answers);
        if ("error" in checked) return fail(checked.error);

        // Freno simple de abuso: máximo 3 envíos por persona cada 10 minutos y 30 por viaje por minuto.
        const tenMin = new Date(Date.now() - 10 * 60000).toISOString();
        const oneMin = new Date(Date.now() - 60000).toISOString();
        const [{ count: personCount }, { count: tripCount }] = await Promise.all([
          supabaseAdmin
            .from("trip_applications")
            .select("id", { count: "exact", head: true })
            .eq("trip_id", page.trip_id)
            .or(`email.eq.${payload.email},whatsapp.eq.${payload.whatsapp}`)
            .gte("created_at", tenMin),
          supabaseAdmin
            .from("trip_applications")
            .select("id", { count: "exact", head: true })
            .eq("trip_id", page.trip_id)
            .gte("created_at", oneMin),
        ]);
        if ((personCount ?? 0) >= 3 || (tripCount ?? 0) >= 30) return fail("Ya recibimos tu solicitud. Te contactaremos pronto.", 429);

        // Posible duplicado: misma persona (email o WhatsApp) en el mismo viaje. No bloquea.
        const { data: previous } = await supabaseAdmin
          .from("trip_applications")
          .select("id")
          .eq("trip_id", page.trip_id)
          .or(`email.eq.${payload.email},whatsapp.eq.${payload.whatsapp}`)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        const { data: inserted, error } = await supabaseAdmin.from("trip_applications").insert({
          trip_id: page.trip_id,
          page_slug: page.slug,
          full_name: payload.fullName,
          whatsapp: payload.whatsapp,
          email: payload.email,
          answers: checked.answers as never,
          form_snapshot: { title: form.title, blocks: form.blocks } as never,
          consent_accepted: payload.consent,
          consent_text: form.consent.enabled ? form.consent.text : null,
          utm_source: payload.utm.source || null,
          utm_medium: payload.utm.medium || null,
          utm_campaign: payload.utm.campaign || null,
          referrer: payload.referrer || null,
          duplicate_of: previous?.id ?? null,
        }).select("id").single();
        if (error || !inserted) {
          console.error("apply insert failed", error);
          return fail("No se pudo enviar la solicitud. Intentá de nuevo.", 500);
        }

        // Correos: la solicitud ya quedó guardada; un fallo de envío nunca la afecta.
        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const { organizerRecipientIds } = await import("@/lib/application-recipients");
          const origin = new URL(request.url).origin;
          const [{ data: trip }, { data: members }] = await Promise.all([
            supabaseAdmin.from("trips").select("name, owner_id").eq("id", page.trip_id).single(),
            supabaseAdmin.from("trip_members").select("user_id, role").eq("trip_id", page.trip_id),
          ]);
          const tripName = document.trip?.title || trip?.name || "tu viaje";
          const ids = trip ? organizerRecipientIds(trip.owner_id, members ?? []) : [];
          const { data: profiles } = ids.length
            ? await supabaseAdmin.from("profiles").select("id, email").in("id", ids)
            : { data: [] as { id: string; email: string | null }[] };
          const answers = (checked.answers as { label: string }[]).map((a) => ({ label: a.label, value: formatAnswer(a as never) }));
          const source = [payload.utm.source, payload.utm.medium, payload.utm.campaign].filter(Boolean).join(" · ") || payload.referrer || "";
          const sends = (profiles ?? []).filter((p) => p.email).map((p) =>
            sendTemplateEmail("application-organizer", p.email!, {
              idempotencyKey: `app-${inserted.id}-org-${p.id}`,
              replyTo: payload.email,
              templateData: {
                tripName, fullName: payload.fullName, whatsapp: payload.whatsapp, email: payload.email, answers, source,
                duplicate: Boolean(previous?.id),
                panelUrl: `${origin}/viajes/${page.trip_id}/solicitudes`,
                whatsappUrl: `https://wa.me/${payload.whatsapp.replace(/\D/g, "")}`,
              },
            }),
          );
          sends.push(
            sendTemplateEmail("application-traveler", payload.email, {
              idempotencyKey: `app-${inserted.id}-traveler`,
              templateData: {
                tripName, firstName: payload.fullName.split(" ")[0],
                title: form.thanks.title, message: form.thanks.message, steps: form.thanks.steps,
                tripUrl: `${origin}/v/${page.slug}`,
              },
            }),
          );
          const results = await Promise.allSettled(sends);
          results.forEach((r) => r.status === "rejected" && console.error("application email failed", r.reason));
        } catch (e) {
          console.error("application emails failed", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});

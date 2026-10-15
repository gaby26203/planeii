/** Registro de visitas y clics de la landing publicada. Sin datos personales. */

export type TripEventType = "view" | "click" | "form_start" | "form_submit";

function classifyReferrer(ref: string): string {
  if (!ref) return "directo";
  const r = ref.toLowerCase();
  if (r.includes("instagram")) return "instagram";
  if (r.includes("wa.me") || r.includes("whatsapp")) return "whatsapp";
  if (r.includes("google")) return "google";
  if (r.includes("facebook") || r.includes("fb.")) return "facebook";
  if (r.includes("tiktok")) return "tiktok";
  try {
    if (new URL(ref).origin === window.location.origin) return "directo";
  } catch {
    /* ignore */
  }
  return "otro";
}

function classifyDevice(): string {
  return window.matchMedia("(max-width: 768px)").matches ? "celular" : "computadora";
}

/** Envía un evento de la landing publicada. Nunca lanza: las métricas no deben romper la página. */
export function trackTripEvent(tripId: string, event: TripEventType, target?: string) {
  void (async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      fetch("/api/public/track", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tripId,
          event,
          target: target?.slice(0, 200),
          device: classifyDevice(),
          referrer: classifyReferrer(document.referrer),
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  })();
}

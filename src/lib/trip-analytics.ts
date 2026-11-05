/** Registro de visitas y clics de la landing publicada. Sin datos personales. */

export type TripEventType = "view" | "click" | "form_start" | "form_submit";

/**
 * `target` de un clic en un botón de la landing. Las métricas cuentan como reserva solo los
 * botones que llevan al formulario o a un enlace; los que bajan a una sección ("Ver itinerario")
 * son navegación. Los clics de la barra de anuncio se cuentan aparte.
 */
export type LandingClickTarget = "announcement" | "booking" | "section";

export function classifyLandingClick({
  inAnnouncement,
  ctaTarget,
}: {
  inAnnouncement: boolean;
  ctaTarget?: "form" | "url" | "section";
}): LandingClickTarget {
  if (inAnnouncement) return "announcement";
  return ctaTarget === "section" ? "section" : "booking";
}

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

// La sesión solo sirve para que el servidor descarte las visitas del equipo del viaje. Se resuelve
// una vez, con la primera visita: así los clics se envían de forma síncrona y la petición sale antes
// de que el botón navegue a otra página. Antes cada clic esperaba la sesión y se perdía al navegar.
let authHeader: Record<string, string> | null = null;
let authPromise: Promise<Record<string, string>> | null = null;

function loadAuthHeader(): Promise<Record<string, string>> {
  authPromise ??= import("@/integrations/supabase/client")
    .then(({ supabase }) => supabase.auth.getSession())
    .then(({ data }) => {
      const token = data.session?.access_token;
      authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      return authHeader;
    })
    .catch(() => (authHeader = {}));
  return authPromise;
}

/** Envía un evento de la landing publicada. Nunca lanza: las métricas no deben romper la página. */
export function trackTripEvent(tripId: string, event: TripEventType, target?: string) {
  try {
    const body = JSON.stringify({
      tripId,
      event,
      target: target?.slice(0, 200),
      device: classifyDevice(),
      referrer: classifyReferrer(document.referrer),
    });
    const send = (headers: Record<string, string>) =>
      fetch("/api/public/track", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body,
        keepalive: true,
      }).catch(() => {});
    if (authHeader) void send(authHeader);
    else void loadAuthHeader().then(send);
  } catch {
    /* ignore */
  }
}

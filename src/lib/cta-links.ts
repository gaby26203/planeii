import type { BookingForm } from "@/lib/booking-form";
import { safeTextLink } from "@/lib/inline-text";

/**
 * Destino de un botón CTA. Un único modelo para todos los botones de la landing
 * (actuales y futuros), guardado por ctaId estable en `document.ctaLinks`.
 */
export type CtaTarget = "form" | "url" | "section";
/** Estilo propio de un botón (p. ej. el secundario de la portada), independiente del estilo de la sección. */
export type CtaButtonStyle = {
  background?: string;
  text?: string;
  variant?: "solid" | "outline" | "text";
  shape?: "square" | "rounded" | "pill";
};
export type CtaLink = {
  target?: CtaTarget;
  url?: string;
  newTab?: boolean;
  /** Clave estable de la sección destino (nunca su nombre visible). */
  sectionId?: string;
  /** Texto propio del botón; sin él usa el texto original compartido. */
  label?: string;
  /** Estilo visual propio del botón; sin él hereda el de la sección. */
  style?: CtaButtonStyle;
};

type CtaDoc = {
  trip: { bookingUrl: string };
  announcement: { url: string };
  bookingForm?: Pick<BookingForm, "mode" | "externalUrl">;
  sectionOrder: string[];
  hiddenSections: string[];
  ctaLinks?: Record<string, CtaLink>;
};

export type CtaGroup = "hero" | "included" | "itinerary" | "booking" | "final" | "announcement";
export type CtaDefinition = { id: string; label: string; group: CtaGroup };

/** Botones existentes con id fijo. Botones nuevos usan newCtaId(). */
export const CTA_DEFINITIONS: CtaDefinition[] = [
  { id: "hero", label: "Portada · Botón principal", group: "hero" },
  { id: "heroItinerary", label: "Portada · Botón secundario", group: "hero" },
  { id: "nav", label: "Menú · Botón", group: "hero" },
  { id: "included", label: "Qué incluye · Botón", group: "included" },
  { id: "itinerary", label: "Itinerario · Botón", group: "itinerary" },
  { id: "booking", label: "Precio y reserva · Botón", group: "booking" },
  { id: "final", label: "Cierre final · Botón", group: "final" },
  { id: "announcement", label: "Anuncio fijo · Botón", group: "announcement" },
];

/** Parámetros de atribución que Planeii reenvía al formulario interno. */
export const ATTRIBUTION_PARAMS = ["ref", "src", "source", "gclid", "fbclid", "ttclid", "msclkid", "campaign_id"];

export function attributionSearch(search = "") {
  const incoming = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out = new URLSearchParams();
  incoming.forEach((value, key) => {
    if (key.startsWith("utm_") || ATTRIBUTION_PARAMS.includes(key)) out.append(key, value);
  });
  const text = out.toString();
  return text ? `?${text}` : "";
}

export const sectionAnchorId = (sectionId: string) => `seccion-${sectionId}`;

export function newCtaId() {
  return `cta_${Math.random().toString(36).slice(2, 10)}`;
}

/** Configuración por defecto (heredada) cuando el botón no tiene una propia. */
export function defaultCtaLink(doc: CtaDoc, ctaId: string): CtaLink & { target: CtaTarget } {
  if (ctaId === "heroItinerary") return { target: "section", sectionId: "itinerary" };
  if (ctaId === "announcement") return { target: "url", url: doc.announcement.url };
  if (doc.bookingForm?.mode === "internal") return { target: "form" };
  return { target: "url", url: doc.bookingForm?.externalUrl?.trim() || doc.trip.bookingUrl };
}

export function effectiveCtaLink(doc: CtaDoc, ctaId: string): CtaLink & { target: CtaTarget } {
  // "navMobile" quedó unificado con "nav": una sola configuración para escritorio y móvil.
  const id = ctaId === "navMobile" ? "nav" : ctaId;
  const own = doc.ctaLinks?.[id] ?? (id === "nav" ? doc.ctaLinks?.navMobile : undefined);
  return own?.target ? (own as CtaLink & { target: CtaTarget }) : { ...defaultCtaLink(doc, id), label: own?.label };
}

const isPlaceholder = (value: string) => /\[.*\]/.test(value);

function safeCtaUrl(value?: string) {
  const url = value?.trim();
  if (!url || isPlaceholder(url)) return undefined;
  return safeTextLink(url);
}

export type CtaWarning = "form-not-configured" | "form-no-slug" | "section-hidden" | "section-missing" | "url-invalid";
export type ResolvedCta = { href: string; newTab: boolean; warning?: CtaWarning };

/**
 * Único resolvedor de destino para todos los CTA. Nunca devuelve un enlace roto:
 * si el destino elegido no es válido, cae a la sección de reserva o al enlace general.
 */
export function resolveCtaLink(doc: CtaDoc, ctaId: string, { slug, search = "" }: { slug?: string | null; search?: string }): ResolvedCta {
  const link = effectiveCtaLink(doc, ctaId);
  const fallback = (): string => {
    if (doc.bookingForm?.mode === "internal" && slug) return `/v/${slug}/reservar${attributionSearch(search)}`;
    const general = safeCtaUrl(doc.bookingForm?.mode === "internal" ? doc.trip.bookingUrl : doc.bookingForm?.externalUrl || doc.trip.bookingUrl);
    if (general) return general;
    return doc.hiddenSections.includes("booking") ? "#top" : `#${sectionAnchorId("booking")}`;
  };
  if (link.target === "form") {
    if (doc.bookingForm?.mode !== "internal") return { href: fallback(), newTab: false, warning: "form-not-configured" };
    if (!slug) return { href: `#${sectionAnchorId("booking")}`, newTab: false, warning: "form-no-slug" };
    return { href: `/v/${slug}/reservar${attributionSearch(search)}`, newTab: false };
  }
  if (link.target === "section") {
    const id = link.sectionId ?? "";
    if (!doc.sectionOrder.includes(id)) return { href: fallback(), newTab: false, warning: "section-missing" };
    if (doc.hiddenSections.includes(id)) return { href: fallback(), newTab: false, warning: "section-hidden" };
    return { href: `#${sectionAnchorId(id)}`, newTab: false };
  }
  const url = safeCtaUrl(link.url);
  if (!url) return { href: fallback(), newTab: false, warning: "url-invalid" };
  return { href: url, newTab: Boolean(link.newTab) && !url.startsWith("#") };
}

export const CTA_WARNING_TEXT: Record<CtaWarning, string> = {
  "form-not-configured": "Apunta al formulario interno, pero el formulario de Planeii no está activado (pestaña Formulario).",
  "form-no-slug": "Apunta al formulario interno; el enlace se crea al publicar la página.",
  "section-hidden": "Apunta a una sección oculta.",
  "section-missing": "Apunta a una sección que ya no existe.",
  "url-invalid": "La URL está vacía o no es válida.",
};

/** Advertencias de todos los CTA configurados. `form-no-slug` no bloquea: se resuelve al publicar. */
export function ctaWarnings(doc: CtaDoc, slug?: string | null) {
  const ids = new Set([...CTA_DEFINITIONS.map((item) => item.id), ...Object.keys(doc.ctaLinks ?? {})]);
  const out: Array<{ ctaId: string; label: string; warning: CtaWarning; message: string }> = [];
  ids.forEach((ctaId) => {
    const { warning } = resolveCtaLink(doc, ctaId, { slug: slug ?? "pendiente" });
    if (!warning) return;
    const label = CTA_DEFINITIONS.find((item) => item.id === ctaId)?.label ?? `Botón ${ctaId}`;
    out.push({ ctaId, label, warning, message: CTA_WARNING_TEXT[warning] });
  });
  return out;
}

export function normalizeCtaLinks(value: unknown): Record<string, CtaLink> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, CtaLink> = {};
  for (const [id, raw] of Object.entries(value as Record<string, Partial<CtaLink>>)) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || !raw || typeof raw !== "object") continue;
    const link = {} as CtaLink;
    if (raw.target === "form" || raw.target === "url" || raw.target === "section") link.target = raw.target;
    if (typeof raw.url === "string") link.url = raw.url;
    if (typeof raw.newTab === "boolean") link.newTab = raw.newTab;
    if (typeof raw.sectionId === "string") link.sectionId = raw.sectionId;
    if (typeof raw.label === "string") link.label = raw.label;
    if (raw.style && typeof raw.style === "object") {
      const style = {} as CtaButtonStyle;
      const rawStyle = raw.style as Partial<CtaButtonStyle>;
      if (typeof rawStyle.background === "string") style.background = rawStyle.background;
      if (typeof rawStyle.text === "string") style.text = rawStyle.text;
      if (rawStyle.variant === "solid" || rawStyle.variant === "outline" || rawStyle.variant === "text") style.variant = rawStyle.variant;
      if (rawStyle.shape === "square" || rawStyle.shape === "rounded" || rawStyle.shape === "pill") style.shape = rawStyle.shape;
      if (Object.keys(style).length) link.style = style;
    }
    if (link.target || link.label !== undefined || link.style) out[id] = link;
  }
  return out;
}

/** Aplica un mismo destino a todos los botones de reserva (no toca el secundario "Ver itinerario"). */
export function applyToBookingCtas(links: Record<string, CtaLink> | undefined, link: CtaLink) {
  const out = { ...links };
  for (const item of CTA_DEFINITIONS) {
    if (item.id === "heroItinerary") continue;
    out[item.id] = { ...out[item.id], ...link };
  }
  return out;
}

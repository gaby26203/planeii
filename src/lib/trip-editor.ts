import { normalizeCtaLinks, type CtaLink } from "@/lib/cta-links";
import { OAXACA_LEGACY_DATA, type TripAnnouncement, type TripData } from "@/data/trip";
import type { CSSProperties } from "react";
import { defaultBookingForm, normalizeBookingForm, type BookingForm } from "@/lib/booking-form";
import { normalizeInlineText, type InlineText } from "@/lib/inline-text";

export type ThemePreset = "oaxaca" | "pacific" | "botanical";
export type FontPreset = "editorial" | "modern" | "classic";
export type ScalePreset = "compact" | "balanced" | "editorial";
export type ButtonPreset = "solid" | "outline" | "quiet";
export type TextRole = "inherit" | "label" | "body" | "subtitle" | "sectionTitle" | "display";
export type TextAlign = "inherit" | "left" | "center" | "right";
export type TextLeading = "compact" | "normal" | "relaxed";

export type TextStyle = {
  inline?: InlineText;
  color?: string;
  role?: TextRole;
  bold?: boolean;
  italic?: boolean;
  align?: TextAlign;
  leading?: TextLeading;
  href?: string;
};

export type SectionKey =
  | "story"
  | "highlights"
  | "testimonials"
  | "included"
  | "itinerary"
  | "accommodation"
  | "host"
  | "traveler"
  | "faq"
  | "booking"
  | "gallery";

export type EditorTheme = {
  palette: ThemePreset;
  fonts: FontPreset;
  scale: ScalePreset;
  buttons: ButtonPreset;
  customColors?: ThemeColors;
};

export type ThemeColors = {
  background: string;
  heading: string;
  text: string;
  muted: string;
  accent: string;
  button: string;
};

export type SectionStyle = Partial<Pick<ThemeColors, "background" | "heading" | "text" | "accent">> & {
  spacing?: "compact" | "normal" | "spacious";
  align?: "inherit" | "left" | "center";
  buttonBackground?: string;
  buttonText?: string;
  buttonVariant?: "solid" | "outline" | "text";
  buttonShape?: "square" | "rounded" | "pill";
};

export type EditorDocument = {
  version: 4;
  /**
   * TRANSITORIO: solo la landing de Oaxaca lleva "oaxaca-legacy" y usa OAXACA_LEGACY_DATA
   * como relleno. Cualquier otro documento (sin marca) se completa con la base neutra.
   */
  contentBase?: "oaxaca-legacy";
  trip: TripData;
  announcement: TripAnnouncement;
  theme: EditorTheme;
  sectionOrder: SectionKey[];
  hiddenSections: SectionKey[];
  sectionStyles: Partial<Record<SectionKey | "hero" | "meta" | "final" | "announcement", SectionStyle>>;
  textStyles: Record<string, TextStyle>;
  /** Formulario de solicitud del viaje (botón Reservar). */
  bookingForm?: BookingForm;
  /** Destino y texto propio de cada CTA por ctaId estable. */
  ctaLinks?: Record<string, CtaLink>;
};

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  "story",
  "highlights",
  "itinerary",
  "included",
  "accommodation",
  "booking",
  "testimonials",
  "host",
  "traveler",
  "faq",
  "gallery",
];

export const SECTION_LABELS: Record<SectionKey, string> = {
  story: "Historia del viaje",
  highlights: "Experiencias",
  testimonials: "Testimonios",
  included: "Qué incluye",
  itinerary: "Itinerario",
  accommodation: "Alojamiento",
  host: "Anfitrión/a",
  traveler: "Para quién es",
  faq: "Preguntas frecuentes",
  booking: "Precio y reserva",
  gallery: "Visual story",
};

export const DEFAULT_THEME: EditorTheme = {
  palette: "oaxaca",
  fonts: "editorial",
  scale: "balanced",
  buttons: "solid",
};

export const DEFAULT_COLORS: ThemeColors = {
  background: "#f7f1e7",
  heading: "#342f2a",
  text: "#342f2a",
  muted: "#71685f",
  accent: "#a85337",
  button: "#a85337",
};

export function createEditorDocument(trip: TripData): EditorDocument {
  return {
    version: 4,
    trip: structuredClone(trip),
    announcement: {
      enabled: false,
      message: `${trip.destination} · ${trip.duration} · ${trip.groupSize} · Desde ${trip.price} · Quedan ${trip.spots} lugares disponibles`,
      mobileMessage: `Desde ${trip.price} · ${trip.spots} lugares`,
      buttonLabel: trip.copy.stickyBook,
      url: trip.bookingUrl,
      showCountdown: false,
    },
    theme: { ...DEFAULT_THEME },
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    sectionStyles: {},
    textStyles: {},
    bookingForm: defaultBookingForm(trip.title),
  };
}

export function normalizeEditorDocument(value: Partial<EditorDocument> | null | undefined, fallbackTrip: TripData): EditorDocument {
  const base = createEditorDocument(value?.contentBase === "oaxaca-legacy" ? OAXACA_LEGACY_DATA : fallbackTrip);
  if (!value?.trip) return base;
  const incoming = value.trip as Partial<TripData>;
  const hosts = incoming.hosts?.length ? incoming.hosts : incoming.host ? [incoming.host] : base.trip.hosts;
  const copy = { ...base.trip.copy, ...incoming.copy };
  // Documentos anteriores a estos campos: el texto sobre el título del Hero y el
  // título de la sección de reserva nacen del destino, como se veían hasta ahora.
  if (incoming.copy?.heroEyebrow === undefined) {
    copy.heroEyebrow = [incoming.destination ?? base.trip.destination, incoming.country ?? base.trip.country].filter(Boolean).join(", ");
  }
  if (incoming.copy?.bookingTitle === undefined) {
    copy.bookingTitle = incoming.destination ?? base.trip.destination;
  }
  return {
    ...base,
    ...value,
    version: 4,
    trip: {
      ...base.trip,
      ...incoming,
      story: { ...base.trip.story, ...incoming.story },
      travelerProfile: { ...base.trip.travelerProfile, ...incoming.travelerProfile },
      finalCta: { ...base.trip.finalCta, ...incoming.finalCta },
      contact: { ...base.trip.contact, ...incoming.contact },
      copy,
      hosts,
      host: hosts[0] ?? base.trip.host,
    },
    announcement: { ...base.announcement, ...value.announcement },
    theme: { ...base.theme, ...value.theme },
    sectionOrder: (value.sectionOrder ?? base.sectionOrder).filter((key) => DEFAULT_SECTION_ORDER.includes(key)),
    hiddenSections: (value.hiddenSections ?? []).filter((key) => DEFAULT_SECTION_ORDER.includes(key)),
    sectionStyles: value.sectionStyles ?? {},
    textStyles: value.textStyles ?? {},
    ctaLinks: normalizeCtaLinks(value.ctaLinks),
    // Páginas anteriores al formulario propio conservan su enlace externo (p. ej. Google Form).
    bookingForm: value.bookingForm
      ? normalizeBookingForm(value.bookingForm, incoming.title ?? base.trip.title)
      : { ...defaultBookingForm(incoming.title ?? base.trip.title), mode: "external", externalUrl: incoming.bookingUrl ?? "" },
  };
}

export function editorThemeClass(theme: EditorTheme) {
  return `trip-landing theme-${theme.palette} fonts-${theme.fonts} scale-${theme.scale} buttons-${theme.buttons}${theme.customColors ? " colors-custom" : ""}`;
}

export function editorThemeStyle(theme: EditorTheme): CSSProperties | undefined {
  const colors = theme.customColors;
  if (!colors) return undefined;
  return {
    "--background": colors.background,
    "--foreground": colors.text,
    "--muted-foreground": colors.muted,
    "--primary": colors.accent,
    "--secondary": colors.accent,
    "--heading-color": colors.heading,
    "--button-color": colors.button,
  } as CSSProperties;
}

// ============= Edición de textos por ruta =============

/** Etiquetas claras para las claves técnicas de copy ("navHome" → "Menú · Inicio"). */
export const COPY_FIELD_LABELS: Partial<Record<string, string>> = {
  navTrip: "Menú · El viaje",
  navExperiences: "Menú · Experiencias",
  navItinerary: "Menú · Itinerario",
  navIncluded: "Menú · Incluye",
  navFaq: "Menú · Preguntas",
  navBook: "Menú · Botón de reserva",
  bookingEyebrow: "Reserva · Etiqueta",
  bookingFrom: "Reserva · Palabra «Desde»",
  bookingIncludes: "Reserva · Incluye",
  bookingButton: "Reserva · Botón",
  bookingLimited: "Reserva · Aviso de cupos",
  bookingQuestion: "Reserva · Pregunta de contacto",
  footerTerms: "Pie · Términos",
  footerPrivacy: "Pie · Privacidad",
  footerCancellation: "Pie · Cancelación",
  footerContact: "Pie · Contacto",
  stickyBook: "Barra fija · Botón",
  menuOpen: "Menú móvil · Abrir",
  menuClose: "Menú móvil · Cerrar",
  contactWhatsapp: "Contacto · WhatsApp",
  contactEmail: "Contacto · Email",
  footerInstagram: "Pie · Instagram",
  footerEmail: "Pie · Email",
  heroAvailability: "Disponibilidad",
  heroBook: "Botón de reserva",
  heroItinerary: "Botón itinerario",
  heroEyebrow: "Portada · Texto sobre el título",
  bookingTitle: "Reserva · Título grande",
};

export function copyFieldLabel(key: string): string {
  return COPY_FIELD_LABELS[key] ?? key;
}

/** Lee un valor de texto de TripData por ruta: "copy.heroBook", "highlights.2.title", "included.0". */
export function getTripByPath(trip: TripData, path: string): string {
  const value = path.split(".").reduce<unknown>(
    (node, key) => (node == null ? node : (node as Record<string, unknown>)[key]),
    trip as unknown,
  );
  return typeof value === "string" ? value : "";
}

/** Devuelve una copia de TripData con el texto en `path` reemplazado por `value`. */
export function setTripByPath(trip: TripData, path: string, value: string): TripData {
  const keys = path.split(".");
  const clone = structuredClone(trip) as unknown as Record<string, unknown>;
  let node: Record<string, unknown> = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const next = node[keys[i]];
    if (next == null) return trip;
    node = next as Record<string, unknown>;
  }
  node[keys[keys.length - 1]] = value;
  return clone as unknown as TripData;
}

/** Etiqueta amigable para la última parte de una ruta de texto. */
const TEXT_PATH_LABELS: Record<string, string> = {
  title: "Título",
  subtitle: "Subtítulo",
  brand: "Marca",
  destination: "Destino",
  price: "Precio",
  name: "Nombre",
  bio: "Biografía",
  quote: "Testimonio",
  location: "Lugar",
  q: "Pregunta",
  a: "Respuesta",
  label: "Nombre del dato",
  value: "Información",
  heading: "Título",
  paragraphs: "Párrafo",
  description: "Descripción",
  caption: "Pie de foto",
  button: "Botón",
  note: "Nota",
  duration: "Duración",
  groupSize: "Grupo",
  datesShort: "Fechas cortas",
  level: "Nivel",
  spots: "Lugares disponibles",
  features: "Característica",
  nights: "Noches",
  forYou: "Para ti",
  notForYou: "No es para ti",
  alt: "Texto alternativo",
};

export function textPathLabel(path: string): string {
  const parts = path.split(".");
  const last = parts[parts.length - 1] ?? "";
  const parent = parts[parts.length - 2] ?? "";
  const base = COPY_FIELD_LABELS[last] ?? TEXT_PATH_LABELS[last] ?? last;
  const index = Number(parent);
  return Number.isInteger(index) && parent !== "" ? `${base} · ${index + 1}` : base;
}

/** Claves de ruta que se editan con caja de varias líneas. */
export type EditableFieldDefinition = { multiline?: boolean; required?: boolean; formatting?: "plain" | "rich" };

const EXACT_FIELD_DEFINITIONS: Record<string, EditableFieldDefinition> = {
  brand: { required: true, formatting: "plain" },
  title: { required: true, formatting: "rich" },
  subtitle: { multiline: true, formatting: "rich" },
  price: { required: true, formatting: "plain" },
  datesShort: { required: true, formatting: "plain" },
  bookingUrl: { required: true, formatting: "plain" },
};

const MULTILINE_FIELD_PARTS = new Set(["subtitle", "bio", "description", "paragraphs", "quote", "a", "value", "note"]);

export function editableFieldDefinition(path: string): EditableFieldDefinition {
  if (path.startsWith("ctaLinks.")) return { required: true, formatting: "plain" };
  if (path.startsWith("bookingForm.")) {
    return { multiline: /\.(intro|message|text|help)$/.test(path) || /blocks\.\d+\.label$/.test(path), required: /\.(title|submitLabel|options\.\d+)$/.test(path), formatting: "rich" };
  }
  const exact = EXACT_FIELD_DEFINITIONS[path];
  if (exact) return exact;
  const last = path.split(".").at(-1) ?? "";
  return { multiline: MULTILINE_FIELD_PARTS.has(last), formatting: MULTILINE_FIELD_PARTS.has(last) ? "rich" : "plain" };
}

export function isMultilinePath(path: string): boolean {
  return editableFieldDefinition(path).multiline ?? false;
}
/** Saves inline formatting for one text placement; content stays keyed by its own path. */
export function applyTextStyleCommit(doc: EditorDocument, styleKey: string, inline: unknown, value: string): EditorDocument {
  const style: TextStyle = { ...doc.textStyles[styleKey], inline: normalizeInlineText(inline, value) };
  if (style.inline) { delete style.bold; delete style.italic; delete style.href; }
  return { ...doc, textStyles: { ...doc.textStyles, [styleKey]: style } };
}

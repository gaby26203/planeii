/**
 * Formulario de solicitud por viaje. Vive dentro del documento de la landing
 * (se versiona y publica junto con ella). Las respuestas se guardan como
 * "Solicitudes" del viaje; nunca como reservas confirmadas.
 */
export type FormBlockType = "short" | "long" | "single" | "multi" | "yesno" | "date" | "heading" | "info";

export type FormBlock = {
  id: string;
  type: FormBlockType;
  label: string;
  help?: string;
  options?: string[];
  required?: boolean;
  hidden?: boolean;
};

export type BookingForm = {
  mode: "internal" | "external";
  externalUrl?: string;
  /** Banda con datos del viaje (destino, fechas, precio, cupos) sobre el formulario. */
  showTripHeader: boolean;
  title: string;
  intro: string;
  submitLabel: string;
  blocks: FormBlock[];
  consent: { enabled: boolean; text: string; linkLabel: string; linkUrl: string };
  thanks: { title: string; message: string; steps: string[]; ctaLabel: string; ctaUrl: string };
  /** Mensaje inicial para WhatsApp. Variables: [Nombre], [Viaje]. */
  whatsappTemplate: string;
  /** Colores propios de la página del formulario; vacío = hereda de la landing. */
  colors?: Partial<Record<FormColorKey, string>>;
  copy?: Partial<Record<"viewTrip" | "backToTrip" | "received" | "name" | "whatsapp" | "email" | "yes" | "no", string>>;
};

export type FormColorKey = "background" | "text" | "heading" | "accent" | "buttonBackground" | "buttonText" | "headerBackground" | "headerText";
export const FORM_COLOR_FIELDS: { key: FormColorKey; label: string; cssVar: string }[] = [
  { key: "background", label: "Fondo de la página", cssVar: "--af-bg" },
  { key: "text", label: "Textos", cssVar: "--af-text" },
  { key: "heading", label: "Títulos", cssVar: "--af-heading" },
  { key: "accent", label: "Iconos, números y detalles", cssVar: "--af-accent" },
  { key: "buttonBackground", label: "Fondo del botón de acción", cssVar: "--af-button-bg" },
  { key: "buttonText", label: "Texto del botón", cssVar: "--af-button-text" },
  { key: "headerBackground", label: "Fondo de la banda del viaje", cssVar: "--af-header-bg" },
  { key: "headerText", label: "Texto de la banda del viaje", cssVar: "--af-header-text" },
];
export function formColorStyle(colors: BookingForm["colors"]): Record<string, string> {
  const style: Record<string, string> = {};
  for (const f of FORM_COLOR_FIELDS) { const v = colors?.[f.key]; if (v) style[f.cssVar] = v; }
  return style;
}

export const FIELD_TYPES: { type: FormBlockType; label: string; isQuestion: boolean }[] = [
  { type: "short", label: "Texto corto", isQuestion: true },
  { type: "long", label: "Texto largo", isQuestion: true },
  { type: "single", label: "Opción única", isQuestion: true },
  { type: "multi", label: "Selección múltiple", isQuestion: true },
  { type: "yesno", label: "Sí / No", isQuestion: true },
  { type: "date", label: "Fecha", isQuestion: true },
  { type: "heading", label: "Título", isQuestion: false },
  { type: "info", label: "Texto informativo", isQuestion: false },
];

export const isQuestion = (type: FormBlockType) => type !== "heading" && type !== "info";

export const APPLICATION_STATUSES = [
  { value: "nueva", label: "Nueva" },
  { value: "contactada", label: "Contactada" },
  { value: "en_conversacion", label: "En conversación" },
  { value: "llamada_agendada", label: "Llamada agendada" },
  { value: "pendiente_pago", label: "Pendiente de pago" },
  { value: "confirmada", label: "Confirmada" },
  { value: "no_interesada", label: "No interesada" },
  { value: "descartada", label: "Descartada" },
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]["value"];
export const statusLabel = (value: string) => APPLICATION_STATUSES.find((s) => s.value === value)?.label ?? value;

export const newBlockId = () => `b_${Math.random().toString(36).slice(2, 10)}`;

export function defaultBookingForm(tripName = "el viaje"): BookingForm {
  return {
    mode: "internal",
    externalUrl: "",
    showTripHeader: true,
    title: "Antes de reservar tu lugar queremos conocerte.",
    intro: `Nuestros viajes se viven en grupos pequeños, así que esta aplicación nos ayuda a entender quién eres, cómo te gusta viajar y qué estás buscando en esta experiencia.

No necesitas tener todo claro. Queremos saber si este viaje encaja contigo y también que tú puedas sentir si somos el grupo correcto para ti.

¿Por qué te pedimos completar una aplicación?
Porque no queremos formar grupos solamente llenando cupos.
Queremos reunir mujeres que tengan una forma de viajar compatible: curiosidad por el lugar, apertura para compartir con otras personas y ganas de vivir el destino más allá de una lista de atracciones.
Tus respuestas nos ayudan a conocerte antes del viaje y a cuidar mejor la experiencia del grupo.

¿Qué pasa después de enviarla?
Revisaremos tu aplicación y te escribiremos por WhatsApp para conversar contigo, responder cualquier duda y explicarte los próximos pasos para reservar tu lugar.
Completar la aplicación no confirma todavía tu reserva.`,
    submitLabel: "Enviar solicitud",
    blocks: [
      { id: "b_motivo", type: "long", label: "Edad", required: true },
      { id: "b_58xx61ua", type: "short", label: "Pais de Residencia", help: "Texto de ayuda", required: true },
      { id: "b_vm5q890e", type: "short", label: "Nacionalidad" },
      { id: "b_xbxg79xr", type: "long", label: "¿Qué te motiva a hacer este viaje?", help: "Texto de ayuda" },
      { id: "b_r7jjqbei", type: "long", label: "¿Tienes alguna duda o inquietud sobre el viaje que quieras resolver por llamada? " },
    ],
    consent: {
      enabled: true,
      text: "Acepto que usen mis datos para contactarme sobre este viaje.",
      linkLabel: "Política de privacidad",
      linkUrl: "",
    },
    thanks: {
      title: `Recibimos tu solicitud para ${tripName}`,
      message: "Te escribiremos por WhatsApp para conversar contigo y explicarte los próximos pasos.",
      steps: ["Revisamos tu solicitud", "Te escribimos por WhatsApp", "Agendamos una llamada"],
      ctaLabel: "",
      ctaUrl: "",
    },
    whatsappTemplate: "Hola, [Nombre]. Vi tu solicitud para [Viaje] y quería escribirte para contarte los próximos pasos.",
  };
}

export function normalizeBookingForm(value: Partial<BookingForm> | null | undefined, tripName?: string): BookingForm {
  const base = defaultBookingForm(tripName);
  if (!value) return base;
  return {
    ...base,
    ...value,
    showTripHeader: value.showTripHeader ?? true,
    blocks: Array.isArray(value.blocks) ? value.blocks.filter((b) => b && b.id && b.type) : base.blocks,
    consent: { ...base.consent, ...value.consent },
    thanks: { ...base.thanks, ...value.thanks, steps: value.thanks?.steps ?? base.thanks.steps },
  };
}

/** Only editable form copy can be changed; configuration and question IDs stay intact. */
export function setBookingFormTextByPath(form: BookingForm, path: string, value: string): BookingForm {
  const key = path.replace(/^bookingForm\./, "");
  const allowed = /^(title|intro|submitLabel|consent\.(text|linkLabel)|thanks\.(title|message|ctaLabel|steps\.\d+)|copy\.(viewTrip|backToTrip|received|name|whatsapp|email|yes|no)|blocks\.\d+\.(label|help|options\.\d+))$/;
  if (!allowed.test(key)) return form;
  const keys = key.split(".");
  const clone = structuredClone(form);
  clone.copy ??= {};
  let node = clone as unknown as Record<string, unknown>;
  for (const part of keys.slice(0, -1)) {
    const next = node[part];
    if (!next || typeof next !== "object") return form;
    node = next as Record<string, unknown>;
  }
  const last = keys.at(-1);
  if (!last || (Array.isArray(node) && !(last in node))) return form;
  node[last] = value;
  return clone;
}

/** Deja solo dígitos con "+" inicial. Requiere código de país. */
export function normalizeWhatsapp(code: string, number: string) {
  const digits = `${code}${number}`.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

export function whatsappLink(phone: string, template: string, vars: { name: string; trip: string }) {
  const digits = phone.replace(/\D/g, "");
  const text = template.replaceAll("[Nombre]", vars.name.split(" ")[0] || vars.name).replaceAll("[Viaje]", vars.trip);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export const COUNTRY_CODES = [
  { code: "+58", label: "🇻🇪 +58" }, { code: "+57", label: "🇨🇴 +57" }, { code: "+52", label: "🇲🇽 +52" },
  { code: "+54", label: "🇦🇷 +54" }, { code: "+56", label: "🇨🇱 +56" }, { code: "+51", label: "🇵🇪 +51" },
  { code: "+593", label: "🇪🇨 +593" }, { code: "+507", label: "🇵🇦 +507" }, { code: "+506", label: "🇨🇷 +506" },
  { code: "+1", label: "🇺🇸 +1" }, { code: "+34", label: "🇪🇸 +34" }, { code: "+55", label: "🇧🇷 +55" },
  { code: "+598", label: "🇺🇾 +598" }, { code: "+591", label: "🇧🇴 +591" }, { code: "+595", label: "🇵🇾 +595" },
  { code: "+502", label: "🇬🇹 +502" }, { code: "+503", label: "🇸🇻 +503" }, { code: "+504", label: "🇭🇳 +504" },
  { code: "+505", label: "🇳🇮 +505" }, { code: "+1809", label: "🇩🇴 +1 809" }, { code: "+44", label: "🇬🇧 +44" },
  { code: "+39", label: "🇮🇹 +39" }, { code: "+49", label: "🇩🇪 +49" }, { code: "+33", label: "🇫🇷 +33" },
];

export type AnswerValue = string | string[] | boolean | null;
export type StoredAnswer = { id: string; label: string; type: FormBlockType; value: AnswerValue };

/** Valida respuestas contra el formulario publicado. Devuelve error legible o respuestas limpias. */
export function validateAnswers(form: BookingForm, raw: Record<string, unknown>): { error: string } | { answers: StoredAnswer[] } {
  const answers: StoredAnswer[] = [];
  for (const block of form.blocks) {
    if (block.hidden || !isQuestion(block.type)) continue;
    const v = raw[block.id];
    let value: AnswerValue = null;
    if (block.type === "multi") {
      const list = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && (block.options ?? []).includes(x)) : [];
      value = list.length ? list : null;
    } else if (block.type === "yesno") {
      value = v === true || v === "si" ? true : v === false || v === "no" ? false : null;
    } else if (block.type === "single") {
      value = typeof v === "string" && (block.options ?? []).includes(v) ? v : null;
    } else if (block.type === "date") {
      value = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    } else {
      const s = typeof v === "string" ? v.trim().slice(0, block.type === "long" ? 3000 : 300) : "";
      value = s || null;
    }
    if (block.required && value === null) return { error: `Falta responder: ${block.label}` };
    answers.push({ id: block.id, label: block.label, type: block.type, value });
  }
  return { answers };
}

export function formatAnswer(a: StoredAnswer) {
  if (a.value === null || a.value === undefined) return "—";
  if (typeof a.value === "boolean") return a.value ? "Sí" : "No";
  if (Array.isArray(a.value)) return a.value.join(", ");
  return a.value;
}

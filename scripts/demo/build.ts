// Arma los viajes vitrina de la demo con las mismas acciones del store que usa la app (inscribir,
// plan de cuotas, abonos), para que los datos sean coherentes con los cálculos de la interfaz.

import { BRAND_PHOTOS, brandPhoto } from "../../src/lib/brand-photos";
import { neutralTripFor } from "../../src/data/neutral-trip";
import { defaultBookingForm } from "../../src/lib/booking-form";
import { generateInstallments } from "../../src/lib/finance";
import type { TripData } from "../../src/lib/finance-types";
import {
  createEditorDocument,
  type EditorDocument,
  type SectionKey,
} from "../../src/lib/trip-editor";
import { useTripsStore } from "../../src/lib/trips-store";
import { DEMO_NAMES, DEMO_TRIPS, type DemoTrip } from "./data";

export interface DemoApplication {
  id: string;
  trip_id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  status: string;
  page_slug: string;
  consent_accepted: boolean;
  created_at: string;
}

export interface DemoEvent {
  trip_id: string;
  event: "view" | "click" | "form_start" | "form_submit";
  target: string | null;
  country: string | null;
  device: string;
  referrer: string;
  created_at: string;
}

export interface DemoData {
  trips: TripData[];
  pages: { trip_id: string; slug: string; document: EditorDocument }[];
  applications: DemoApplication[];
  events: DemoEvent[];
}

/** Secciones que necesitan contenido real del cliente: quedan ocultas en la demo. */
const HIDDEN_SECTIONS: SectionKey[] = [
  "highlights",
  "accommodation",
  "testimonials",
  "host",
  "traveler",
  "faq",
];

const DAY = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Generador pseudoaleatorio con semilla: la demo sale igual cada vez que se genera el mismo día. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function emailFor(name: string) {
  const plain = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
  return `${plain}@example.com`;
}

/** Prefijo 400: no está asignado a ninguna operadora en Venezuela. */
const phoneFor = (n: number) => `+584000000${String(n).padStart(3, "0")}`;

/**
 * UUID determinístico para las solicitudes: el prefijo fijo de los viajes de la demo, los cuatro
 * últimos dígitos del id del viaje (los que los distinguen) y el número de solicitud.
 */
const childId = (tripId: string, n: number) =>
  `${tripId.slice(0, 24)}${tripId.slice(-4)}${String(n).padStart(8, "0")}`;

function formatRange(start: Date, end: Date) {
  const day = new Intl.DateTimeFormat("es-VE", { day: "numeric", month: "long", timeZone: "UTC" });
  const full = new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${day.format(start)} — ${full.format(end)}`;
}

function buildTrip(def: DemoTrip, now: Date, names: string[], phoneOffset: number): TripData {
  const store = useTripsStore;
  const start = new Date(now.getTime() + def.startsInDays * DAY);
  const end = new Date(start.getTime() + (def.days - 1) * DAY);
  const base: TripData = {
    id: def.id,
    name: def.name,
    destination: def.destination,
    country: def.country,
    startDate: isoDate(start),
    endDate: isoDate(end),
    status: "abierto",
    capacity: def.capacity,
    enrolled: 0,
    pricePerPerson: def.pricePerPerson,
    currency: "USD",
    baseCurrency: "USD",
    coverGradient: "from-[oklch(0.45_0.05_60)] to-[oklch(0.30_0.03_60)]",
    coverImage: brandPhoto(def.cover).src,
    showcase: true,
    itinerary: [],
    costs: [],
    enrollees: [],
    refundRules: [],
    providers: [],
  };
  store.setState({ trips: { [def.id]: base }, hydrated: true });
  const actions = store.getState();

  for (const cost of def.costs) {
    actions.addCost(def.id, {
      description: cost.description,
      notes: "",
      category: cost.category,
      amount: cost.amount,
      currency: "USD",
      amountUSD: cost.amount,
      perPerson: cost.perPerson,
      itineraryDay: cost.itineraryDay,
    });
  }

  const lastDue = new Date(start.getTime() - 30 * DAY);
  def.travelers.forEach((plan, i) => {
    const name = names[i];
    const enrolledAt = new Date(now.getTime() - (60 - i * 6) * DAY);
    const enrolleeId = actions.addEnrollee(def.id, {
      name,
      email: emailFor(name),
      phone: phoneFor(phoneOffset + i),
      enrolledAt: isoDate(enrolledAt),
    });
    if (!enrolleeId) throw new Error(`No se pudo inscribir a ${name}`);
    const enrollee = store.getState().trips[def.id].enrollees.find((e) => e.id === enrolleeId)!;
    const installments = generateInstallments(
      enrollee.totalDue,
      plan.installments,
      isoDate(enrolledAt),
      isoDate(lastDue),
    );
    actions.setPaymentPlan(def.id, enrolleeId, installments);
    const saved = store.getState().trips[def.id].enrollees.find((e) => e.id === enrolleeId)!;
    saved.installments.slice(0, plan.paid).forEach((inst) => {
      const paidAt = inst.dueDate <= isoDate(now) ? inst.dueDate : isoDate(now);
      actions.addInstallmentPayment(def.id, enrolleeId, inst.id, {
        amount: inst.amount,
        paidAt,
        method: "transferencia",
      });
    });
  });

  return store.getState().trips[def.id];
}

function buildLanding(def: DemoTrip, trip: TripData): EditorDocument {
  const start = new Date(`${trip.startDate}T00:00:00Z`);
  const end = new Date(`${trip.endDate}T00:00:00Z`);
  const img = (id: Parameters<typeof brandPhoto>[0]) => {
    const p = brandPhoto(id);
    return { src: p.src, alt: p.alt };
  };
  const active = trip.enrollees.filter((e) => !e.cancellation).length;
  const landing = neutralTripFor({
    brand: "Chama Viaja",
    destination: def.destination,
    country: def.country,
    title: def.landing.title,
    subtitle: def.landing.subtitle,
    dates: formatRange(start, end),
    datesShort: formatRange(start, end),
    duration: `${def.days} días`,
    groupSize: `Hasta ${def.capacity} viajeras`,
    level: def.landing.level,
    price: `$${def.pricePerPerson.toLocaleString("es-VE")}`,
    currency: "USD",
    spots: String(Math.max(0, def.capacity - active)),
    heroImage: img(def.cover),
    finalImage: img(def.finalPhoto),
    story: {
      heading: [def.landing.title],
      paragraphs: def.landing.story,
      image: img(def.finalPhoto),
    },
    itinerary: def.landing.itinerary.map((d, i) => ({ day: i + 1, ...d })),
    included: def.landing.included,
    notIncluded: def.landing.notIncluded,
    gallery: BRAND_PHOTOS.map((p) => ({ src: p.src, alt: p.alt })),
  });
  const doc = createEditorDocument(landing);
  doc.hiddenSections = [...HIDDEN_SECTIONS];
  doc.bookingForm = defaultBookingForm(def.landing.title);
  return doc;
}

function buildApplications(def: DemoTrip, now: Date, names: string[], phoneOffset: number) {
  return def.applications.map<DemoApplication>((a, i) => ({
    id: childId(def.id, i + 1),
    trip_id: def.id,
    full_name: names[i],
    email: emailFor(names[i]),
    whatsapp: phoneFor(phoneOffset + i),
    status: a.status,
    page_slug: def.slug,
    consent_accepted: true,
    created_at: new Date(now.getTime() - a.daysAgo * DAY).toISOString(),
  }));
}

function buildEvents(def: DemoTrip, now: Date, submits: number): DemoEvent[] {
  const rand = seeded(Number.parseInt(def.id.slice(-4), 16) + Math.floor(now.getTime() / DAY));
  const pick = <T>(options: [T, number][]) => {
    let r = rand();
    for (const [value, weight] of options) {
      if ((r -= weight) < 0) return value;
    }
    return options[options.length - 1][0];
  };
  const events: DemoEvent[] = [];
  for (let d = 29; d >= 0; d--) {
    const views = Math.max(1, Math.round(def.dailyViews * (0.6 + rand() * 0.8)));
    for (let v = 0; v < views; v++) {
      const at = new Date(now.getTime() - d * DAY - Math.floor(rand() * DAY)).toISOString();
      const device = pick<string>([
        ["celular", 0.72],
        ["computadora", 0.28],
      ]);
      const referrer = pick<string>([
        ["instagram", 0.48],
        ["whatsapp", 0.27],
        ["directo", 0.17],
        ["google", 0.08],
      ]);
      const country = pick<string>([
        ["VE", 0.62],
        ["CO", 0.1],
        ["CL", 0.09],
        ["US", 0.1],
        ["ES", 0.09],
      ]);
      const base = { trip_id: def.id, country, device, referrer, created_at: at };
      events.push({ ...base, event: "view", target: null });
      if (rand() < 0.09) events.push({ ...base, event: "click", target: "booking" });
      if (rand() < 0.05) events.push({ ...base, event: "click", target: "section" });
      if (rand() < 0.04) events.push({ ...base, event: "form_start", target: null });
    }
  }
  for (let i = 0; i < submits; i++) {
    const at = new Date(now.getTime() - (2 + i * 4) * DAY).toISOString();
    events.push({
      trip_id: def.id,
      event: "form_submit",
      target: null,
      country: "VE",
      device: "celular",
      referrer: "instagram",
      created_at: at,
    });
  }
  return events;
}

export function buildDemo(now = new Date()): DemoData {
  const data: DemoData = { trips: [], pages: [], applications: [], events: [] };
  let next = 0;
  for (const def of DEMO_TRIPS) {
    const travelerNames = DEMO_NAMES.slice(next, next + def.travelers.length);
    const applicantNames = DEMO_NAMES.slice(
      next + def.travelers.length,
      next + def.travelers.length + def.applications.length,
    );
    if (
      travelerNames.length + applicantNames.length <
      def.travelers.length + def.applications.length
    ) {
      throw new Error("Faltan nombres ficticios en DEMO_NAMES para tantas viajeras y solicitudes.");
    }
    const trip = buildTrip(def, now, travelerNames, next);
    data.trips.push(trip);
    data.pages.push({ trip_id: def.id, slug: def.slug, document: buildLanding(def, trip) });
    data.applications.push(
      ...buildApplications(def, now, applicantNames, next + def.travelers.length),
    );
    data.events.push(...buildEvents(def, now, def.applications.length));
    next += def.travelers.length + def.applications.length;
  }
  useTripsStore.setState({ trips: {}, hydrated: false });
  return data;
}

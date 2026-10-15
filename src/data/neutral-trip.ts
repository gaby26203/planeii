// Plantilla base neutra: punto de partida de toda landing nueva y único relleno
// para cualquier landing que no sea Oaxaca. Sin contenido real de ningún destino.
import { BOOKING_URL, type Img, type LandingCopy, type TripData } from "./trip";

const PHOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#e7e0d6"/><g fill="none" stroke="#9c9186" stroke-width="6"><rect x="530" y="330" width="140" height="104" rx="10"/><circle cx="600" cy="382" r="26"/></g><text x="600" y="490" font-family="sans-serif" font-size="30" fill="#7d7268" text-anchor="middle">Agregá una foto</text></svg>`;
export const NEUTRAL_PHOTO_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(PHOTO_SVG)}`;

const photo = (alt: string, caption?: string): Img => ({ src: NEUTRAL_PHOTO_SRC, alt, ...(caption ? { caption } : {}) });

/** Días iniciales; después el itinerario sigue siendo editable (agregar/quitar días). */
export function neutralItinerary(days: number): TripData["itinerary"] {
  return Array.from({ length: Math.max(1, days) }, (_, i) => ({
    day: i + 1,
    title: "Título del día",
    description: "Descripción del día.",
  }));
}

const host = { name: "Nombre de la anfitriona", bio: "Descripción de la anfitriona.", image: photo("Foto de la anfitriona") };

/** Etiquetas compartidas de interfaz. Se mantienen separadas del contenido legacy de Oaxaca. */
export const NEUTRAL_LANDING_COPY: LandingCopy = {
  navTrip: "El viaje", navExperiences: "Experiencias", navItinerary: "Itinerario", navIncluded: "Qué incluye", navFaq: "FAQ", navBook: "Reservar",
  menuOpen: "Menú", menuClose: "Cerrar",
  heroAvailability: "Quedan {spots} lugares disponibles", heroBook: "Quiero reservar mi lugar", heroItinerary: "Ver itinerario", heroEyebrow: "Destino, país",
  metaDuration: "Duración", metaGroup: "Grupo", metaDates: "Fechas", metaPrice: "Precio", metaSpots: "Lugares disponibles",
  storyEyebrow: "El viaje", storyLink: "Conocer el viaje →", storyCaption: "Pie de foto de la historia.",
  highlightsEyebrow: "Experiencias", highlightsTitle: "Lo que vas a vivir",
  includedEyebrow: "Qué incluye", includedTitle: "Todo lo que está incluido", includedLabel: "Incluye", notIncludedLabel: "No incluye",
  itineraryEyebrow: "Itinerario", itineraryTitle: "Día a día", itineraryDay: "Día",
  accommodationEyebrow: "Alojamiento", accommodationTitle: "Donde vamos a dormir",
  hostEyebrow: "Anfitriona",
  travelerEyebrow: "Para quién es", travelerTitle: "Este viaje es para ti si…", travelerNotTitle: "Probablemente no es para ti si…", travelerNote: "Queremos que cada viajera llegue al viaje correcto.",
  practicalEyebrow: "Información práctica", practicalTitle: "Antes de llegar",
  testimonialsEyebrow: "Testimonios", testimonialsTitle: "Quienes ya viajaron",
  faqEyebrow: "FAQ", faqTitle: "Preguntas frecuentes",
  bookingEyebrow: "Reserva", bookingTitle: "[destino]", bookingFrom: "Desde", bookingIncludes: "Incluye", bookingButton: "Reservar mi lugar", bookingLimited: "Plazas limitadas · {spots} lugares disponibles", bookingQuestion: "¿Tienes dudas? Escríbenos:",
  galleryEyebrow: "Visual story", galleryMore: "Ver más fotos", galleryLess: "Ver menos",
  contactWhatsapp: "WhatsApp", contactEmail: "Email",
  footerInstagram: "Instagram", footerEmail: "Email", footerTerms: "Términos", footerPrivacy: "Privacidad", footerCancellation: "Cancelación", footerContact: "Contacto",
  stickyBook: "Quiero ir",
};

export const NEUTRAL_TRIP_DATA: TripData = {
  brand: "Nombre de tu marca",
  destination: "[destino]",
  country: "",
  title: "Título de tu viaje",
  subtitle: "Subtítulo de tu viaje",
  dates: "Fechas del viaje",
  datesShort: "Fechas del viaje",
  duration: "Duración del viaje",
  groupSize: "Tamaño del grupo",
  level: "Nivel del viaje",
  price: "$0",
  currency: "USD",
  spots: "0",
  bookingUrl: BOOKING_URL,
  heroImage: photo("Foto de portada del viaje"),
  finalImage: photo("Foto de cierre del viaje"),
  story: {
    heading: ["Descripción de tu viaje.", "Lo que lo hace especial."],
    paragraphs: ["Descripción de tu viaje.", "Contá qué hace especial este viaje.", "Qué se lleva cada viajera al volver."],
    image: photo("Foto de la historia del viaje"),
  },
  highlights: [1, 2, 3].map((n) => ({
    title: "Título de la experiencia",
    description: "Descripción de la experiencia.",
    image: photo(`Foto de la experiencia ${n}`),
  })),
  host,
  hosts: [structuredClone(host)],
  differentiators: [1, 2, 3].map(() => ({ title: "Diferencial del viaje", description: "Descripción del diferencial." })),
  included: ["Elemento incluido", "Elemento incluido", "Elemento incluido"],
  notIncluded: ["Elemento no incluido", "Elemento no incluido"],
  itinerary: neutralItinerary(3),
  gallery: [1, 2, 3, 4, 5].map((n) => photo(`Foto de la galería ${n}`, "Pie de foto")),
  accommodations: [{
    name: "Nombre del alojamiento",
    location: "Ubicación del alojamiento",
    nights: "Noches",
    description: "Descripción del alojamiento.",
    features: ["Característica", "Característica", "Característica"],
    image: photo("Foto del alojamiento"),
  }],
  travelerProfile: {
    forYou: ["Rasgo de la viajera ideal.", "Rasgo de la viajera ideal.", "Rasgo de la viajera ideal."],
    notForYou: ["Situación en la que este viaje no es para ti.", "Situación en la que este viaje no es para ti."],
  },
  practicalInfo: [],
  testimonials: [1, 2, 3].map(() => ({ quote: "Testimonio de una viajera.", name: "Nombre", location: "Ciudad, país" })),
  faq: [1, 2, 3].map(() => ({ q: "Pregunta frecuente", a: "Respuesta a la pregunta." })),
  finalCta: { heading: "Nos vemos en [destino].", button: "Quiero reservar mi lugar", note: "Consultá fechas, disponibilidad y detalles del viaje." },
  contact: { email: "", instagram: "", whatsapp: "" },
  copy: NEUTRAL_LANDING_COPY,
};

/** Base neutra completada con los datos reales del viaje (destino, fechas, precio, cupos). */
export function neutralTripFor(details: Partial<TripData> = {}): TripData {
  const base = structuredClone(NEUTRAL_TRIP_DATA);
  const destination = details.destination || base.destination;
  const country = details.country ?? base.country;
  return {
    ...base,
    ...details,
    finalCta: { ...base.finalCta, heading: `Nos vemos en ${destination}.` },
    copy: {
      ...base.copy,
      heroEyebrow: [destination, country].filter(Boolean).join(", "),
      bookingTitle: destination,
    },
  };
}

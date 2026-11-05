// OAXACA_LEGACY_DATA — respaldo interno EXCLUSIVO de la landing de Oaxaca (documentos con contentBase "oaxaca-legacy").
// No es la plantilla de viajes nuevos: esa es NEUTRAL_TRIP_DATA (./neutral-trip.ts).

// Los textos entre [CORCHETES] son placeholders: sustitúyelos por información real.
import { TEMPLATE_ASSETS } from "@/lib/template-assets";
const { hero, cocina, artesanos, mezcal, mercado, hotel, noche, final } = TEMPLATE_ASSETS;

export const BOOKING_URL = "[INSERTAR URL DE RESERVA]";

export type ImagePosition = { x: number; y: number };
export type Img = { src: string; alt: string; caption?: string; mobilePosition?: ImagePosition };
export type HostData = { name: string; bio: string; image: Img };
export type TripMetaItem = { id: string } & (
  | { kind: "duration" | "group" | "dates" | "price" | "spots" }
  | { kind: "custom"; label: string; value: string }
);
export type ItineraryGroup = { id: string; size: number; image: Img };
export type TripAnnouncement = {
  enabled: boolean;
  message: string;
  mobileMessage?: string;
  buttonLabel: string;
  url: string;
  startsAt?: string;
  endsAt?: string;
  showCountdown: boolean;
};

export type LandingCopy = {
  navTrip: string; navExperiences: string; navItinerary: string; navIncluded: string; navFaq: string; navBook: string;
  menuOpen: string; menuClose: string;
  heroAvailability: string; heroBook: string; heroItinerary: string; heroEyebrow: string;
  metaDuration: string; metaGroup: string; metaDates: string; metaPrice: string; metaSpots: string;
  storyEyebrow: string; storyLink: string; storyCaption: string;
  highlightsEyebrow: string; highlightsTitle: string;
  includedEyebrow: string; includedTitle: string; includedLabel: string; notIncludedLabel: string;
  itineraryEyebrow: string; itineraryTitle: string; itineraryDay: string;
  accommodationEyebrow: string; accommodationTitle: string;
  hostEyebrow: string;
  travelerEyebrow: string; travelerTitle: string; travelerNotTitle: string; travelerNote: string;
  practicalEyebrow: string; practicalTitle: string;
  testimonialsEyebrow: string; testimonialsTitle: string;
  faqEyebrow: string; faqTitle: string;
  bookingEyebrow: string; bookingTitle: string; bookingFrom: string; bookingIncludes: string; bookingButton: string; bookingLimited: string; bookingQuestion: string;
  galleryEyebrow: string; galleryMore: string; galleryLess: string;
  contactWhatsapp: string; contactEmail: string;
  footerInstagram: string; footerEmail: string; footerTerms: string; footerPrivacy: string; footerCancellation: string; footerContact: string;
  stickyBook: string;
};

export type TripData = {
  brand: string;
  destination: string;
  country: string;
  title: string;
  subtitle: string;
  dates: string;
  datesShort: string;
  duration: string;
  groupSize: string;
  level: string;
  price: string;
  currency: string;
  spots: string;
  metaItems?: TripMetaItem[];
  itineraryGroups?: ItineraryGroup[];
  bookingUrl: string;
  heroImage: Img;
  finalImage: Img;
  story: { heading: string[]; paragraphs: string[]; image: Img };
  highlights: { title: string; description: string; image: Img }[];
  host: HostData;
  hosts: HostData[];
  differentiators: { title: string; description: string }[];
  included: string[];
  notIncluded: string[];
  itinerary: { day: number; title: string; description: string; image?: Img }[];
  gallery: Img[];
  accommodations: { name: string; location: string; nights: string; description: string; features: string[]; image: Img }[];
  travelerProfile: { forYou: string[]; notForYou: string[] };
  practicalInfo: { label: string; value: string }[];
  testimonials: { quote: string; name: string; location: string }[];
  faq: { q: string; a: string }[];
  finalCta: { heading: string; button: string; note: string };
  contact: { email: string; instagram: string; whatsapp?: string };
  copy: LandingCopy;
};

export const OAXACA_LEGACY_DATA: TripData = {
  brand: "[NOMBRE DE LA MARCA]",
  destination: "Oaxaca",
  country: "México",
  title: "Un viaje para entrar en Oaxaca, no solamente visitarla.",
  subtitle: "Cocinas de humo, telares, palenques y las personas que sostienen todo eso. Un grupo pequeño, un anfitrión que conoce el camino.",
  dates: "28 de octubre — 4 de noviembre, 2027",
  datesShort: "28 Oct — 4 Nov 2027",
  duration: "8 días / 7 noches",
  groupSize: "Máximo 12 viajeros",
  level: "Moderado",
  price: "$[X,XXX]",
  currency: "USD",
  spots: "[X]",
  bookingUrl: BOOKING_URL,
  heroImage: { src: hero, alt: "Calle empedrada frente al templo de Santo Domingo en Oaxaca al atardecer" },
  finalImage: { src: final, alt: "Monte Albán al atardecer sobre el valle de Oaxaca" },
  story: {
    heading: ["Hay lugares que se visitan.", "Y hay lugares que se sienten."],
    paragraphs: [
      "Oaxaca no se entiende desde una lista de atracciones. Se entiende en una cocina donde el mole lleva tres días, en un telar donde los colores salen de la cochinilla y el añil, en un palenque donde el agave pasó ocho años bajo el sol antes de llegar a tu copa.",
      "Diseñamos este viaje alrededor de esas personas y esos tiempos. No vamos a recorrer Oaxaca deprisa: vamos a sentarnos a la mesa, a escuchar, a mirar cómo se hacen las cosas y por qué.",
      "Volverás con algo más que fotografías: con nombres, con sabores que podrás reconocer y con la sensación de haber sido recibido, no atendido.",
    ],
    image: { src: cocina, alt: "Cocinera oaxaqueña moliendo en metate en una cocina tradicional" },
  },
  highlights: [
    { title: "Cocinas que cuentan historias", description: "Moles, tortillas a mano y recetas que pasan de abuela a nieta, cocinadas junto a quienes las guardan. Del mercado a la mesa: chiles, chapulines y tlayudas.", image: { src: cocina, alt: "Cocina tradicional oaxaqueña con ollas de barro" } },
    { title: "Artesanos y manos locales", description: "Talleres de tejido, barro y textil en los pueblos del valle, con tiempo para conversar.", image: { src: artesanos, alt: "Tejedora zapoteca en un telar de madera" } },
    { title: "Mezcal desde su origen", description: "Un palenque familiar, el horno de tierra, el agave cocido y la paciencia que hay detrás de cada copa. El viaje culmina con la experiencia nocturna especial: [DESCRIPCIÓN DE LA EXPERIENCIA NOCTURNA].", image: { src: mezcal, alt: "Palenque de mezcal con agaves cocidos y campo de agave" } },
  ],
  host: {
    name: "[NOMBRE DEL ANFITRIÓN O ANFITRIONAS]",
    bio: "[BIO CORTA: quién es, su relación con el destino y qué acceso aporta al viaje.]",
    image: { src: cocina, alt: "Anfitrión del viaje" },
  },
  hosts: [{
    name: "[NOMBRE DEL ANFITRIÓN O ANFITRIONAS]",
    bio: "[BIO CORTA: quién es, su relación con el destino y qué acceso aporta al viaje.]",
    image: { src: cocina, alt: "Anfitrión del viaje" },
  }],
  differentiators: [
    { title: "Grupo pequeño", description: "Máximo 12 personas. Cabemos en una cocina, en un taller y en una sola mesa." },
    { title: "Experiencias privadas", description: "Encuentros organizados solo para el grupo, lejos de los recorridos masivos." },
    { title: "Anfitrión local", description: "[NOMBRE DEL ANFITRIÓN] acompaña el viaje de principio a fin." },
    { title: "Acceso a personas", description: "Cocineras, artesanos y productores que normalmente no forman parte de un tour." },
    { title: "Hoteles con carácter", description: "Alojamientos elegidos por su diseño, ubicación y autenticidad." },
    { title: "Tiempo libre", description: "Espacios para perderte por tu cuenta y descubrir Oaxaca a tu ritmo." },
  ],
  included: [
    "Alojamiento [X] noches",
    "Desayunos diarios",
    "Comidas indicadas en el itinerario",
    "Transporte durante el viaje",
    "Traslados aeropuerto [CONFIRMAR]",
    "Actividades descritas en el itinerario",
    "Experiencias privadas",
    "Anfitrión durante todo el viaje",
    "Fotografía profesional [SI APLICA]",
  ],
  notIncluded: [
    "Vuelos internacionales",
    "Seguro de viaje",
    "Gastos personales",
    "Propinas",
    "[OTROS NO INCLUIDOS]",
  ],
  itinerary: Array.from({ length: 8 }, (_, i) => {
    const titles = [
      "Llegada a Oaxaca",
      "Mercados, sabores y primeras historias",
      "[TÍTULO DÍA 3]",
      "[TÍTULO DÍA 4]",
      "[TÍTULO DÍA 5]",
      "[TÍTULO DÍA 6]",
      "[TÍTULO DÍA 7]",
      "Despedida",
    ];
    return {
      day: i + 1,
      title: titles[i] ?? `[TÍTULO DÍA ${i + 1}]`,
      description: `[ITINERARY DAY ${i + 1}: descripción editorial del día.]`,
    };
  }),
  gallery: [
    { src: hero, alt: "Templo de Santo Domingo", caption: "Santo Domingo, al caer la tarde" },
    { src: artesanos, alt: "Telar zapoteca", caption: "Teotitlán del Valle" },
    { src: mercado, alt: "Mercado oaxaqueño", caption: "El mercado" },
    { src: mezcal, alt: "Palenque", caption: "Horno de tierra" },
    { src: noche, alt: "Cena con velas", caption: "La última noche" },
    { src: hotel, alt: "Patio colonial", caption: "Casa del grupo" },
    { src: cocina, alt: "Cocina tradicional oaxaqueña con ollas de barro", caption: "En la cocina" },
    { src: final, alt: "Monte Albán al atardecer sobre el valle de Oaxaca", caption: "Monte Albán" },
  ],
  accommodations: [
    {
      name: "[HOTEL NAME]",
      location: "Centro histórico, Oaxaca de Juárez",
      nights: "[X] noches",
      description: "[DESCRIPCIÓN DEL ALOJAMIENTO: historia de la casa, diseño, por qué lo elegimos.]",
      features: ["[CARACTERÍSTICA 1]", "[CARACTERÍSTICA 2]", "[CARACTERÍSTICA 3]"],
      image: { src: hotel, alt: "Patio de un hotel boutique en Oaxaca" },
    },
  ],
  travelerProfile: {
    forYou: [
      "Te gusta viajar con curiosidad.",
      "Prefieres experiencias auténticas a atracciones turísticas.",
      "Disfrutas comer bien.",
      "Te interesa conocer personas y culturas.",
      "Te gusta viajar en grupos pequeños.",
      "Quieres descubrir Oaxaca desde una perspectiva local.",
    ],
    notForYou: [
      "Buscas un resort all-inclusive.",
      "Prefieres tener todo el viaje libre.",
      "No disfrutas caminar o moverte durante el día.",
      "Buscas turismo de lujo tradicional.",
    ],
  },
  practicalInfo: [
    { label: "Aeropuerto de llegada", value: "[AEROPUERTO DE LLEGADA]" },
    { label: "Aeropuerto de salida", value: "[AEROPUERTO DE SALIDA]" },
    { label: "Hora recomendada de llegada", value: "[HORA]" },
    { label: "Hora recomendada de salida", value: "[HORA]" },
    { label: "Clima", value: "[CLIMA ESPERADO EN LAS FECHAS]" },
    { label: "Qué llevar", value: "[LISTA DE EQUIPAJE]" },
    { label: "Nivel de actividad", value: "Moderado. [DETALLE]" },
    { label: "Tipo de alojamiento", value: "[TIPO DE ALOJAMIENTO]" },
    { label: "Tamaño del grupo", value: "Máximo 12 viajeros" },
    { label: "Moneda", value: "Peso mexicano (MXN)" },
    { label: "Idioma", value: "[IDIOMA DEL VIAJE]" },
    { label: "Transporte", value: "[TIPO DE TRANSPORTE]" },
    { label: "Seguro de viaje", value: "[REQUISITO DE SEGURO]" },
  ],
  testimonials: [
    { quote: "[TESTIMONIO REAL DEL VIAJERO]", name: "[NOMBRE]", location: "[CIUDAD, PAÍS]" },
    { quote: "[TESTIMONIO REAL DEL VIAJERO]", name: "[NOMBRE]", location: "[CIUDAD, PAÍS]" },
    { quote: "[TESTIMONIO REAL DEL VIAJERO]", name: "[NOMBRE]", location: "[CIUDAD, PAÍS]" },
  ],
  // Ordenado por fricción de compra: pago y cancelación primero.
  faq: [
    "¿Cómo funciona el pago?",
    "¿Cuál es la política de cancelación?",
    "¿Qué está incluido?",
    "¿Qué no está incluido?",
    "¿Cuántas personas participan?",
    "¿Puedo viajar con mi pareja o un amigo?",
    "¿Hay opción de habitación individual?",
    "¿Qué nivel físico necesito?",
    "¿Es adecuado para viajeros solos?",
    "¿Qué aeropuerto debo utilizar?",
    "¿Qué vuelos debo reservar?",
    "¿Qué pasa si tengo restricciones alimentarias?",
    "¿Quién será nuestro anfitrión?",
    "¿Habrá tiempo libre?",
    "¿Qué sucede si cambia alguna actividad?",
    "¿Es un viaje de lujo?",
  ].map((q) => ({
    q,
    a: q === "¿Cuántas personas participan?" ? "El grupo tiene un máximo de 12 viajeros." : "[RESPUESTA PENDIENTE]",
  })),
  finalCta: {
    heading: "Nos vemos en Oaxaca.",
    button: "Quiero ir a Oaxaca",
    note: "Consulta fechas, disponibilidad y detalles del viaje.",
  },
  contact: { email: "[EMAIL]", instagram: "[INSTAGRAM URL]", whatsapp: "[WHATSAPP CON CÓDIGO DE PAÍS]" },
  copy: {
    navTrip: "El viaje", navExperiences: "Experiencias", navItinerary: "Itinerario", navIncluded: "Qué incluye", navFaq: "FAQ", navBook: "Reservar",
    menuOpen: "Menú", menuClose: "Cerrar",
    heroAvailability: "Quedan {spots} lugares disponibles", heroBook: "Quiero reservar mi lugar", heroItinerary: "Ver itinerario", heroEyebrow: "Oaxaca, México",
    metaDuration: "Duración", metaGroup: "Grupo", metaDates: "Fechas", metaPrice: "Precio", metaSpots: "Lugares disponibles",
    storyEyebrow: "El viaje", storyLink: "Conocer el viaje →", storyCaption: "Una cocina en los Valles Centrales.",
    highlightsEyebrow: "Experiencias", highlightsTitle: "Lo que vas a vivir",
    includedEyebrow: "Qué incluye", includedTitle: "Todo lo que está incluido", includedLabel: "Incluye", notIncludedLabel: "No incluye",
    itineraryEyebrow: "Itinerario", itineraryTitle: "Ocho días, día a día", itineraryDay: "Día",
    accommodationEyebrow: "Alojamiento", accommodationTitle: "Donde vamos a dormir",
    hostEyebrow: "Anfitrión/a",
    travelerEyebrow: "Para quién es", travelerTitle: "Este viaje es para ti si…", travelerNotTitle: "Probablemente no es para ti si…", travelerNote: "Y está bien: preferimos que cada viajero llegue al viaje correcto.",
    practicalEyebrow: "Información práctica", practicalTitle: "Antes de llegar",
    testimonialsEyebrow: "Testimonios", testimonialsTitle: "Quienes ya viajaron",
    faqEyebrow: "FAQ", faqTitle: "Preguntas frecuentes",
    bookingEyebrow: "Reserva", bookingTitle: "Oaxaca", bookingFrom: "Desde", bookingIncludes: "Incluye", bookingButton: "Reservar mi lugar", bookingLimited: "Plazas limitadas · {spots} lugares disponibles", bookingQuestion: "¿Tienes dudas? Escríbenos:",
    galleryEyebrow: "Visual story", galleryMore: "Ver más fotos", galleryLess: "Ver menos",
    contactWhatsapp: "WhatsApp", contactEmail: "Email",
    footerInstagram: "Instagram", footerEmail: "Email", footerTerms: "Términos", footerPrivacy: "Privacidad", footerCancellation: "Cancelación", footerContact: "Contacto",
    stickyBook: "Quiero ir",
  },
};

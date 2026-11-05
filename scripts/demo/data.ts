// Datos de la demo guiada: viajes vitrina con viajeras ficticias.
//
// Todo lo de este archivo es de ejemplo. Los viajes, las viajeras, las solicitudes y las visitas
// son inventados para mostrar la plataforma sin datos personales reales; los correos usan el
// dominio reservado example.com y los teléfonos el prefijo 400, que no está asignado en Venezuela.
// Cuando el cliente confirme qué viajes mostrar, reemplaza estos por sus datos reales.

import type { BrandPhotoId } from "../../src/lib/brand-photos";
import type { CostCategory, InstallmentCount } from "../../src/lib/finance-types";

export interface DemoCost {
  description: string;
  category: CostCategory;
  amount: number;
  perPerson: boolean;
  itineraryDay: number | null;
}

export interface DemoTrip {
  /** UUID fijo: permite volver a cargar la demo sin duplicar y borrarla después. */
  id: string;
  slug: string;
  name: string;
  destination: string;
  country: string;
  /** Días desde hoy hasta el inicio, para que la demo siempre quede en el futuro. */
  startsInDays: number;
  days: number;
  pricePerPerson: number;
  capacity: number;
  cover: BrandPhotoId;
  finalPhoto: BrandPhotoId;
  costs: DemoCost[];
  /** Viajeras inscritas: cantidad de cuotas del plan (las que ofrece la app) y cuántas ya pagó. */
  travelers: { installments: InstallmentCount; paid: number }[];
  /** Solicitudes del formulario público que todavía no son viajeras. */
  applications: {
    status: "nueva" | "contactada" | "en_conversacion" | "confirmada";
    daysAgo: number;
  }[];
  /** Visitas diarias promedio de la landing en los últimos 30 días. */
  dailyViews: number;
  landing: {
    title: string;
    subtitle: string;
    level: string;
    story: string[];
    itinerary: { title: string; description: string }[];
    included: string[];
    notIncluded: string[];
  };
}

export const DEMO_TRIPS: DemoTrip[] = [
  {
    id: "d3e00000-0000-4000-8000-000000000001",
    slug: "demo-canaima",
    name: "Canaima y el Salto Ángel",
    destination: "Canaima",
    country: "Venezuela",
    startsInDays: 75,
    days: 5,
    pricePerPerson: 950,
    capacity: 12,
    cover: "rio-tepuyes",
    finalPhoto: "rio-tepuyes-noche",
    costs: [
      {
        description: "Vuelos internos",
        category: "variable",
        amount: 280,
        perPerson: true,
        itineraryDay: 1,
      },
      {
        description: "Campamento, 4 noches",
        category: "variable",
        amount: 220,
        perPerson: true,
        itineraryDay: null,
      },
      {
        description: "Curiara y guía local",
        category: "fijo",
        amount: 1400,
        perPerson: false,
        itineraryDay: 2,
      },
      {
        description: "Comidas",
        category: "variable",
        amount: 120,
        perPerson: true,
        itineraryDay: null,
      },
      {
        description: "Coordinadora del viaje",
        category: "equipo",
        amount: 600,
        perPerson: false,
        itineraryDay: null,
      },
    ],
    travelers: [
      { installments: 1, paid: 1 },
      { installments: 3, paid: 3 },
      { installments: 3, paid: 2 },
      { installments: 3, paid: 2 },
      { installments: 3, paid: 1 },
      { installments: 3, paid: 1 },
      { installments: 4, paid: 1 },
      { installments: 4, paid: 0 },
    ],
    applications: [
      { status: "nueva", daysAgo: 1 },
      { status: "nueva", daysAgo: 3 },
      { status: "contactada", daysAgo: 6 },
      { status: "en_conversacion", daysAgo: 9 },
    ],
    dailyViews: 18,
    landing: {
      title: "Canaima y el Salto Ángel",
      subtitle:
        "Cinco días entre tepuyes, ríos y saltos de agua, en curiara y a pie, con un grupo pequeño de mujeres.",
      level: "Moderado",
      story: [
        "Un viaje para conocer el Parque Nacional Canaima con calma: dormir frente a la laguna, remontar el río en curiara y llegar a la base del Salto Ángel.",
        "El grupo es pequeño y viaja con una coordinadora durante todo el recorrido.",
      ],
      itinerary: [
        {
          title: "Llegada a Canaima",
          description: "Vuelo a Canaima, instalación en el campamento y caminata a la laguna.",
        },
        {
          title: "Río arriba",
          description: "Navegación en curiara por el río Carrao hasta la isla Ratoncito.",
        },
        { title: "Salto Ángel", description: "Caminata por la selva hasta el mirador del salto." },
        {
          title: "Saltos de la laguna",
          description: "Recorrido por el Sapo y el Hacha, con tiempo libre.",
        },
        { title: "Regreso", description: "Desayuno en el campamento y vuelo de regreso." },
      ],
      included: [
        "Vuelos internos",
        "Alojamiento en campamento",
        "Comidas durante el recorrido",
        "Curiara y guía local",
        "Coordinadora del viaje",
      ],
      notIncluded: ["Vuelos hasta Puerto Ordaz", "Seguro de viaje", "Propinas"],
    },
  },
  {
    id: "d3e00000-0000-4000-8000-000000000002",
    slug: "demo-altiplano",
    name: "Altiplano: lagunas y salares",
    destination: "Altiplano andino",
    country: "Chile y Bolivia",
    startsInDays: 140,
    days: 8,
    pricePerPerson: 2150,
    capacity: 10,
    cover: "laguna-altiplano",
    finalPhoto: "vicunas",
    costs: [
      {
        description: "Alojamiento, 7 noches",
        category: "variable",
        amount: 640,
        perPerson: true,
        itineraryDay: null,
      },
      {
        description: "Transporte 4x4 con chofer",
        category: "fijo",
        amount: 3200,
        perPerson: false,
        itineraryDay: 3,
      },
      {
        description: "Entradas a parques",
        category: "variable",
        amount: 95,
        perPerson: true,
        itineraryDay: null,
      },
      {
        description: "Comidas",
        category: "variable",
        amount: 260,
        perPerson: true,
        itineraryDay: null,
      },
      {
        description: "Coordinadora del viaje",
        category: "equipo",
        amount: 900,
        perPerson: false,
        itineraryDay: null,
      },
    ],
    travelers: [
      { installments: 4, paid: 2 },
      { installments: 4, paid: 1 },
      { installments: 3, paid: 1 },
      { installments: 6, paid: 2 },
      { installments: 4, paid: 0 },
    ],
    applications: [
      { status: "nueva", daysAgo: 2 },
      { status: "contactada", daysAgo: 4 },
      { status: "confirmada", daysAgo: 12 },
    ],
    dailyViews: 11,
    landing: {
      title: "Altiplano: lagunas y salares",
      subtitle:
        "Ocho días por lagunas de altura, salares y volcanes, entre el norte de Chile y el sur de Bolivia.",
      level: "Exigente por la altura",
      story: [
        "Un recorrido por el altiplano con tiempo para aclimatarse: lagunas de colores, vicuñas, géiseres al amanecer y el salar más grande del mundo.",
        "El grupo viaja en 4x4 con chofer y una coordinadora durante todo el viaje.",
      ],
      itinerary: [
        {
          title: "Llegada a San Pedro",
          description: "Instalación y tarde libre para aclimatarse.",
        },
        { title: "Lagunas altiplánicas", description: "Visita a las lagunas Miscanti y Miñiques." },
        { title: "Cruce a Bolivia", description: "Frontera y lagunas Blanca y Verde." },
        { title: "Laguna Colorada", description: "Flamencos y géiseres Sol de Mañana." },
        { title: "Desierto de Siloli", description: "Árbol de piedra y lagunas del camino." },
        { title: "Salar de Uyuni", description: "Atardecer en el salar." },
        { title: "Isla Incahuasi", description: "Amanecer en el salar y caminata por la isla." },
        { title: "Regreso", description: "Traslado a Uyuni y fin del viaje." },
      ],
      included: [
        "Alojamiento",
        "Transporte 4x4 con chofer",
        "Entradas a parques",
        "Comidas del recorrido",
        "Coordinadora del viaje",
      ],
      notIncluded: ["Vuelos internacionales", "Seguro de viaje", "Propinas"],
    },
  },
];

/** Nombres ficticios. Ninguno corresponde a una viajera real. */
export const DEMO_NAMES = [
  "Andreína Salazar",
  "Carolina Mendoza",
  "Daniela Ferrer",
  "Gabriela Ortiz",
  "Isabel Rangel",
  "Mariana Colmenares",
  "Natalia Briceño",
  "Paola Villegas",
  "Valentina Ochoa",
  "Verónica Lugo",
  "Yuliana Páez",
  "Adriana Montilla",
  "Fabiola Guerra",
  "Lorena Quintero",
  "Rosa Elena Pinto",
  "Sofía Arismendi",
  "Teresa Duarte",
  "Ximena Rojas",
  "Beatriz Lander",
  "Karla Medina",
];

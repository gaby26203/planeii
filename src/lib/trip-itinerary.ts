import type { Img, ItineraryGroup, TripData } from "@/data/trip";

const CHUNK = 3;
const LEFTOVER_ID = "itinerary-restante";

const blankGroupImage = (): Img => ({ src: "", alt: "Foto del bloque del itinerario" });

/** Un bloque sin foto propia arranca con una foto de la galería del viaje, en orden. */
function poolImage(pool: Img[], index: number): Img {
  const candidate = pool[index % Math.max(1, pool.length)];
  return candidate?.src ? { ...candidate } : blankGroupImage();
}

function makeGroup(id: string, size: number): ItineraryGroup {
  return { id, size, image: blankGroupImage() };
}

export function newItineraryGroup(size = 1): ItineraryGroup {
  return makeGroup(crypto.randomUUID(), size);
}

/** Reparto inicial: 8 días → 3 + 3 + 2, sin bloques de un solo día. */
export function defaultItineraryGroups(totalDays: number): ItineraryGroup[] {
  if (totalDays <= 0) return [];
  const sizes: number[] = [];
  if (totalDays <= 3) {
    sizes.push(totalDays);
  } else if (totalDays <= 6) {
    const half = Math.floor(totalDays / 2);
    sizes.push(totalDays - half, half);
  } else {
    let left = totalDays;
    while (left > 0) {
      const size = Math.min(CHUNK, left);
      sizes.push(size);
      left -= size;
    }
    if (sizes[sizes.length - 1] === 1 && sizes.length > 1) {
      const last = sizes.pop() ?? 1;
      const before = sizes[sizes.length - 1];
      if (before !== undefined) sizes[sizes.length - 1] = before + last;
    }
  }
  return sizes.map((size, index) => makeGroup(`default-${index + 1}`, size));
}

/** Plan efectivo: tamaños ≥ 1, sin pasarse de la cantidad de días, y un bloque final para los sobrantes. */
export function itineraryGroupPlan(trip: TripData): ItineraryGroup[] {
  const total = trip.itinerary.length;
  if (total === 0) return [];
  const source = trip.itineraryGroups?.length ? trip.itineraryGroups : defaultItineraryGroups(total);
  const plan: ItineraryGroup[] = [];
  let used = 0;
  for (const group of source) {
    if (used >= total) break;
    const size = Math.min(Math.max(1, Math.floor(group.size) || 1), total - used);
    used += size;
    plan.push({ ...group, size, image: group.image ?? blankGroupImage() });
  }
  if (used < total) plan.push(makeGroup(LEFTOVER_ID, total - used));
  return plan.map((group, index) => (group.image.src ? group : { ...group, image: poolImage(trip.gallery, index) }));
}

export type ItinerarySlice = {
  group: ItineraryGroup;
  days: { day: TripData["itinerary"][number]; index: number }[];
};

/** Días que corresponden a cada bloque, con el índice real dentro de trip.itinerary. */
export function itinerarySlices(trip: TripData): ItinerarySlice[] {
  let cursor = 0;
  return itineraryGroupPlan(trip).map((group) => {
    const days = trip.itinerary
      .slice(cursor, cursor + group.size)
      .map((day, offset) => ({ day, index: cursor + offset }));
    cursor += group.size;
    return { group, days };
  });
}

/** Rango de días que cubre cada bloque, para mostrarlo en el panel. */
export function itineraryGroupRanges(trip: TripData): string[] {
  let cursor = 0;
  return itineraryGroupPlan(trip).map((group) => {
    const from = cursor + 1;
    cursor += group.size;
    return `${from}–${cursor}`;
  });
}

export function withItineraryGroups(trip: TripData, groups: ItineraryGroup[]): TripData {
  return { ...trip, itineraryGroups: groups };
}

/** Cambia el tamaño de un bloque tomando o devolviendo días del vecino: la suma nunca cambia. */
export function setItineraryGroupSize(trip: TripData, id: string, size: number): TripData {
  const plan = itineraryGroupPlan(trip);
  const index = plan.findIndex((group) => group.id === id);
  if (index < 0) return trip;
  const partner = index < plan.length - 1 ? index + 1 : index - 1;
  if (partner < 0) return trip;
  const pool = plan[index].size + plan[partner].size;
  const next = Math.min(Math.max(1, Math.floor(size) || 1), pool - 1);
  return withItineraryGroups(
    trip,
    plan.map((group, position) =>
      position === index
        ? { ...group, size: next }
        : position === partner
          ? { ...group, size: pool - next }
          : group,
    ),
  );
}

export function canAddItineraryGroup(trip: TripData): boolean {
  return itineraryGroupPlan(trip).some((group) => group.size > 1);
}

/** Suma un bloque sacándole un día al último bloque que tenga más de uno. */
export function addItineraryGroup(trip: TripData): TripData {
  const plan = itineraryGroupPlan(trip);
  const donors = plan.map((group, index) => ({ group, index })).filter(({ group }) => group.size > 1);
  const donor = donors[donors.length - 1];
  if (!donor) return trip;
  const groups = plan.map((group, index) =>
    index === donor.index ? { ...group, size: group.size - 1 } : group,
  );
  groups.push(newItineraryGroup(1));
  return withItineraryGroups(trip, groups);
}

/** Elimina un bloque y pasa sus días al anterior (o al siguiente si era el primero). */
export function removeItineraryGroup(trip: TripData, id: string): TripData {
  const plan = itineraryGroupPlan(trip);
  if (plan.length <= 1) return trip;
  const index = plan.findIndex((group) => group.id === id);
  if (index < 0) return trip;
  const target = index === 0 ? 0 : index - 1;
  const merged = plan.filter((_, position) => position !== index);
  return withItineraryGroups(
    trip,
    merged.map((group, position) =>
      position === target ? { ...group, size: group.size + plan[index].size } : group,
    ),
  );
}

/** Foto del bloque en la posición `index`, usada por el panel y por el recorte de la vista previa. */
export function setItineraryGroupImage(trip: TripData, index: number, src: string): TripData {
  const plan = itineraryGroupPlan(trip);
  if (!plan[index]) return trip;
  return withItineraryGroups(
    trip,
    plan.map((group, position) => (position === index ? { ...group, image: { ...group.image, src } } : group)),
  );
}

export function setItineraryGroupAlt(trip: TripData, index: number, alt: string): TripData {
  const plan = itineraryGroupPlan(trip);
  if (!plan[index]) return trip;
  return withItineraryGroups(
    trip,
    plan.map((group, position) => (position === index ? { ...group, image: { ...group.image, alt } } : group)),
  );
}

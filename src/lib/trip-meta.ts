import type { TripData, TripMetaItem } from "@/data/trip";

export const DEFAULT_META_ITEMS: TripMetaItem[] = [
  { id: "duration", kind: "duration" },
  { id: "group", kind: "group" },
  { id: "dates", kind: "dates" },
  { id: "price", kind: "price" },
  { id: "spots", kind: "spots" },
];

export function tripMetaItems(trip: TripData): TripMetaItem[] {
  return trip.metaItems ?? DEFAULT_META_ITEMS;
}

export function metaLabelPath(item: TripMetaItem, index: number): string {
  const paths = { duration: "copy.metaDuration", group: "copy.metaGroup", dates: "copy.metaDates", price: "copy.metaPrice", spots: "copy.metaSpots" };
  return item.kind === "custom" ? `metaItems.${index}.label` : paths[item.kind];
}

export function metaValuePath(item: TripMetaItem, index: number): string {
  const paths = { duration: "duration", group: "groupSize", dates: "datesShort", price: "price", spots: "spots" };
  return item.kind === "custom" ? `metaItems.${index}.value` : paths[item.kind];
}

export function newMetaItem(): TripMetaItem {
  return { id: crypto.randomUUID(), kind: "custom", label: "Nueva etiqueta", value: "Información" };
}
/**
 * Sistema de tags para descripciones de costos del itinerario.
 * - `TripTag`: item del catálogo por viaje (id, label, colorKey).
 * - `DescriptionNode`: nodo estructurado (texto o tag) que compone una descripción.
 *
 * La fuente de verdad es `descriptionNodes`. `description` (string plano) se
 * deriva automáticamente para búsqueda / exports / compat legacy.
 */

import { generateId } from "./finance-types";

export type TagColorKey =
  | "terracotta"
  | "amber"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "gray"
  | "teal"
  | "rose"
  | "indigo";

export interface TripTag {
  id: string;
  label: string;
  colorKey: TagColorKey;
}

export type DescriptionNode =
  | { type: "text"; value: string }
  | { type: "tag"; tagId: string; fallbackLabel: string };

/** Paleta cerrada de colores para tags — clases Tailwind estáticas seguras. */
export const TAG_COLOR_CLASSES: Record<
  TagColorKey,
  { bg: string; text: string; border: string; swatch: string }
> = {
  terracotta: {
    bg: "bg-terracotta/15",
    text: "text-terracotta",
    border: "border-terracotta/30",
    swatch: "bg-terracotta",
  },
  amber: {
    bg: "bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/30",
    swatch: "bg-amber-500",
  },
  green: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/30",
    swatch: "bg-emerald-500",
  },
  blue: {
    bg: "bg-sky-500/15",
    text: "text-sky-700 dark:text-sky-400",
    border: "border-sky-500/30",
    swatch: "bg-sky-500",
  },
  purple: {
    bg: "bg-violet-500/15",
    text: "text-violet-700 dark:text-violet-400",
    border: "border-violet-500/30",
    swatch: "bg-violet-500",
  },
  pink: {
    bg: "bg-pink-500/15",
    text: "text-pink-700 dark:text-pink-400",
    border: "border-pink-500/30",
    swatch: "bg-pink-500",
  },
  gray: {
    bg: "bg-slate-500/15",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-500/30",
    swatch: "bg-slate-500",
  },
  teal: {
    bg: "bg-teal-500/15",
    text: "text-teal-700 dark:text-teal-400",
    border: "border-teal-500/30",
    swatch: "bg-teal-500",
  },
  rose: {
    bg: "bg-rose-500/15",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-500/30",
    swatch: "bg-rose-500",
  },
  indigo: {
    bg: "bg-indigo-500/15",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-500/30",
    swatch: "bg-indigo-500",
  },
};

export const TAG_COLOR_KEYS = Object.keys(TAG_COLOR_CLASSES) as TagColorKey[];

/** Semilla por defecto — solo se aplica si `tagsInitialized` no está seteado. */
export const DEFAULT_TAG_SEEDS: Array<{ label: string; colorKey: TagColorKey }> = [
  { label: "DESAYUNO", colorKey: "amber" },
  { label: "ALMUERZO", colorKey: "amber" },
  { label: "CENA", colorKey: "amber" },
  { label: "TOUR", colorKey: "terracotta" },
  { label: "ACTIVIDAD", colorKey: "terracotta" },
  { label: "CLASE O TALLER", colorKey: "purple" },
  { label: "TRANSPORTE", colorKey: "blue" },
  { label: "HOSPEDAJE", colorKey: "indigo" },
  { label: "TIEMPO LIBRE", colorKey: "teal" },
  { label: "VIAJERAS", colorKey: "pink" },
  { label: "EQUIPO", colorKey: "rose" },
  { label: "ORGANIZADORAS", colorKey: "rose" },
  { label: "EN CASA", colorKey: "gray" },
  { label: "AFUERA", colorKey: "gray" },
  { label: "EN TOUR", colorKey: "gray" },
  { label: "LIBRE", colorKey: "green" },
  { label: "AEROPUERTO", colorKey: "blue" },
  { label: "BIENVENIDA", colorKey: "green" },
  { label: "DESPEDIDA", colorKey: "green" },
];

export function seedDefaultTags(): TripTag[] {
  return DEFAULT_TAG_SEEDS.map((s) => ({
    id: generateId(),
    label: s.label,
    colorKey: s.colorKey,
  }));
}

/** Normaliza para detección de duplicados: trim, colapsa espacios, upper. */
export function normalizeTagLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

/** Devuelve `true` si `label` ya existe en el catálogo (ignorando id opcional). */
export function isDuplicateTagLabel(
  tags: TripTag[],
  label: string,
  excludeId?: string,
): boolean {
  const norm = normalizeTagLabel(label);
  if (!norm) return false;
  return tags.some((t) => t.id !== excludeId && normalizeTagLabel(t.label) === norm);
}

/** Serializa nodos a texto plano legible para búsqueda / export. */
export function nodesToPlainText(nodes: DescriptionNode[], tags: TripTag[]): string {
  const tagById = new Map(tags.map((t) => [t.id, t]));
  return nodes
    .map((n) => {
      if (n.type === "text") return n.value;
      const label = tagById.get(n.tagId)?.label ?? n.fallbackLabel;
      return `[${label}]`;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve los tagIds únicos presentes en los nodos. */
export function collectTagIds(nodes: DescriptionNode[] | undefined): Set<string> {
  const ids = new Set<string>();
  if (!nodes) return ids;
  for (const n of nodes) if (n.type === "tag") ids.add(n.tagId);
  return ids;
}

/**
 * Convierte todos los nodos que referencian `tagId` en texto plano usando el
 * label actual del tag (o fallbackLabel si ya no existe). Colapsa nodos
 * de texto adyacentes en uno solo.
 */
export function convertTagToText(
  nodes: DescriptionNode[],
  tagId: string,
  fallbackLabel: string,
): DescriptionNode[] {
  const converted = nodes.map<DescriptionNode>((n) => {
    if (n.type === "tag" && n.tagId === tagId) {
      return { type: "text", value: fallbackLabel };
    }
    return n;
  });
  return mergeAdjacentText(converted);
}

/** Reemplaza `fromTagId` por `toTagId` (mantiene posición). */
export function replaceTagId(
  nodes: DescriptionNode[],
  fromTagId: string,
  toTagId: string,
  toLabel: string,
): DescriptionNode[] {
  return nodes.map<DescriptionNode>((n) =>
    n.type === "tag" && n.tagId === fromTagId
      ? { type: "tag", tagId: toTagId, fallbackLabel: toLabel }
      : n,
  );
}

/** Colapsa nodos de texto contiguos. */
export function mergeAdjacentText(nodes: DescriptionNode[]): DescriptionNode[] {
  const out: DescriptionNode[] = [];
  for (const n of nodes) {
    const prev = out[out.length - 1];
    if (n.type === "text" && prev && prev.type === "text") {
      prev.value += n.value;
    } else {
      out.push({ ...n });
    }
  }
  return out;
}

/** Devuelve el # de filas (costos) que contienen cada tag. */
export function countRowsByTag(
  costs: Array<{ descriptionNodes?: DescriptionNode[] }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of costs) {
    const ids = collectTagIds(c.descriptionNodes);
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Legacy fallback: si no hay nodes, devuelve un único nodo de texto. */
export function nodesFromLegacyDescription(desc: string): DescriptionNode[] {
  return desc ? [{ type: "text", value: desc }] : [];
}

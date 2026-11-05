/**
 * Comparación de cantidades entre el proyecto origen y el destino: filas por tabla de `public`
 * y objetos por bucket. La red llega inyectada en `ProjectReader`.
 */
import type { Database } from "../../src/integrations/supabase/types";
import {
  BUCKETS,
  DEFAULT_CONCURRENCY,
  DEFAULT_PAGE_SIZE,
  errorMessage,
  listAllObjects,
  MISSING_TARGET_BUCKET_HINT,
  planBucket,
  runWithConcurrency,
  type StorageApi,
  type StoredObject,
} from "./storage-copy";
import { formatTable, plural } from "./text-table";

export type PublicTable = keyof Database["public"]["Tables"];

// Con Record, el compilador exige todas las tablas de types.ts. Como `bun run typecheck` no
// revisa scripts/, e2e/verify-migration.test.ts compara esta lista con types.ts.
// `false` marca una tabla derivada: existe solo en el destino y se llena sola, así que no se
// compara con el origen.
const TABLES: Record<PublicTable, boolean> = {
  access_audit_log: true,
  account_defaults: true,
  profiles: true,
  trip_application_events: true,
  trip_application_notes: true,
  trip_applications: true,
  // La llena un trigger de `trips` para avisar cambios por Realtime; Lovable no la tiene.
  trip_change_signals: false,
  trip_documents: true,
  trip_invitations: true,
  trip_members: true,
  trip_notes: true,
  trip_page_backups: true,
  trip_page_drafts: true,
  trip_page_events: true,
  trip_page_preview_snapshots: true,
  trip_page_versions: true,
  trip_pages: true,
  trip_todos: true,
  trips: true,
  user_roles: true,
};

/** Todas las tablas de `public` que conoce el script, comparadas o no. */
export const ALL_TABLES = (Object.keys(TABLES) as PublicTable[]).sort();
/** Tablas cuyas filas se comparan entre origen y destino. */
export const PUBLIC_TABLES = ALL_TABLES.filter((t) => TABLES[t]);

export type Count = { ok: true; value: number } | { ok: false; error: string };

export interface CountRow {
  kind: "tabla" | "bucket";
  name: string;
  source: Count;
  target: Count;
  /** Solo buckets: objetos que migrate-storage todavía copiaría. */
  pending?: number;
}

export type RowStatus = "igual" | "difiere" | "error";

export interface ComparedRow extends CountRow {
  status: RowStatus;
  /** destino − origen; null si algún lado falló. */
  difference: number | null;
}

export interface Comparison {
  rows: ComparedRow[];
  differences: ComparedRow[];
}

export function compareCounts(rows: CountRow[]): Comparison {
  const compared = rows.map((row): ComparedRow => {
    if (!row.source.ok || !row.target.ok) return { ...row, status: "error", difference: null };
    const difference = row.target.value - row.source.value;
    const status = difference !== 0 || (row.pending ?? 0) > 0 ? "difiere" : "igual";
    return { ...row, status, difference };
  });
  return { rows: compared, differences: compared.filter((row) => row.status !== "igual") };
}

function countCell(count: Count): string {
  return count.ok ? String(count.value) : "error";
}

function differenceCell(row: ComparedRow): string {
  if (row.difference === null) return "-";
  return row.difference > 0 ? `+${row.difference}` : String(row.difference);
}

function explain(row: ComparedRow): string {
  const label = `${row.kind} ${row.name}`;
  const errors = [
    !row.source.ok ? `origen: ${row.source.error}` : null,
    !row.target.ok ? `destino: ${row.target.error}` : null,
  ].filter(Boolean);
  if (errors.length > 0) return `${label}: ${errors.join("; ")}`;
  const parts: string[] = [];
  if (row.difference !== 0 && row.source.ok && row.target.ok) {
    parts.push(`origen ${row.source.value}, destino ${row.target.value}`);
  }
  if (row.pending) parts.push(`${plural(row.pending, "objeto", "objetos")} por copiar`);
  return `${label}: ${parts.join("; ")}`;
}

export function formatComparison(comparison: Comparison): string {
  const tables = comparison.rows.filter((row) => row.kind === "tabla");
  const buckets = comparison.rows.filter((row) => row.kind === "bucket");
  const lines: string[] = [];
  if (tables.length > 0) {
    lines.push(
      "Tablas de public",
      "",
      formatTable(
        ["Tabla", "Origen", "Destino", "Diferencia", "Estado"],
        tables.map((row) => [
          row.name,
          countCell(row.source),
          countCell(row.target),
          differenceCell(row),
          row.status,
        ]),
        ["left", "right", "right", "right", "left"],
      ),
      "",
    );
  }
  if (buckets.length > 0) {
    lines.push(
      "Buckets de Storage",
      "",
      formatTable(
        ["Bucket", "Origen", "Destino", "Diferencia", "Por copiar", "Estado"],
        buckets.map((row) => [
          row.name,
          countCell(row.source),
          countCell(row.target),
          differenceCell(row),
          row.pending === undefined ? "-" : String(row.pending),
          row.status,
        ]),
        ["left", "right", "right", "right", "right", "left"],
      ),
      "",
    );
  }
  if (comparison.differences.length === 0) {
    lines.push("Todo coincide.");
  } else {
    lines.push(`${plural(comparison.differences.length, "diferencia", "diferencias")}:`);
    for (const row of comparison.differences) lines.push(`  - ${explain(row)}`);
  }
  return lines.join("\n");
}

export interface ProjectReader {
  countRows(table: PublicTable): Promise<number>;
  storage: StorageApi;
}

export interface CollectOptions {
  tables?: readonly PublicTable[];
  buckets?: readonly string[];
  concurrency?: number;
  pageSize?: number;
}

async function attempt<T>(
  work: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

type Listing = { ok: true; value: StoredObject[] } | { ok: false; error: string };

function listBucket(
  project: ProjectReader,
  buckets: { ok: true; value: string[] } | { ok: false; error: string },
  bucket: string,
  missingMessage: string,
  pageSize: number,
): Promise<Listing> {
  return attempt(async () => {
    if (!buckets.ok) throw new Error(`no se pudo leer la lista de buckets: ${buckets.error}`);
    if (!buckets.value.includes(bucket)) throw new Error(missingMessage);
    return listAllObjects((prefix, page) => project.storage.list(bucket, prefix, page), pageSize);
  });
}

/** Reúne los conteos de ambos proyectos. Un fallo queda en su fila y no frena al resto. */
export async function collectCounts(
  source: ProjectReader,
  target: ProjectReader,
  options: CollectOptions = {},
): Promise<CountRow[]> {
  const {
    tables = PUBLIC_TABLES,
    buckets = BUCKETS,
    concurrency = DEFAULT_CONCURRENCY,
    pageSize = DEFAULT_PAGE_SIZE,
  } = options;

  const tableRows: CountRow[] = tables.map((name) => ({
    kind: "tabla",
    name,
    source: { ok: false, error: "sin contar" },
    target: { ok: false, error: "sin contar" },
  }));
  await runWithConcurrency(tableRows, concurrency, async (row) => {
    const table = row.name as PublicTable;
    [row.source, row.target] = await Promise.all([
      attempt(() => source.countRows(table)),
      attempt(() => target.countRows(table)),
    ]);
  });

  const [sourceBuckets, targetBuckets] = await Promise.all([
    attempt(() => source.storage.listBuckets()),
    attempt(() => target.storage.listBuckets()),
  ]);
  const bucketRows: CountRow[] = [];
  for (const bucket of buckets) {
    const [sourceObjects, targetObjects] = await Promise.all([
      listBucket(source, sourceBuckets, bucket, "el bucket no existe", pageSize),
      listBucket(
        target,
        targetBuckets,
        bucket,
        `el bucket no existe. ${MISSING_TARGET_BUCKET_HINT}`,
        pageSize,
      ),
    ]);
    const row: CountRow = {
      kind: "bucket",
      name: bucket,
      source: sourceObjects.ok
        ? { ok: true, value: sourceObjects.value.length }
        : { ok: false, error: sourceObjects.error },
      target: targetObjects.ok
        ? { ok: true, value: targetObjects.value.length }
        : { ok: false, error: targetObjects.error },
    };
    if (sourceObjects.ok && targetObjects.ok) {
      row.pending = planBucket(sourceObjects.value, targetObjects.value).toCopy.length;
    }
    bucketRows.push(row);
  }
  return [...tableRows, ...bucketRows];
}

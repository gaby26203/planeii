/**
 * Copia de Storage entre dos proyectos Supabase, sin entrada ni salida propias: todo lo que
 * habla con la red llega como un `StorageApi`. La usan scripts/migrate-storage.ts y
 * scripts/verify-migration.ts; los tests le pasan implementaciones falsas.
 */
import { formatTable, plural } from "./text-table";

/** Los tres buckets privados de la app. Las rutas llevan el uid y el id del viaje. */
export const BUCKETS = ["trip-covers", "trip-notes-docs", "trip-page-images"] as const;
/** Migración que crea los buckets en un proyecto nuevo. */
export const BUCKETS_MIGRATION =
  "supabase/migrations/20261015120000_self_hosting_storage_and_grants.sql";
export const DEFAULT_PAGE_SIZE = 100;
export const DEFAULT_CONCURRENCY = 4;
const DEFAULT_CACHE_SECONDS = "3600";
const FALLBACK_CONTENT_TYPE = "application/octet-stream";

/** Entrada tal como la devuelve `storage.list`: las carpetas vienen con `id` null. */
export interface ListEntry {
  name: string;
  id: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface Page {
  offset: number;
  limit: number;
}

export interface DownloadedFile {
  data: ArrayBuffer;
  contentType: string | null;
}

export interface UploadOptions {
  contentType: string;
  /** Segundos de `max-age`, como los recibe `storage.upload`. */
  cacheControl: string;
}

/** Lo mínimo que los scripts necesitan del Storage de un proyecto. */
export interface StorageApi {
  listBuckets(): Promise<string[]>;
  list(bucket: string, prefix: string, page: Page): Promise<ListEntry[]>;
  download(bucket: string, path: string): Promise<DownloadedFile>;
  upload(bucket: string, path: string, data: ArrayBuffer, options: UploadOptions): Promise<void>;
}

export interface StoredObject {
  path: string;
  id: string | null;
  updatedAt: string | null;
  size: number | null;
  contentType: string | null;
  cacheControl: string | null;
}

export type ListFolder = (prefix: string, page: Page) => Promise<ListEntry[]>;

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function toStoredObject(path: string, entry: ListEntry): StoredObject {
  const metadata = entry.metadata ?? {};
  return {
    path,
    id: entry.id,
    updatedAt: stringOrNull(entry.updated_at),
    size: typeof metadata.size === "number" ? metadata.size : null,
    contentType: stringOrNull(metadata.mimetype),
    cacheControl: stringOrNull(metadata.cacheControl),
  };
}

/**
 * Recorre un bucket completo: entra en cada carpeta y pide páginas hasta recibir una
 * incompleta. Devuelve solo archivos, ordenados por ruta.
 */
export async function listAllObjects(
  list: ListFolder,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<StoredObject[]> {
  const objects: StoredObject[] = [];
  const folders = [""];
  while (folders.length > 0) {
    const prefix = folders.shift() as string;
    for (let offset = 0; ; offset += pageSize) {
      const entries = await list(prefix, { offset, limit: pageSize });
      for (const entry of entries) {
        if (!entry.name) continue;
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null || entry.id === undefined) folders.push(path);
        else objects.push(toStoredObject(path, entry));
      }
      if (entries.length < pageSize) break;
    }
  }
  return objects.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export interface CopyTask {
  object: StoredObject;
  reason: string;
}

export interface BucketPlan {
  toCopy: CopyTask[];
  skipped: StoredObject[];
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  const left = Date.parse(a);
  const right = Date.parse(b);
  return Number.isNaN(left) || Number.isNaN(right) ? a === b : left === right;
}

/**
 * Una fila de `storage.objects` con el mismo id y la misma fecha que en el origen no la subió
 * este script: llegó con un volcado que incluía el esquema `storage`, y el archivo puede no
 * existir en el destino. Tras subirlo, la fecha cambia y la siguiente corrida ya lo salta.
 */
function isRestoredRow(source: StoredObject, target: StoredObject): boolean {
  return (
    source.id !== null && source.id === target.id && sameInstant(source.updatedAt, target.updatedAt)
  );
}

/** Decide qué copiar: se salta lo que ya está en el destino con el mismo tamaño. */
export function planBucket(source: StoredObject[], target: StoredObject[]): BucketPlan {
  const targetByPath = new Map(target.map((object) => [object.path, object]));
  const plan: BucketPlan = { toCopy: [], skipped: [] };
  for (const object of source) {
    const existing = targetByPath.get(object.path);
    let reason: string | null;
    if (!existing) reason = "no está en el destino";
    else if (object.size === null) reason = "el origen no informa su tamaño";
    else if (existing.size !== object.size)
      reason = `tamaño distinto (origen ${object.size} B, destino ${existing.size ?? "?"} B)`;
    else if (isRestoredRow(object, existing))
      reason = "en el destino solo está la fila restaurada del volcado";
    else reason = null;

    if (reason === null) plan.skipped.push(object);
    else plan.toCopy.push({ object, reason });
  }
  return plan;
}

/** `max-age=3600` → `3600`, que es lo que espera `storage.upload`. */
export function cacheSeconds(cacheControl: string | null): string {
  const match = cacheControl?.match(/max-age=(\d+)/);
  return match ? match[1] : DEFAULT_CACHE_SECONDS;
}

export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lanes = Math.max(1, Math.min(limit, items.length));
  await Promise.all(
    Array.from({ length: lanes }, async () => {
      while (next < items.length) {
        const index = next++;
        await worker(items[index], index);
      }
    }),
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

async function copyObject(
  bucket: string,
  object: StoredObject,
  source: StorageApi,
  target: StorageApi,
): Promise<void> {
  let file: DownloadedFile;
  try {
    file = await source.download(bucket, object.path);
  } catch (error) {
    throw new Error(`no se pudo descargar del origen: ${errorMessage(error)}`);
  }
  if (object.size !== null && file.data.byteLength !== object.size) {
    throw new Error(
      `la descarga trajo ${file.data.byteLength} B y el origen informa ${object.size} B`,
    );
  }
  try {
    await target.upload(bucket, object.path, file.data, {
      contentType: object.contentType ?? file.contentType ?? FALLBACK_CONTENT_TYPE,
      cacheControl: cacheSeconds(object.cacheControl),
    });
  } catch (error) {
    throw new Error(`no se pudo subir al destino: ${errorMessage(error)}`);
  }
}

export interface FailedObject {
  path: string;
  message: string;
}

export interface BucketReport {
  bucket: string;
  dryRun: boolean;
  /** Lo que impidió procesar el bucket entero, por ejemplo que no exista. */
  problem: string | null;
  /** Objetos que había que copiar (en simulación, los que se copiarían). */
  planned: CopyTask[];
  copied: string[];
  skipped: number;
  failed: FailedObject[];
}

export interface MigrateOptions {
  source: StorageApi;
  target: StorageApi;
  buckets?: readonly string[];
  dryRun?: boolean;
  concurrency?: number;
  pageSize?: number;
  log?: (line: string) => void;
}

async function bucketIds(api: StorageApi, label: string): Promise<Set<string>> {
  try {
    return new Set(await api.listBuckets());
  } catch (error) {
    throw new Error(`No se pudo leer la lista de buckets del ${label}: ${errorMessage(error)}`);
  }
}

/** Qué hacer si un bucket falta en el destino. */
export const MISSING_TARGET_BUCKET_HINT = `Lo crea la migración ${BUCKETS_MIGRATION}; aplícala en el destino.`;

/**
 * Copia los buckets uno por uno. Un objeto que falla queda en el informe y no frena al resto.
 * Si no se puede leer la lista de buckets de un proyecto, lanza un error: suele ser la URL o la
 * clave.
 */
export async function migrateStorage(options: MigrateOptions): Promise<BucketReport[]> {
  const {
    source,
    target,
    buckets = BUCKETS,
    dryRun = false,
    concurrency = DEFAULT_CONCURRENCY,
    pageSize = DEFAULT_PAGE_SIZE,
    log = () => {},
  } = options;
  const sourceBuckets = await bucketIds(source, "origen");
  const targetBuckets = await bucketIds(target, "destino");
  const reports: BucketReport[] = [];

  for (const bucket of buckets) {
    const report: BucketReport = {
      bucket,
      dryRun,
      problem: null,
      planned: [],
      copied: [],
      skipped: 0,
      failed: [],
    };
    reports.push(report);

    if (!sourceBuckets.has(bucket)) {
      report.problem = "no existe en el origen. Revisa SOURCE_SUPABASE_URL.";
      log(`[${bucket}] AVISO: ${report.problem}`);
      continue;
    }
    const targetExists = targetBuckets.has(bucket);
    if (!targetExists) {
      report.problem = `no existe en el destino. ${MISSING_TARGET_BUCKET_HINT} Después vuelve a correr este script.`;
      log(`[${bucket}] AVISO: ${report.problem}`);
    }

    let plan: BucketPlan;
    try {
      const sourceObjects = await listAllObjects(
        (prefix, page) => source.list(bucket, prefix, page),
        pageSize,
      );
      const targetObjects = targetExists
        ? await listAllObjects((prefix, page) => target.list(bucket, prefix, page), pageSize)
        : [];
      plan = planBucket(sourceObjects, targetObjects);
    } catch (error) {
      report.problem = `no se pudo listar: ${errorMessage(error)}`;
      log(`[${bucket}] AVISO: ${report.problem}`);
      continue;
    }

    report.planned = plan.toCopy;
    report.skipped = plan.skipped.length;
    const skipped = plan.skipped.length;
    log(
      `[${bucket}] ${plural(plan.toCopy.length + skipped, "objeto", "objetos")} en el origen: ` +
        `${skipped} ${skipped === 1 ? "ya está" : "ya están"} en el destino, ` +
        `${plan.toCopy.length} por copiar.`,
    );

    if (dryRun) {
      for (const task of plan.toCopy)
        log(`[${bucket}] copiaría ${task.object.path} (${task.reason})`);
      continue;
    }
    if (!targetExists) continue;

    const total = plan.toCopy.length;
    await runWithConcurrency(plan.toCopy, concurrency, async (task) => {
      const { path } = task.object;
      try {
        await copyObject(bucket, task.object, source, target);
        report.copied.push(path);
        log(`[${bucket}] copiado ${report.copied.length + report.failed.length}/${total} ${path}`);
      } catch (error) {
        const message = errorMessage(error);
        report.failed.push({ path, message });
        log(
          `[${bucket}] FALLÓ ${report.copied.length + report.failed.length}/${total} ${path}: ${message}`,
        );
      }
    });
    report.copied.sort();
    report.failed.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }
  return reports;
}

/** Resumen final: una fila por bucket y, debajo, cada problema y cada objeto fallido. */
export function formatStorageSummary(reports: BucketReport[]): string {
  const dryRun = reports.some((report) => report.dryRun);
  const table = dryRun
    ? formatTable(
        ["Bucket", "Por copiar", "Saltados"],
        reports.map((r) => [r.bucket, String(r.planned.length), String(r.skipped)]),
        ["left", "right", "right"],
      )
    : formatTable(
        ["Bucket", "Copiados", "Saltados", "Fallidos"],
        reports.map((r) => [
          r.bucket,
          String(r.copied.length),
          String(r.skipped),
          String(r.failed.length),
        ]),
        ["left", "right", "right", "right"],
      );

  const lines = [dryRun ? "Resumen (simulación, no se escribió nada)" : "Resumen", "", table];
  for (const report of reports) {
    if (report.problem) lines.push("", `${report.bucket}: ${report.problem}`);
    if (report.failed.length > 0) {
      lines.push("", `Fallos en ${report.bucket}:`);
      for (const failure of report.failed) lines.push(`  - ${failure.path}: ${failure.message}`);
    }
  }

  lines.push("");
  if (storageExitCode(reports) !== 0 && dryRun) {
    lines.push("Hay problemas que impedirían la copia. Corrígelos antes de correr sin --dry-run.");
  } else if (storageExitCode(reports) !== 0) {
    lines.push(
      "Hubo problemas. Corrígelos y vuelve a correr el script: los objetos ya copiados se saltan.",
    );
  } else if (dryRun) {
    lines.push("Sin problemas. Corre el script sin --dry-run para copiar.");
  } else {
    lines.push("Todo copiado.");
  }
  return lines.join("\n");
}

export function storageExitCode(reports: BucketReport[]): number {
  return reports.some((report) => report.problem !== null || report.failed.length > 0) ? 1 : 0;
}

export interface MigrateArgs {
  dryRun: boolean;
  concurrency: number;
  help: boolean;
}

export const MIGRATE_USAGE = [
  "Uso: bun scripts/migrate-storage.ts [--dry-run] [--concurrency=N]",
  "",
  "Copia los buckets trip-covers, trip-notes-docs y trip-page-images del proyecto origen al",
  "destino, con las mismas rutas. Salta lo que ya está en el destino con el mismo tamaño.",
  "",
  "  --dry-run         Lista lo que copiaría sin escribir nada.",
  `  --concurrency=N   Objetos en paralelo (por defecto ${DEFAULT_CONCURRENCY}).`,
  "",
  "Variables: SOURCE_SUPABASE_URL, SOURCE_SERVICE_ROLE_KEY, TARGET_SUPABASE_URL,",
  "TARGET_SERVICE_ROLE_KEY.",
].join("\n");

export function parseMigrateArgs(argv: readonly string[]): MigrateArgs {
  const args: MigrateArgs = { dryRun: false, concurrency: DEFAULT_CONCURRENCY, help: false };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg.startsWith("--concurrency=")) {
      const value = Number(arg.slice("--concurrency=".length));
      if (!Number.isInteger(value) || value < 1 || value > 32) {
        throw new Error("--concurrency tiene que ser un entero entre 1 y 32.");
      }
      args.concurrency = value;
    } else {
      throw new Error(`Opción desconocida: ${arg}`);
    }
  }
  return args;
}

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  BUCKETS_MIGRATION,
  cacheSeconds,
  formatStorageSummary,
  listAllObjects,
  migrateStorage,
  parseMigrateArgs,
  planBucket,
  runWithConcurrency,
  storageExitCode,
  type ListEntry,
  type Page,
  type StoredObject,
} from "../scripts/lib/storage-copy";
import { createServiceClient, supabaseStorageApi } from "../scripts/lib/supabase-projects";
import { FakeProject } from "./support/fake-supabase";

const UID = "6f1c0a3e-0000-4000-8000-000000000001";
const TRIP = "a2b4c6d8-0000-4000-8000-000000000002";

/** Lister en memoria: arma las entradas de una carpeta como lo hace storage.list. */
function memoryLister(paths: string[], calls: { prefix: string; page: Page }[] = []) {
  return async (prefix: string, page: Page): Promise<ListEntry[]> => {
    calls.push({ prefix, page });
    const base = prefix ? `${prefix}/` : "";
    const entries = new Map<string, ListEntry>();
    for (const path of paths) {
      if (!path.startsWith(base)) continue;
      const [name, ...rest] = path.slice(base.length).split("/");
      entries.set(
        name,
        rest.length > 0
          ? { name, id: null, metadata: null }
          : { name, id: `id-${path}`, metadata: { size: path.length, mimetype: "image/png" } },
      );
    }
    return [...entries.values()]
      .sort((a, b) => (a.name < b.name ? -1 : 1))
      .slice(page.offset, page.offset + page.limit);
  };
}

function object(
  path: string,
  size: number | null,
  extra: Partial<StoredObject> = {},
): StoredObject {
  return {
    path,
    id: `src-${path}`,
    updatedAt: "2026-10-01T12:00:00.000Z",
    size,
    contentType: "image/jpeg",
    cacheControl: "max-age=3600",
    ...extra,
  };
}

function projects(source: FakeProject, target: FakeProject) {
  return {
    source: supabaseStorageApi(
      createServiceClient(
        { url: "https://origen.test", serviceRoleKey: "clave-origen" },
        source.fetch,
      ),
    ),
    target: supabaseStorageApi(
      createServiceClient(
        { url: "https://destino.test", serviceRoleKey: "clave-destino" },
        target.fetch,
      ),
    ),
  };
}

describe("recorrido del bucket", () => {
  test("entra en carpetas anidadas y devuelve solo archivos", async () => {
    const paths = [
      `${UID}/${TRIP}/portada.jpg`,
      `${UID}/${TRIP}/vieja.png`,
      `${TRIP}/viajeras/enrollee-1/pasaporte.pdf`,
      `${TRIP}/doc.pdf`,
      "suelto.txt",
    ];
    const objects = await listAllObjects(memoryLister(paths));
    expect(objects.map((o) => o.path)).toEqual([...paths].sort());
    expect(objects.find((o) => o.path === "suelto.txt")?.size).toBe("suelto.txt".length);
  });

  test("pide páginas hasta recibir una incompleta", async () => {
    const paths = Array.from({ length: 5 }, (_, i) => `${TRIP}/foto-${i}.jpg`);
    const calls: { prefix: string; page: Page }[] = [];
    const objects = await listAllObjects(memoryLister(paths, calls), 2);
    expect(objects).toHaveLength(5);
    expect(calls.filter((c) => c.prefix === TRIP).map((c) => c.page.offset)).toEqual([0, 2, 4]);
  });

  test("una página exacta pide una más y termina con la vacía", async () => {
    const calls: { prefix: string; page: Page }[] = [];
    await listAllObjects(memoryLister(["a.jpg", "b.jpg"], calls), 2);
    expect(calls.map((c) => c.page.offset)).toEqual([0, 2]);
  });
});

describe("decisión de copiar o saltar", () => {
  test("salta lo que ya está con el mismo tamaño y copia lo demás", () => {
    const plan = planBucket(
      [
        object("igual.jpg", 10),
        object("distinto.jpg", 10),
        object("nuevo.jpg", 3),
        object("sin-tamano.jpg", null),
      ],
      [
        object("igual.jpg", 10, { id: "dst-1", updatedAt: "2026-11-05T10:00:00.000Z" }),
        object("distinto.jpg", 7, { id: "dst-2" }),
        object("sobra-en-destino.jpg", 1),
      ],
    );
    expect(plan.skipped.map((o) => o.path)).toEqual(["igual.jpg"]);
    expect(plan.toCopy.map((t) => t.object.path)).toEqual([
      "distinto.jpg",
      "nuevo.jpg",
      "sin-tamano.jpg",
    ]);
    expect(plan.toCopy[0].reason).toContain("tamaño distinto");
  });

  test("no confía en una fila restaurada del volcado aunque coincida el tamaño", () => {
    const source = object("portada.jpg", 10);
    const restored = { ...source, updatedAt: "2026-10-01T12:00:00Z" };
    const plan = planBucket([source], [restored]);
    expect(plan.skipped).toHaveLength(0);
    expect(plan.toCopy[0].reason).toContain("fila restaurada");
  });

  test("cacheControl se pasa en segundos", () => {
    expect(cacheSeconds("max-age=86400")).toBe("86400");
    expect(cacheSeconds("no-cache")).toBe("3600");
    expect(cacheSeconds(null)).toBe("3600");
  });
});

describe("concurrencia", () => {
  test("nunca corre más tareas que el límite", async () => {
    let active = 0;
    let peak = 0;
    const done: number[] = [];
    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      done.push(n);
      active--;
    });
    expect(peak).toBe(4);
    expect(done.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe("copia entre proyectos con supabase-js", () => {
  const seed = () =>
    new FakeProject({
      buckets: {
        "trip-covers": {
          [`${UID}/${TRIP}/1700.jpg`]: "jpg-portada",
          [`${UID}/${TRIP}/1800.webp`]: { body: "webp-portada", contentType: "image/webp" },
        },
        "trip-notes-docs": {
          [`${TRIP}/doc-1.pdf`]: { body: "%PDF-1", contentType: "application/pdf" },
          [`${TRIP}/viajeras/e-1/1700-pasaporte.pdf`]: {
            body: "%PDF-2",
            contentType: "application/pdf",
          },
        },
        "trip-page-images": {
          [`${TRIP}/foto-1.jpg`]: "foto-1",
          [`${TRIP}/foto-2.jpg`]: "foto-2",
          [`${TRIP}/foto-3.png`]: { body: "foto-3", contentType: "image/png" },
        },
      },
    });
  const emptyTarget = () =>
    new FakeProject({
      buckets: { "trip-covers": {}, "trip-notes-docs": {}, "trip-page-images": {} },
    });

  test("copia todo con las mismas rutas, tipo y cacheControl, paginando", async () => {
    const source = seed();
    const target = emptyTarget();
    const reports = await migrateStorage({ ...projects(source, target), pageSize: 2 });

    expect(storageExitCode(reports)).toBe(0);
    for (const [bucket, objects] of source.buckets) {
      const copied = target.buckets.get(bucket);
      expect([...(copied?.keys() ?? [])].sort()).toEqual([...objects.keys()].sort());
      for (const [path, original] of objects) {
        const copy = copied?.get(path);
        expect(new TextDecoder().decode(copy?.body)).toBe(new TextDecoder().decode(original.body));
        expect(copy?.contentType).toBe(original.contentType);
        expect(copy?.cacheControl).toBe("max-age=3600");
      }
    }
    // Tres fotos con páginas de dos: offsets 0 y 2 en la carpeta del viaje.
    const imageLists = source.requests.filter(
      (r) => r.path === "/storage/v1/object/list/trip-page-images",
    );
    expect(imageLists.length).toBe(3);
    expect(reports.map((r) => [r.bucket, r.copied.length, r.skipped, r.failed.length])).toEqual([
      ["trip-covers", 2, 0, 0],
      ["trip-notes-docs", 2, 0, 0],
      ["trip-page-images", 3, 0, 0],
    ]);
    expect(formatStorageSummary(reports)).toContain("Todo copiado.");
  });

  test("es reanudable: la segunda corrida salta lo que ya está con el mismo tamaño", async () => {
    const source = seed();
    const target = emptyTarget();
    target.buckets.get("trip-page-images")?.set(`${TRIP}/foto-1.jpg`, {
      body: new TextEncoder().encode("otro-1"),
      contentType: "image/jpeg",
      cacheControl: "max-age=3600",
      id: "ya-copiado",
      updatedAt: "2026-11-05T09:00:00.000Z",
    });
    const first = await migrateStorage(projects(source, target));
    expect(first.find((r) => r.bucket === "trip-page-images")?.skipped).toBe(1);
    expect(first.find((r) => r.bucket === "trip-page-images")?.copied).toHaveLength(2);

    const uploadsBefore = target.writes().length;
    const second = await migrateStorage(projects(source, target));
    expect(target.writes().length).toBe(uploadsBefore);
    expect(second.every((r) => r.copied.length === 0 && r.failed.length === 0)).toBe(true);
    expect(second.map((r) => r.skipped)).toEqual([2, 2, 3]);
  });

  test("reemplaza el objeto si en el destino tiene otro tamaño", async () => {
    const source = seed();
    const target = emptyTarget();
    const path = `${TRIP}/foto-2.jpg`;
    target.buckets.get("trip-page-images")?.set(path, {
      body: new TextEncoder().encode("cortado"),
      contentType: "image/jpeg",
      cacheControl: "max-age=3600",
      id: "parcial",
      updatedAt: "2026-11-05T09:00:00.000Z",
    });
    await migrateStorage(projects(source, target));
    expect(new TextDecoder().decode(target.buckets.get("trip-page-images")?.get(path)?.body)).toBe(
      "foto-2",
    );
  });

  test("vuelve a subir los objetos que solo llegaron como fila del volcado", async () => {
    const source = seed();
    const target = emptyTarget();
    const path = `${UID}/${TRIP}/1700.jpg`;
    target.restoreRowFrom(source, "trip-covers", path);

    const reports = await migrateStorage(projects(source, target));
    expect(reports[0].copied).toContain(path);
    expect(new TextDecoder().decode(target.buckets.get("trip-covers")?.get(path)?.body)).toBe(
      "jpg-portada",
    );

    const again = await migrateStorage(projects(source, target));
    expect(again[0].copied).toHaveLength(0);
  });

  test("un objeto que falla no frena al resto y el código de salida es 1", async () => {
    const source = seed();
    const target = emptyTarget();
    const broken = `${TRIP}/foto-2.jpg`;
    const rejected = `${TRIP}/doc-1.pdf`;
    source.failDownloads.add(broken);
    target.failUploads.add(rejected);

    const reports = await migrateStorage(projects(source, target));
    const images = reports.find((r) => r.bucket === "trip-page-images");
    expect(images?.copied).toEqual([`${TRIP}/foto-1.jpg`, `${TRIP}/foto-3.png`]);
    expect(images?.failed.map((f) => f.path)).toEqual([broken]);
    expect(images?.failed[0].message).toContain("no se pudo descargar");
    const docs = reports.find((r) => r.bucket === "trip-notes-docs");
    expect(docs?.failed.map((f) => f.path)).toEqual([rejected]);
    expect(docs?.failed[0].message).toContain("no se pudo subir");
    expect(reports.find((r) => r.bucket === "trip-covers")?.copied).toHaveLength(2);

    expect(storageExitCode(reports)).toBe(1);
    const summary = formatStorageSummary(reports);
    expect(summary).toContain(`  - ${broken}: no se pudo descargar del origen`);
    expect(summary).toContain(`  - ${rejected}: no se pudo subir al destino`);
    expect(summary).toMatch(/trip-page-images\s+2\s+0\s+1/);
  });

  test("dry-run lista lo que copiaría sin escribir en el destino", async () => {
    const source = seed();
    const target = emptyTarget();
    const lines: string[] = [];
    const reports = await migrateStorage({
      ...projects(source, target),
      dryRun: true,
      log: (l) => lines.push(l),
    });

    expect(target.writes()).toEqual([]);
    expect([...target.buckets.values()].every((b) => b.size === 0)).toBe(true);
    expect(source.requests.some((r) => r.path.startsWith("/storage/v1/object/trip-"))).toBe(false);
    expect(reports.map((r) => r.planned.length)).toEqual([2, 2, 3]);
    expect(lines).toContain(
      `[trip-covers] copiaría ${UID}/${TRIP}/1700.jpg (no está en el destino)`,
    );
    expect(storageExitCode(reports)).toBe(0);
    expect(formatStorageSummary(reports)).toContain("simulación");
  });

  test("avisa si falta un bucket en el destino y sigue con los demás", async () => {
    const source = seed();
    const target = new FakeProject({ buckets: { "trip-covers": {}, "trip-notes-docs": {} } });
    const reports = await migrateStorage(projects(source, target));

    const images = reports.find((r) => r.bucket === "trip-page-images");
    expect(images?.problem).toContain(BUCKETS_MIGRATION);
    expect(images?.planned).toHaveLength(3);
    expect(reports.find((r) => r.bucket === "trip-covers")?.copied).toHaveLength(2);
    expect(storageExitCode(reports)).toBe(1);
    expect(formatStorageSummary(reports)).toContain(
      "20261015120000_self_hosting_storage_and_grants.sql",
    );
  });

  test("respeta la concurrencia pedida", async () => {
    const source = seed();
    source.downloadDelayMs = 10;
    await migrateStorage({ ...projects(source, emptyTarget()), concurrency: 2 });
    expect(source.maxInFlightDownloads).toBe(2);
  });
});

describe("argumentos y entrada", () => {
  test("lee --dry-run y --concurrency", () => {
    expect(parseMigrateArgs([])).toEqual({ dryRun: false, concurrency: 4, help: false });
    expect(parseMigrateArgs(["--dry-run", "--concurrency=8"])).toEqual({
      dryRun: true,
      concurrency: 8,
      help: false,
    });
    expect(() => parseMigrateArgs(["--concurrency=0"])).toThrow("entero");
    expect(() => parseMigrateArgs(["--dryrun"])).toThrow("Opción desconocida");
  });

  test("sin variables, el script explica cuáles faltan y sale con 2", () => {
    const result = Bun.spawnSync({
      cmd: [process.execPath, join(import.meta.dir, "../scripts/migrate-storage.ts")],
      env: { PATH: process.env.PATH ?? "" },
    });
    expect(result.exitCode).toBe(2);
    const stderr = result.stderr.toString();
    expect(stderr).toContain(
      "SOURCE_SUPABASE_URL, SOURCE_SERVICE_ROLE_KEY, TARGET_SUPABASE_URL, TARGET_SERVICE_ROLE_KEY",
    );
    expect(stderr).toContain("--dry-run");
  });
});

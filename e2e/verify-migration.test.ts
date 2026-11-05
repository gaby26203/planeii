import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PUBLIC_TABLES,
  collectCounts,
  compareCounts,
  formatComparison,
  type CountRow,
  type ProjectReader,
} from "../scripts/lib/migration-counts";
import {
  countRows,
  createServiceClient,
  readProjects,
  supabaseStorageApi,
} from "../scripts/lib/supabase-projects";
import { FakeProject } from "./support/fake-supabase";

const TRIP = "a2b4c6d8-0000-4000-8000-000000000002";

function reader(project: FakeProject, url: string): ProjectReader {
  const client = createServiceClient({ url, serviceRoleKey: "clave" }, project.fetch);
  return { countRows: (table) => countRows(client, table), storage: supabaseStorageApi(client) };
}

function seed(
  overrides: { tables?: Record<string, number>; images?: Record<string, string> } = {},
) {
  const tables = Object.fromEntries(PUBLIC_TABLES.map((t, i) => [t, i * 3]));
  return new FakeProject({
    tables: { ...tables, ...overrides.tables },
    buckets: {
      "trip-covers": { [`uid/${TRIP}/1700.jpg`]: "portada" },
      "trip-notes-docs": { [`${TRIP}/viajeras/e-1/pasaporte.pdf`]: "pdf" },
      "trip-page-images": overrides.images ?? { [`${TRIP}/a.jpg`]: "a", [`${TRIP}/b.jpg`]: "b" },
    },
  });
}

/** El destino recibe los objetos por la API, con ids y fechas propios. */
function copyOf(source: FakeProject): FakeProject {
  const target = new FakeProject({ tables: Object.fromEntries(source.tables) });
  for (const [bucket, objects] of source.buckets) {
    target.buckets.set(
      bucket,
      new Map(
        [...objects].map(([path, o]) => [
          path,
          { ...o, id: `copia-${path}`, updatedAt: "2026-11-05T10:00:00.000Z" },
        ]),
      ),
    );
  }
  return target;
}

const ok = (value: number) => ({ ok: true as const, value });

describe("lista de tablas", () => {
  test("coincide con Database['public']['Tables'] de types.ts", () => {
    const types = readFileSync(
      join(import.meta.dir, "../src/integrations/supabase/types.ts"),
      "utf8",
    );
    const block = types.slice(types.indexOf("  public: {"), types.indexOf("    Views: {"));
    const names = [...block.matchAll(/^ {6}([a-z_]+): \{$/gm)].map((m) => m[1]).sort();
    expect(names.length).toBeGreaterThan(10);
    expect(PUBLIC_TABLES).toEqual(names as typeof PUBLIC_TABLES);
  });
});

describe("comparación", () => {
  test("sin diferencias", () => {
    const rows: CountRow[] = [
      { kind: "tabla", name: "trips", source: ok(12), target: ok(12) },
      { kind: "bucket", name: "trip-covers", source: ok(5), target: ok(5), pending: 0 },
    ];
    const comparison = compareCounts(rows);
    expect(comparison.differences).toEqual([]);
    expect(comparison.rows.map((r) => r.status)).toEqual(["igual", "igual"]);
    const text = formatComparison(comparison);
    expect(text).toContain("Todo coincide.");
    expect(text).toMatch(/trips\s+12\s+12\s+0\s+igual/);
  });

  test("con diferencias, faltantes por copiar y errores", () => {
    const comparison = compareCounts([
      { kind: "tabla", name: "trips", source: ok(12), target: ok(12) },
      { kind: "tabla", name: "trip_pages", source: ok(5), target: ok(4) },
      { kind: "tabla", name: "trip_page_events", source: ok(10), target: ok(11) },
      {
        kind: "tabla",
        name: "trip_todos",
        source: ok(3),
        target: { ok: false, error: "sin conteo" },
      },
      { kind: "bucket", name: "trip-covers", source: ok(5), target: ok(5), pending: 2 },
    ]);
    expect(comparison.differences.map((r) => [r.name, r.status, r.difference])).toEqual([
      ["trip_pages", "difiere", -1],
      ["trip_page_events", "difiere", 1],
      ["trip_todos", "error", null],
      ["trip-covers", "difiere", 0],
    ]);
    const text = formatComparison(comparison);
    expect(text).toMatch(/trip_pages\s+5\s+4\s+-1\s+difiere/);
    expect(text).toMatch(/trip_page_events\s+10\s+11\s+\+1\s+difiere/);
    expect(text).toMatch(/trip_todos\s+3\s+error\s+-\s+error/);
    expect(text).toMatch(/trip-covers\s+5\s+5\s+0\s+2\s+difiere/);
    expect(text).toContain("4 diferencias:");
    expect(text).toContain("  - tabla trip_pages: origen 5, destino 4");
    expect(text).toContain("  - tabla trip_todos: destino: sin conteo");
    expect(text).toContain("  - bucket trip-covers: 2 objetos por copiar");
  });
});

describe("conteos con supabase-js", () => {
  test("dos proyectos iguales no tienen diferencias", async () => {
    const source = seed();
    const target = copyOf(source);
    const rows = await collectCounts(
      reader(source, "https://origen.test"),
      reader(target, "https://destino.test"),
    );
    const comparison = compareCounts(rows);
    expect(comparison.differences).toEqual([]);
    expect(rows.filter((r) => r.kind === "tabla")).toHaveLength(PUBLIC_TABLES.length);
    expect(rows.find((r) => r.name === "trip-page-images")).toMatchObject({
      source: ok(2),
      target: ok(2),
      pending: 0,
    });
    // Cuenta con HEAD y count=exact: no baja filas.
    expect(
      target.requests
        .filter((r) => r.path.startsWith("/rest/v1/"))
        .every((r) => r.method === "HEAD"),
    ).toBe(true);
  });

  test("detecta filas y objetos faltantes, tablas y buckets inexistentes", async () => {
    const source = seed();
    const target = copyOf(source);
    target.tables.set("trips", source.tables.get("trips")! - 1);
    target.tables.delete("trip_todos");
    target.buckets.get("trip-page-images")?.delete(`${TRIP}/b.jpg`);
    target.buckets.delete("trip-notes-docs");

    const comparison = compareCounts(
      await collectCounts(
        reader(source, "https://origen.test"),
        reader(target, "https://destino.test"),
      ),
    );
    const byName = Object.fromEntries(comparison.differences.map((r) => [r.name, r]));
    expect(Object.keys(byName).sort()).toEqual([
      "trip-notes-docs",
      "trip-page-images",
      "trip_todos",
      "trips",
    ]);
    expect(byName.trips.difference).toBe(-1);
    expect(byName.trip_todos.status).toBe("error");
    expect(byName["trip-page-images"]).toMatchObject({ difference: -1, pending: 1 });
    expect(byName["trip-notes-docs"].status).toBe("error");
    expect(formatComparison(comparison)).toContain(
      "20261015120000_self_hosting_storage_and_grants.sql",
    );
  });

  test("mismo número de objetos pero uno sin copiar cuenta como diferencia", async () => {
    const source = seed();
    const target = copyOf(source);
    target.restoreRowFrom(source, "trip-covers", `uid/${TRIP}/1700.jpg`);
    const comparison = compareCounts(
      await collectCounts(
        reader(source, "https://origen.test"),
        reader(target, "https://destino.test"),
      ),
    );
    expect(comparison.differences.map((r) => [r.name, r.difference, r.pending])).toEqual([
      ["trip-covers", 0, 1],
    ]);
  });
});

describe("variables de entorno", () => {
  const env = {
    SOURCE_SUPABASE_URL: "https://viejo.supabase.co/",
    SOURCE_SERVICE_ROLE_KEY: "sb_secret_viejo",
    TARGET_SUPABASE_URL: "https://nuevo.supabase.co",
    TARGET_SERVICE_ROLE_KEY: "sb_secret_nuevo",
  };

  test("lee los dos proyectos", () => {
    expect(readProjects(env)).toEqual({
      source: { url: "https://viejo.supabase.co", serviceRoleKey: "sb_secret_viejo" },
      target: { url: "https://nuevo.supabase.co", serviceRoleKey: "sb_secret_nuevo" },
    });
  });

  test("lista juntas todas las que faltan", () => {
    expect(() => readProjects({ SOURCE_SUPABASE_URL: env.SOURCE_SUPABASE_URL })).toThrow(
      "Faltan variables de entorno: SOURCE_SERVICE_ROLE_KEY, TARGET_SUPABASE_URL, TARGET_SERVICE_ROLE_KEY.",
    );
  });

  test("rechaza el mismo proyecto como origen y destino", () => {
    expect(() =>
      readProjects({ ...env, TARGET_SUPABASE_URL: "https://viejo.supabase.co" }),
    ).toThrow("apuntan al mismo proyecto");
  });

  test("sin variables, el script sale con 2", () => {
    const result = Bun.spawnSync({
      cmd: [process.execPath, join(import.meta.dir, "../scripts/verify-migration.ts")],
      env: { PATH: process.env.PATH ?? "" },
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr.toString()).toContain("Faltan variables de entorno");
  });
});

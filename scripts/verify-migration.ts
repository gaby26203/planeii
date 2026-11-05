/**
 * Compara el proyecto origen con el destino: filas de cada tabla de `public` y objetos de cada
 * bucket. Sale con código 1 si algo difiere.
 *
 *   bun scripts/verify-migration.ts
 *
 * Usa las mismas variables que scripts/migrate-storage.ts. Guía en docs/migracion.md, sección 3.
 */
import { collectCounts, compareCounts, formatComparison } from "./lib/migration-counts";
import { errorMessage } from "./lib/storage-copy";
import {
  countRows,
  createServiceClient,
  readProjects,
  supabaseStorageApi,
  type ProjectConfig,
  type Projects,
} from "./lib/supabase-projects";

const USAGE = [
  "Uso: bun scripts/verify-migration.ts",
  "",
  "Compara filas por tabla de public y objetos por bucket entre el origen y el destino.",
  "",
  "Variables: SOURCE_SUPABASE_URL, SOURCE_SERVICE_ROLE_KEY, TARGET_SUPABASE_URL,",
  "TARGET_SERVICE_ROLE_KEY.",
].join("\n");

function reader(project: ProjectConfig) {
  const client = createServiceClient(project);
  return {
    countRows: (table: Parameters<typeof countRows>[1]) => countRows(client, table),
    storage: supabaseStorageApi(client),
  };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return 0;
  }
  let projects: Projects;
  try {
    if (argv.length > 0) throw new Error(`Opción desconocida: ${argv[0]}`);
    projects = readProjects(process.env);
  } catch (error) {
    console.error(`${errorMessage(error)}\n\n${USAGE}`);
    return 2;
  }

  console.log(`Origen:  ${projects.source.url}`);
  console.log(`Destino: ${projects.target.url}\n`);
  const comparison = compareCounts(
    await collectCounts(reader(projects.source), reader(projects.target)),
  );
  console.log(formatComparison(comparison));
  return comparison.differences.length > 0 ? 1 : 0;
}

process.exitCode = await main();

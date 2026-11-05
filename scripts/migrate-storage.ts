/**
 * Copia los tres buckets privados de un proyecto Supabase a otro, con las mismas rutas.
 *
 *   bun scripts/migrate-storage.ts [--dry-run] [--concurrency=N]
 *
 * Variables: SOURCE_SUPABASE_URL, SOURCE_SERVICE_ROLE_KEY, TARGET_SUPABASE_URL y
 * TARGET_SERVICE_ROLE_KEY. Se puede repetir: salta lo que ya está en el destino con el mismo
 * tamaño. Guía completa en docs/migracion.md, sección 3.
 */
import {
  createServiceClient,
  readProjects,
  supabaseStorageApi,
  type Projects,
} from "./lib/supabase-projects";
import {
  MIGRATE_USAGE,
  errorMessage,
  formatStorageSummary,
  migrateStorage,
  parseMigrateArgs,
  storageExitCode,
  type MigrateArgs,
} from "./lib/storage-copy";

async function main(): Promise<number> {
  let args: MigrateArgs;
  let projects: Projects;
  try {
    args = parseMigrateArgs(process.argv.slice(2));
    if (args.help) {
      console.log(MIGRATE_USAGE);
      return 0;
    }
    projects = readProjects(process.env);
  } catch (error) {
    console.error(`${errorMessage(error)}\n\n${MIGRATE_USAGE}`);
    return 2;
  }

  console.log(`Origen:  ${projects.source.url}`);
  console.log(`Destino: ${projects.target.url}`);
  if (args.dryRun) console.log("Simulación (--dry-run): no se escribe nada en el destino.");
  console.log("");

  try {
    const reports = await migrateStorage({
      source: supabaseStorageApi(createServiceClient(projects.source)),
      target: supabaseStorageApi(createServiceClient(projects.target)),
      dryRun: args.dryRun,
      concurrency: args.concurrency,
      log: (line) => console.log(line),
    });
    console.log(`\n${formatStorageSummary(reports)}`);
    return storageExitCode(reports);
  } catch (error) {
    console.error(errorMessage(error));
    return 1;
  }
}

process.exitCode = await main();

/**
 * Entrada y salida de los scripts de migración: variables de entorno, clientes con service role
 * y adaptadores de supabase-js a las interfaces de storage-copy.ts y migration-counts.ts.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/integrations/supabase/types";
import type { PublicTable } from "./migration-counts";
import type { StorageApi } from "./storage-copy";

export const PROJECT_ENV = [
  "SOURCE_SUPABASE_URL",
  "SOURCE_SERVICE_ROLE_KEY",
  "TARGET_SUPABASE_URL",
  "TARGET_SERVICE_ROLE_KEY",
] as const;

export interface ProjectConfig {
  url: string;
  serviceRoleKey: string;
}

export interface Projects {
  source: ProjectConfig;
  target: ProjectConfig;
}

type Env = Record<string, string | undefined>;

function normalizedUrl(name: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} no es una URL válida: ${value}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${name} tiene que empezar con https://`);
  }
  return url.origin;
}

/** Lee las cuatro variables. Lanza un error con todas las que faltan juntas. */
export function readProjects(env: Env): Projects {
  const missing = PROJECT_ENV.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}.`);
  }
  const value = (name: (typeof PROJECT_ENV)[number]) => (env[name] as string).trim();
  const source = {
    url: normalizedUrl("SOURCE_SUPABASE_URL", value("SOURCE_SUPABASE_URL")),
    serviceRoleKey: value("SOURCE_SERVICE_ROLE_KEY"),
  };
  const target = {
    url: normalizedUrl("TARGET_SUPABASE_URL", value("TARGET_SUPABASE_URL")),
    serviceRoleKey: value("TARGET_SERVICE_ROLE_KEY"),
  };
  if (source.url === target.url) {
    throw new Error("SOURCE_SUPABASE_URL y TARGET_SUPABASE_URL apuntan al mismo proyecto.");
  }
  return { source, target };
}

export type ServiceClient = SupabaseClient<Database>;

export function createServiceClient(
  project: ProjectConfig,
  fetchImpl?: typeof fetch,
): ServiceClient {
  return createClient<Database>(project.url, project.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
  });
}

export function supabaseStorageApi(client: ServiceClient): StorageApi {
  return {
    async listBuckets() {
      const { data, error } = await client.storage.listBuckets();
      if (error) throw error;
      return data.map((bucket) => bucket.id);
    },
    async list(bucket, prefix, page) {
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit: page.limit,
        offset: page.offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      return data;
    },
    async download(bucket, path) {
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error) throw error;
      return { data: await data.arrayBuffer(), contentType: data.type || null };
    },
    async upload(bucket, path, data, options) {
      // Con un ArrayBuffer, supabase-js manda contentType y cacheControl como cabeceras.
      const { error } = await client.storage.from(bucket).upload(path, data, {
        contentType: options.contentType,
        cacheControl: options.cacheControl,
        upsert: true,
      });
      if (error) throw error;
    },
  };
}

/** Cuenta filas con service role, que no pasa por RLS. */
export async function countRows(client: ServiceClient, table: PublicTable): Promise<number> {
  const { count, error, status } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    // HEAD no trae cuerpo, así que el mensaje suele venir vacío.
    const hint = status === 401 || status === 403 ? ": revisa la URL y la clave service role" : "";
    throw new Error(error.message || `HTTP ${status}${hint}`);
  }
  // Una petición HEAD a una tabla que no existe vuelve sin cuerpo ni error, solo sin conteo.
  if (count === null) throw new Error(`sin conteo (HTTP ${status}); ¿existe la tabla?`);
  return count;
}

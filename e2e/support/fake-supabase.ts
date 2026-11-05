/**
 * Proyecto Supabase en memoria para los tests de los scripts de migración. Se le pasa a
 * supabase-js como `global.fetch` y responde lo mínimo de Storage y PostgREST que usan:
 * listar buckets, listar carpetas con paginación, descargar, subir y contar filas con HEAD.
 */

export interface FakeObject {
  body: Uint8Array;
  contentType: string;
  cacheControl: string;
  id: string;
  updatedAt: string;
}

export interface FakeRequest {
  method: string;
  path: string;
}

export interface FakeProjectInit {
  buckets?: Record<string, Record<string, string | { body: string; contentType?: string }>>;
  tables?: Record<string, number>;
}

let nextId = 0;
const newId = () => `obj-${++nextId}`;

export class FakeProject {
  readonly buckets = new Map<string, Map<string, FakeObject>>();
  readonly tables = new Map<string, number>();
  readonly requests: FakeRequest[] = [];
  readonly failDownloads = new Set<string>();
  readonly failUploads = new Set<string>();
  /** Si se define, se espera esta cantidad de milisegundos en cada descarga. */
  downloadDelayMs = 0;
  inFlightDownloads = 0;
  maxInFlightDownloads = 0;

  constructor(init: FakeProjectInit = {}) {
    for (const [bucket, objects] of Object.entries(init.buckets ?? {})) {
      const map = new Map<string, FakeObject>();
      for (const [path, value] of Object.entries(objects)) {
        const { body, contentType = "image/jpeg" } =
          typeof value === "string" ? { body: value } : value;
        map.set(path, {
          body: new TextEncoder().encode(body),
          contentType,
          cacheControl: "max-age=3600",
          id: newId(),
          updatedAt: "2026-10-01T12:00:00.000Z",
        });
      }
      this.buckets.set(bucket, map);
    }
    for (const [table, count] of Object.entries(init.tables ?? {})) this.tables.set(table, count);
  }

  /** Copia la fila de un objeto tal cual, como haría un volcado que incluye `storage.objects`. */
  restoreRowFrom(other: FakeProject, bucket: string, path: string) {
    const original = other.buckets.get(bucket)?.get(path);
    if (!original) throw new Error(`no existe ${bucket}/${path}`);
    this.buckets
      .get(bucket)
      ?.set(path, { ...original, body: new Uint8Array(original.body.length) });
  }

  writes(): FakeRequest[] {
    return this.requests.filter(
      (r) => r.method !== "GET" && r.method !== "HEAD" && !r.path.includes("/object/list/"),
    );
  }

  fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname);
    this.requests.push({ method: request.method, path });
    return this.handle(request, path);
  }) as typeof fetch;

  private async handle(request: Request, path: string): Promise<Response> {
    if (path === "/storage/v1/bucket" && request.method === "GET") {
      return json([...this.buckets.keys()].map((id) => ({ id, name: id, public: false })));
    }
    const list = path.match(/^\/storage\/v1\/object\/list\/([^/]+)$/);
    if (list && request.method === "POST") {
      return this.list(list[1], (await request.json()) as ListBody);
    }
    const object = path.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
    if (object && request.method === "GET") return this.download(object[1], object[2]);
    if (object && request.method === "POST") return this.upload(object[1], object[2], request);
    const table = path.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (table && request.method === "HEAD") {
      const count = this.tables.get(table[1]);
      if (count === undefined) return new Response(null, { status: 404 });
      return new Response(null, {
        status: 200,
        headers: { "content-range": count === 0 ? "*/0" : `0-${count - 1}/${count}` },
      });
    }
    return json({ message: `ruta no simulada: ${request.method} ${path}` }, 501);
  }

  private bucket(id: string) {
    return this.buckets.get(id);
  }

  private list(bucketId: string, body: ListBody): Response {
    const bucket = this.bucket(bucketId);
    if (!bucket) return bucketNotFound();
    const prefix = body.prefix ? `${body.prefix.replace(/\/$/, "")}/` : "";
    const entries = new Map<string, unknown>();
    for (const [path, object] of bucket) {
      if (!path.startsWith(prefix)) continue;
      const [name, ...rest] = path.slice(prefix.length).split("/");
      if (rest.length > 0) {
        entries.set(name, { name, id: null, updated_at: null, created_at: null, metadata: null });
      } else {
        entries.set(name, {
          name,
          id: object.id,
          updated_at: object.updatedAt,
          created_at: object.updatedAt,
          metadata: {
            size: object.body.length,
            mimetype: object.contentType,
            cacheControl: object.cacheControl,
          },
        });
      }
    }
    const sorted = [...entries.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, e]) => e);
    return json(sorted.slice(body.offset, body.offset + body.limit));
  }

  private async download(bucketId: string, path: string): Promise<Response> {
    this.inFlightDownloads++;
    this.maxInFlightDownloads = Math.max(this.maxInFlightDownloads, this.inFlightDownloads);
    try {
      if (this.downloadDelayMs > 0) await new Promise((r) => setTimeout(r, this.downloadDelayMs));
      const bucket = this.bucket(bucketId);
      if (!bucket) return bucketNotFound();
      if (this.failDownloads.has(path))
        return json({ statusCode: "500", error: "Internal", message: "falla simulada" }, 500);
      const object = bucket.get(path);
      if (!object)
        return json({ statusCode: "404", error: "not_found", message: "Object not found" }, 400);
      return new Response(object.body, { headers: { "content-type": object.contentType } });
    } finally {
      this.inFlightDownloads--;
    }
  }

  private async upload(bucketId: string, path: string, request: Request): Promise<Response> {
    const bucket = this.bucket(bucketId);
    if (!bucket) return bucketNotFound();
    if (this.failUploads.has(path))
      return json(
        { statusCode: "415", error: "invalid_mime_type", message: "mime type not supported" },
        400,
      );
    const existing = bucket.get(path);
    if (existing && request.headers.get("x-upsert") !== "true") {
      return json(
        { statusCode: "409", error: "Duplicate", message: "The resource already exists" },
        400,
      );
    }
    bucket.set(path, {
      body: new Uint8Array(await request.arrayBuffer()),
      contentType: request.headers.get("content-type") ?? "application/octet-stream",
      cacheControl: request.headers.get("cache-control") ?? "no-cache",
      id: existing?.id ?? newId(),
      updatedAt: new Date(Date.now() + 1000).toISOString(),
    });
    return json({ Id: newId(), Key: `${bucketId}/${path}` });
  }
}

interface ListBody {
  prefix: string;
  limit: number;
  offset: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function bucketNotFound(): Response {
  return json({ statusCode: "404", error: "Bucket not found", message: "Bucket not found" }, 400);
}

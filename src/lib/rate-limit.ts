// Límite de frecuencia en memoria, por ventana fija. En Cloudflare Workers cada instancia tiene
// su propia memoria y se recicla seguido, así que esto frena ráfagas desde una misma IP, no un
// ataque distribuido. Para eso está la regla de rate limiting de Cloudflare frente al Worker.

export interface RateLimiter {
  /** Cuenta un pedido para `key`. Devuelve false si ya superó el límite de la ventana. */
  hit(key: string, now?: number): boolean;
  /** Claves que se están siguiendo (para tests). */
  size(): number;
}

export function createRateLimiter(opts: {
  limit: number;
  windowMs: number;
  /** Tope de claves en memoria; al pasarlo se descartan las ventanas vencidas o las más viejas. */
  maxKeys?: number;
}): RateLimiter {
  const maxKeys = opts.maxKeys ?? 10_000;
  const windows = new Map<string, { start: number; count: number }>();

  function prune(now: number) {
    for (const [k, w] of windows) {
      if (now - w.start >= opts.windowMs) windows.delete(k);
    }
    // Si siguen sobrando, se van las más viejas (Map conserva el orden de inserción).
    for (const k of windows.keys()) {
      if (windows.size <= maxKeys) break;
      windows.delete(k);
    }
  }

  return {
    hit(key, now = Date.now()) {
      const w = windows.get(key);
      if (!w || now - w.start >= opts.windowMs) {
        windows.delete(key);
        windows.set(key, { start: now, count: 1 });
        if (windows.size > maxKeys) prune(now);
        return true;
      }
      w.count += 1;
      return w.count <= opts.limit;
    },
    size: () => windows.size,
  };
}

/** IP del visitante según los encabezados del proxy, o null si no viene. */
export function clientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return headers.get("x-real-ip")?.trim() || null;
}

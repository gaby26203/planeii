import { useEffect, useState } from "react";
import { isExternalUrl, isStoragePath, resolveCoverUrl } from "@/lib/trip-cover-storage";

// Cache en memoria para signed URLs (por path) durante la sesión.
const cache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000 * 6; // 6h (menor que el TTL del signed URL)

/**
 * Devuelve la URL final para mostrar el cover de un viaje.
 * - URL externa: la retorna tal cual.
 * - Path de storage: genera y cachea un signed URL.
 * - null/undefined: retorna null.
 */
export function useTripCoverUrl(ref: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!ref) return null;
    if (isExternalUrl(ref)) return ref;
    const cached = cache.get(ref);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    return null;
  });

  useEffect(() => {
    let alive = true;
    if (!ref) {
      setUrl(null);
      return;
    }
    if (isExternalUrl(ref)) {
      setUrl(ref);
      return;
    }
    if (!isStoragePath(ref)) {
      setUrl(null);
      return;
    }
    const cached = cache.get(ref);
    if (cached && cached.expiresAt > Date.now()) {
      setUrl(cached.url);
      return;
    }
    resolveCoverUrl(ref).then((resolved) => {
      if (!alive) return;
      if (resolved) {
        cache.set(ref, { url: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
        setUrl(resolved);
      } else {
        setUrl(null);
      }
    });
    return () => {
      alive = false;
    };
  }, [ref]);

  return url;
}

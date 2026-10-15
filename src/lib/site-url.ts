/**
 * URL pública del sitio (sin barra final), p. ej. "https://app.planeii.com".
 * Se usa para construir URLs absolutas en metadatos (og:image) cuando el contenido
 * guarda rutas relativas. Antes estaba fijada a https://planeii.lovable.app.
 */
export const PUBLIC_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

/** Convierte una ruta relativa en absoluta usando PUBLIC_SITE_URL; "" si no se puede. */
export function absoluteSiteUrl(src: string): string {
  if (!src) return "";
  if (/^https?:\/\//.test(src)) return src;
  if (src.startsWith("/") && PUBLIC_SITE_URL) return `${PUBLIC_SITE_URL}${src}`;
  return "";
}

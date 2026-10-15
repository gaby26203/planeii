import { TEMPLATE_ASSET_DIR, TEMPLATE_ASSETS } from "@/lib/template-assets";

const ASSETS: Record<string, string> = TEMPLATE_ASSETS;

// Rutas del CDN de Lovable guardadas en documentos antiguos:
//   /__l5e/assets-v1/<uuid>/hero.jpg  o  https://<algo>.lovable.app/__l5e/assets-v1/<uuid>/hero.jpg
const LOVABLE_ASSET =
  /^(?:https?:\/\/[^/]*\.(?:lovable\.app|lovableproject\.com))?\/__l5e\/assets-v1\/[0-9a-f-]+\/([a-z]+)[^/]*\.(?:jpe?g|png|webp)$/i;

/**
 * Re-mapea las rutas de imágenes de la plantilla (que cambian entre builds, o que
 * apuntaban al CDN de Lovable) a las URLs actuales en public/template-assets/.
 */
export function resolveTemplateAssets<T>(value: T): T {
  if (typeof value === "string") {
    const lovable = value.match(LOVABLE_ASSET);
    if (lovable) {
      const key = lovable[1].toLowerCase();
      return (ASSETS[key] ?? value) as T;
    }
    if (value.startsWith("data:") || value.startsWith("http")) return value;
    if (value.startsWith(TEMPLATE_ASSET_DIR + "/")) return value;
    const match = value.match(/\/assets\/([a-z]+)[^/]*\.(jpe?g|png|webp)/i);
    const key = match?.[1]?.toLowerCase();
    return (key && ASSETS[key] ? ASSETS[key] : value) as T;
  }
  if (Array.isArray(value)) return value.map(resolveTemplateAssets) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveTemplateAssets(v)]),
    ) as T;
  }
  return value;
}

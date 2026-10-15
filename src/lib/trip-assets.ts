import heroAsset from "@/assets/hero.jpg.asset.json";
const hero = heroAsset.url;
import cocinaAsset from "@/assets/cocina.jpg.asset.json";
const cocina = cocinaAsset.url;
import artesanosAsset from "@/assets/artesanos.jpg.asset.json";
const artesanos = artesanosAsset.url;
import mezcalAsset from "@/assets/mezcal.jpg.asset.json";
const mezcal = mezcalAsset.url;
import mercadoAsset from "@/assets/mercado.jpg.asset.json";
const mercado = mercadoAsset.url;
import hotelAsset from "@/assets/hotel.jpg.asset.json";
const hotel = hotelAsset.url;
import nocheAsset from "@/assets/noche.jpg.asset.json";
const noche = nocheAsset.url;
import finalAsset from "@/assets/final.jpg.asset.json";
const final = finalAsset.url;

const ASSETS: Record<string, string> = { hero, cocina, artesanos, mezcal, mercado, hotel, noche, final };

/** Re-maps template image paths (which change between builds) to the current build's URLs. */
export function resolveTemplateAssets<T>(value: T): T {
  if (typeof value === "string") {
    if (value.startsWith("data:") || value.startsWith("http")) return value;
    const match = value.match(/\/assets\/([a-z]+)[^/]*\.(jpe?g|png|webp)/i);
    const key = match?.[1]?.toLowerCase();
    return (key && ASSETS[key] ? ASSETS[key] : value) as T;
  }
  if (Array.isArray(value)) return value.map(resolveTemplateAssets) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveTemplateAssets(v)])) as T;
  }
  return value;
}

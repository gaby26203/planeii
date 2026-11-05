/**
 * Fotos de la plantilla de Oaxaca (OAXACA_LEGACY_DATA).
 *
 * En Lovable vivían en su CDN privado (/__l5e/assets-v1/<id>/<archivo>), que solo
 * existe dentro de su hosting. Ahora se sirven como archivos estáticos desde
 * public/template-assets/. Para descargarlas desde la app publicada en Lovable:
 *   bun run assets:download
 * Los manifiestos originales están en scripts/lovable-assets/.
 */
export const TEMPLATE_ASSET_DIR = "/template-assets";

export const TEMPLATE_ASSETS = {
  hero: `${TEMPLATE_ASSET_DIR}/hero.jpg`,
  cocina: `${TEMPLATE_ASSET_DIR}/cocina.jpg`,
  artesanos: `${TEMPLATE_ASSET_DIR}/artesanos.jpg`,
  mezcal: `${TEMPLATE_ASSET_DIR}/mezcal.jpg`,
  mercado: `${TEMPLATE_ASSET_DIR}/mercado.jpg`,
  hotel: `${TEMPLATE_ASSET_DIR}/hotel.jpg`,
  noche: `${TEMPLATE_ASSET_DIR}/noche.jpg`,
  final: `${TEMPLATE_ASSET_DIR}/final.jpg`,
} as const;

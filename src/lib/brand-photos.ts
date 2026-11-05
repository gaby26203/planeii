/**
 * Fotos de marca de PlanEII, servidas como archivos estáticos desde public/brand/fotos/.
 *
 * Se usan en las pantallas de acceso, en el panel sin viajes, como portadas sugeridas de
 * los viajes y en la vista previa al compartir la app. No entran en la plantilla de la
 * página de venta: cada viaje usa sus propias fotos (NEUTRAL_TRIP_DATA trae marcadores).
 */
export const BRAND_PHOTO_DIR = "/brand/fotos";

export type BrandPhoto = {
  id: string;
  /** Foto completa, lado largo de 1600 px. */
  src: string;
  /** Miniatura, lado corto de 360 px. */
  thumb: string;
  alt: string;
  /** `object-position` para recortes: deja a la vista el motivo principal. */
  position: string;
};

const photo = <T extends string>(id: T, alt: string, position: string): BrandPhoto & { id: T } => ({
  id,
  src: `${BRAND_PHOTO_DIR}/${id}.jpg`,
  thumb: `${BRAND_PHOTO_DIR}/${id}-thumb.jpg`,
  alt,
  position,
});

export const BRAND_PHOTOS = [
  photo(
    "rio-tepuyes",
    "Cielo naranja sobre un río con tepuyes al fondo, visto desde una curiara",
    "60% 50%",
  ),
  photo(
    "laguna-altiplano",
    "Viajera frente a una laguna del altiplano con un volcán al fondo",
    "35% 55%",
  ),
  photo("viajera-cascada", "Viajera de espaldas frente a una cascada", "50% 40%"),
  photo("vicunas", "Tres vicuñas en el altiplano", "50% 72%"),
  photo(
    "rio-tepuyes-noche",
    "Río al anochecer con tepuyes al fondo, visto desde una curiara",
    "60% 50%",
  ),
] as const;

export type BrandPhotoId = (typeof BRAND_PHOTOS)[number]["id"];

export function brandPhoto(id: BrandPhotoId): BrandPhoto {
  return BRAND_PHOTOS.find((p) => p.id === id) ?? BRAND_PHOTOS[0];
}

/** Imagen de 1200 × 630 para og:image. */
export const BRAND_OG_IMAGE = `${BRAND_PHOTO_DIR}/og.jpg`;

/** `coverImage` que apunta a una foto de marca (se sirve tal cual, sin signed URL). */
export function isBrandPhoto(value: string | null | undefined): value is string {
  return !!value && value.startsWith(`${BRAND_PHOTO_DIR}/`) && !value.includes("..");
}

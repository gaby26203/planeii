# Límite de peso para las fotos de la landing

## Cómo está hoy
- Cada foto que subís se guarda como archivo aparte y la página solo guarda su enlace: la página publicada pesa 14 KB (antes 3,7 MB), así que publicar funciona.
- Tus 7 fotos pesan en promedio 620 KB y la más pesada 1,2 MB.
- Hoy no hay ningún límite: si subís una foto de 25 MB se intenta usar igual, y la carpeta de fotos acepta archivos de hasta 10 MB.

## Qué vamos a hacer
1. **Cada foto se ajusta sola a unos 450 KB.** Al recortar, la app la reduce de calidad y de tamaño lo justo hasta ese peso, y la usa. No tenés que hacer nada y no se ve distinta en la pantalla.
2. **Aceptamos fotos de hasta 25 MB y las comprimimos.** Si una foto pesa más que eso, aparece un mensaje claro: "Esa foto pesa demasiado, elegí otra de hasta 25 MB".
3. **La carpeta de fotos baja su tope a 5 MB**, así ninguna foto pesada puede colarse por otro camino.
4. **Avisos visibles**: si una foto no se puede usar (peso o formato), te lo dice arriba de la página en lugar de no hacer nada.
5. **Prueba con tu cuenta**: subimos una foto grande de verdad y confirmamos que quede por debajo de 450 KB y se vea bien en la landing.

## Detalles técnicos
- `src/lib/trip-page-images.ts`: helper `compressToTarget(source, { maxBytes = 450_000, maxSide = 1800 })` que usa `canvas.toBlob` y baja calidad (0,82 → 0,5) y luego escala (hasta 0,6) de forma iterativa hasta el objetivo. `uploadPageImage` comprime antes de subir, así también se aplica a las fotos embebidas viejas que convierte `externalizeDocumentImages`.
- `src/components/editor/ImageCropDialog.tsx`: `cropToDataUrl` pasa a `cropToBlob` (sin base64) y `onConfirm` entrega un `Blob`.
- `src/components/editor/TripEditor.tsx`: `replaceImage` valida tipo (JPG/PNG/WebP) y tamaño (≤ 25 MB) con `toast` antes de leer el archivo; `applyCroppedImage` recibe el `Blob`. Nota breve en el panel Imágenes: "Cada foto se ajusta sola a ~450 KB".
- Tope de la carpeta: `supabase--storage_update_bucket` con `trip-page-images` → `file_size_limit: "5MB"` (no SQL).
- Verificación con Playwright: subir una JPEG grande generada localmente, comprobar en `storage.objects` que el objeto pese ≤ ~460 KB y que la landing la muestre; comprobar el aviso con un archivo de más de 25 MB.

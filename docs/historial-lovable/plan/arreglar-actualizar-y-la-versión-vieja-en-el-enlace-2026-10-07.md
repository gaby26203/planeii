# Arreglar "Actualizar" y la versión vieja en el enlace

## Qué encontré
- La página publicada (`/v/oxacaedit`) se actualizó por última vez el 7 de octubre a la 01:54. Ninguno de los intentos de hoy llegó a guardarse.
- El borrador actual pesa unos **3,7 MB**, contra unos 0,6 MB de la última versión publicada. La diferencia viene de **4 fotos subidas que se guardan dentro de la página como texto**, sin archivo aparte. Con ese peso, el envío al publicar se rechaza o se corta, y la viajera sigue viendo la versión vieja.
- El aviso de error queda dentro de la ventana y es fácil no verlo, así que parece que "no pasa nada".

## Cambios
1. **Las fotos se guardan como archivos**: cada foto que subas o recortes va a un espacio de imágenes de la landing, y la página guarda solo su enlace. La página pasa a pesar pocos KB.
2. **Arreglo automático de lo que ya existe**: al publicar o abrir el editor, las fotos que ya están embebidas se convierten a archivos solas. No hace falta volver a subirlas.
3. **Avisos visibles**: un mensaje emergente confirma "Página actualizada" con el enlace, o explica el error ("Las fotos son muy pesadas", "Sin conexión"…). Mientras publica, el botón muestra "Publicando…".
4. **Verificación**: publicar con tu cuenta y comprobar que `/v/oxacaedit` muestra los cambios de hoy.

## Detalles técnicos
- Migración: bucket público `trip-page-images` con lectura pública, y escritura/borrado solo para integrantes del viaje (ruta `tripId/...`, comprobada con `private.is_trip_member` / `is_trip_owner`).
- `src/lib/trip-page-images.ts`: `uploadPageImage(tripId, blob)` y `externalizeDocumentImages(tripId, doc)`, que recorre el documento, sube cada `data:image` y lo reemplaza por la URL pública.
- `TripEditor.tsx`: el lector de archivos y `ImageCropDialog` suben el archivo en lugar de guardarlo dentro de la página; al cargar un documento con fotos embebidas, las convierte una vez y guarda el borrador.
- `PublishDialog.tsx`: llama a `externalizeDocumentImages` antes de guardar en `trip_pages`/`trip_page_versions`, y usa `toast` de sonner para el éxito o el error (con `<Toaster />` montado en `__root` si falta). Registra el error real en la consola.

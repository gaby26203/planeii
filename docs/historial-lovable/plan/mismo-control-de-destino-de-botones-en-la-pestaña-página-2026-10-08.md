# Mismo control de destino de botones en la pestaña Página

## Qué cambia
En **Página** hoy hay dos campos sueltos de enlace: "Enlace de reserva" (en los datos del viaje) y "Enlace del anuncio (URL)" (en Anuncio fijo). Se reemplazan por el mismo control de botones que ya existe en Diseño:

- **Anuncio fijo:** "Enlace del anuncio (URL)" pasa a ser **Destino del botón** (Formulario interno / URL / Sección de la landing), con URL, nueva pestaña y advertencias, igual que en Diseño. Es el mismo ajuste: cambiarlo en Página o en Diseño da el mismo resultado.
- **Enlace de reserva:** se reemplaza por una sección **Botones de la página** que lista todos los botones (Portada, Menú, Qué incluye, Itinerario, Precio y reserva, Cierre, Anuncio) con su destino, cada uno con el mismo control. Arriba, una opción rápida **"Aplicar a todos los botones de reserva"** para elegir un destino una sola vez (por ejemplo, Formulario interno) sin tocar uno por uno. El botón secundario "Ver itinerario" no se cambia con la opción rápida.
- La lista de "campos pendientes" deja de pedir "Enlace de reserva"; en su lugar avisa si algún botón tiene un destino con problema (y lleva a ese botón).

## Reglas
- Un solo ajuste por botón, compartido entre Página, Diseño, vista previa y publicada.
- Las páginas viejas siguen igual: el enlace de reserva guardado se sigue usando como destino heredado hasta que se cambie un botón.

## Detalles técnicos
- Reutilizar `CtaDestinationControls` (escribe en `ctaLinks`) en el bloque del anuncio y en una nueva sección de TripContentEditor/TripEditor; quitar los `Field` de `trip.bookingUrl` y `announcement.url` de la UI (los datos se conservan como respaldo heredado).
- "Aplicar a todos": escribe el mismo `CtaLink` en los ctaIds de reserva (todos menos `heroItinerary`).
- `requiredFieldChecks`: sustituir "Enlace de reserva" por `ctaWarnings(document, liveSlug)`; el checklist de publicación deja de validar solo `trip.bookingUrl` cuando los botones tienen destino propio válido.
- Test bun: "aplicar a todos" no modifica `heroItinerary`; checklist sin advertencias cuando todos usan formulario interno configurado.

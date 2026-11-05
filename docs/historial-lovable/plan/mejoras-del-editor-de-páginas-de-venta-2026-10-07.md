# Mejoras del editor de páginas de venta

## Objetivo
Hacer el editor más seguro, más directo y más cómodo: el borrador no se pierde nunca, se puede volver a cualquier versión publicada, se editan textos haciendo clic en la vista previa, se reordena arrastrando, y hay deshacer/rehacer y etiquetas claras.

Fuera de alcance: mejoras de IA (decidido: no por ahora), cambios visuales de la landing publicada.

## 1. Base de datos
- Tabla `trip_page_drafts` (trip_id único, document jsonb, updated_at): guarda el borrador en el backend, por viaje. RLS igual que `trip_pages` (miembros/dueña), GRANT a `authenticated` y `service_role`.
- Tabla `trip_page_versions` (trip_id, document jsonb, published_by, published_at): historial de versiones publicadas. RLS: lectura e inserción para el equipo del viaje; GRANT a `authenticated` y `service_role`. Se conservan las últimas 20.

## 2. Seguridad del borrador
- Autoguardado en el backend (debounce ~1,5 s) además del localStorage actual; localStorage queda como respaldo offline.
- Al abrir el editor: si hay borrador en el backend se usa ese; si no, el publicado; localStorage solo como último recurso.
- Al publicar con éxito: se guarda una fila en `trip_page_versions` y se limpia el borrador pendiente.
- Botón "Descartar cambios" junto al de restaurar plantilla: vuelve al último estado publicado (con confirmación).
- Nuevo diálogo "Historial": lista las versiones publicadas con fecha, previsualiza cada una y "Restaurar" la carga en el editor (no publica sola).
- Aviso de cambios sin guardar al cerrar la pestaña.

## 3. Editar textos en la vista
- Extender el sistema actual de clic-para-editar-imágenes a textos: en la vista previa (modo edición, desktop), los textos principales se subrayan sutilmente al pasar el mouse.
- Clic en un texto → se abre un cuadro de edición flotante sobre ese punto del preview (input de una línea o textarea según el campo). Enter guarda, Esc cancela (mismo patrón que los atajos existentes).
- Los cambios actualizan el documento y el panel lateral queda sincronizado (el campo correspondiente refleja el nuevo texto).
- Cubre: portada (título, subtítulo, datos, botones), historia, experiencias, incluye/no incluye, itinerario (día por día), alojamiento, anfitriones, perfil, info práctica, testimonios, FAQ (pregunta y respuesta), galería (pies) y cierre.
- La vista móvil del editor sigue en modo visitante (regla del proyecto): sin edición inline ahí.

## 4. Arrastrar y soltar
- Usar `@dnd-kit` (ya está en el proyecto por las notas):
  - Panel "Secciones": reordenar arrastrando, además de las flechas actuales.
  - Listas (`ListEditor`) y elementos repetibles (`RepeatEditor`): arrastrar para reordenar días, experiencias, preguntas, fotos, etc.

## 5. Pulido general
- Deshacer/rehacer del documento completo con Ctrl+Z / Ctrl+Shift+Z y botones en el encabezado (mismo enfoque que el historial de costos).
- Etiquetas claras para todos los campos técnicos actuales ("navHome" → "Menú · Inicio", "bookingCta" → "Reserva · Botón", etc.) con un mapa de etiquetas.
- El aviso "Faltan N datos esenciales" pasa a listar qué falta exactamente, y cada ítem lleva al campo correspondiente.

## Detalles técnicos
- `src/lib/trip-editor.ts`: helper `setByPath(document, "copy.highlightsTitle" | "trip.highlights.2.title", value)` para la edición inline; exporta el mapa de etiquetas de campos.
- `src/components/trip/shared.tsx`: nuevo `EditableText` que marca textos con su ruta y avisa por `postMessage` (mismo origen) al hacer clic.
- `src/components/editor/TripPreview.tsx` / `TripLanding.tsx`: envolver los textos editables con `EditableText` cuando `editorPreview` está activo.
- `src/components/editor/TripEditor.tsx`: listener del nuevo mensaje (con validación de origen), popover flotante de edición, autoguardado al backend, historial, undo/redo, beforeunload.
- `src/lib/trip-pages.functions.ts` (nuevo): server fns `savePageDraft`, `loadPageDraft`, `listPageVersions`, `restoreVersion` con `requireSupabaseAuth`; el publish existente inserta la versión.
- `PrePublishChecklist` y flujo de publicación no cambian de forma visible, salvo que al publicar se registra la versión.

## Verificación
- Migración aplicada con GRANT y RLS; tipos regenerados.
- Prueba Playwright con un viaje real: autoguardado en backend, edición inline de un título y una FAQ, drag & drop de secciones, undo/redo, restaurar una versión del historial, y publicar sin errores.
- `bunx tsgo --noEmit` limpio y build OK.

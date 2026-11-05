# Integrar la landing de viajes (Página de venta) en Planeii

Cada viaje tendrá una "Página de venta" pública, editable con un editor visual, y publicable en `planeii.lovable.app/v/<slug>`.

## Qué verá la organizadora
- En el dashboard de un viaje, un botón **"Página de venta"** que abre el editor del viaje.
- El editor arranca con nombre, destino, fechas y precio del viaje (no con el ejemplo de Oaxaca); las imágenes de ejemplo sirven de punto de partida.
- Vista previa en vivo, recorte de imágenes, temas/fuentes/escala.
- **Publicar** elige un slug y genera el link público; volver a publicar actualiza la misma página.
- El botón **Reservar** de la landing apunta a un link configurable por página (por defecto WhatsApp/URL que ella defina), ya que las invitaciones de Planeii son para el equipo, no para clientas.
- La página pública `/v/<slug>` se abre sin iniciar sesión.

## Pasos
1. Copiar componentes `trip/*`, `editor/*`, `data/trip.ts`, `lib/trip-editor.ts`, `lib/trip-assets.ts` tal cual.
2. Subir las 8 imágenes de ejemplo al CDN de assets (no al repo) y cambiar `trip-assets.ts` para usar sus URLs.
3. Estilos: añadir los bloques de la plantilla a `src/styles.css` **acotados bajo una clase contenedora** (`.trip-landing`) para que los tokens de la landing no pisen la paleta negro/beige/terracota de Planeii. Fuentes nuevas (Fraunces, Manrope, DM Serif Display, Outfit, Work Sans) vía `<link>` en `__root.tsx`.
4. Rutas:
   - `_authenticated/viajes.$tripId_.pagina.tsx` → editor con `tripId`, precarga datos del viaje.
   - `preview.tsx` → pública (lee borrador local).
   - `v.$slug.tsx` → pública, con head() dinámico (título/descr./og:image del documento).
   - No se crea `/editor` suelto.
5. Botón "Página de venta" en `viajes.$tripId.tsx`.
6. `PublishDialog`: quitar el login/registro embebido (ya hay sesión en Planeii) y guardar `trip_id`.
7. Borrador local por viaje (clave `localStorage` con `tripId`) para no mezclar viajes.

## Base de datos
Tabla `trip_pages` según la guía, con dos ajustes:
- `trip_id` NOT NULL referenciando `trips`.
- Edición permitida a quien sea dueña o miembro del viaje (mismo criterio que notas/to-dos), no solo a quien la creó, para que las organizadoras colaboren.
- Lectura pública de páginas publicadas (anon), como pide la guía.

## Detalles técnicos
- Policies insert/update/delete: `private.is_trip_member(trip_id, auth.uid()) OR private.is_trip_owner(trip_id, auth.uid())`; select: `true` para anon/authenticated.
- GRANTs en la misma migración (anon SELECT, authenticated CRUD, service_role ALL).
- `v.$slug` usa loader con cliente público; `notFound()` si no existe.
- Verificación: build OK, crear/publicar desde un viaje, abrir `/v/<slug>` sin sesión, confirmar que un usuario sin acceso al viaje no puede editar.

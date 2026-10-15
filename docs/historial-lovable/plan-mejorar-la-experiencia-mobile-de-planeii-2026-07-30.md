# Mejorar la experiencia mobile de Planeii

Objetivo: que toda la app se use cómodamente en teléfono (360–430 px de ancho) sin perder ninguna función. Se mantiene el menú lateral tipo drawer (sin barra inferior) y las tablas siguen siendo tablas, solo que compactas con scroll horizontal controlado.

## 1. Marco general (layout y navegación)

- Header superior mobile: además del botón de menú, mostrar el nombre de la sección actual y el acceso a la cuenta, para no depender de abrir el drawer.
- El drawer lateral se cierra automáticamente al elegir una sección (hoy queda abierto tapando la pantalla).
- Áreas táctiles mínimas de 40 px en botones e íconos de acción del header y del drawer.
- Padding lateral uniforme (16 px en mobile) en todas las páginas, y anchos que no desborden.

## 2. Dashboard de viajes

- Tarjetas de viaje a una sola columna en teléfono, con imagen más baja para que entren 2–3 por pantalla.
- Título, destino y fechas apilados con truncado correcto (nada de texto cortado ni desbordado).
- Barra de acciones (buscar, filtros, nuevo viaje) apilada: buscador a ancho completo y botón "Nuevo viaje" fijo y visible.
- Edición inline del nombre del viaje adaptada al ancho del teléfono.

## 3. Detalle del viaje (tabs, resumen, métricas)

- Menú de secciones (Itinerario & Costos, Viajeras, Proveedores, Resumen, Notas): en mobile pasa a fila deslizable horizontal en una sola línea, con la pestaña activa siempre visible al entrar, en vez de envolverse en dos filas.
- Título del viaje, estado y botón de resumen reorganizados en columna para que no se aplasten.
- Resumen del viaje: chips de destino y tiles de meta a 1–2 columnas; las tarjetas de métricas (precio, costo, utilidad, grupales) pasan a 2 columnas en mobile con tipografía escalada.
- Se conserva el comportamiento actual de ocultar/mostrar resumen y su preferencia guardada.

## 4. Itinerario & Costos (tablas)

- Tabla compacta con scroll horizontal solo en mobile: contenedor con desplazamiento lateral suave, ancho mínimo definido por columna, y en desktop se mantiene exactamente el comportamiento actual (sin scroll, columnas fijas por porcentaje).
- Primera columna (día/hora + concepto) fija al hacer scroll lateral, para no perder la referencia de qué fila se está leyendo.
- Tipografía y paddings reducidos en mobile; los íconos de acción (pin, editar, borrar) se agrupan en una columna estrecha y alineada.
- Barra de filtros (ciudad, incluido/no incluido, tags, marcados) apilada y deslizable, con los chips de tags en fila con scroll.
- Edición inline (hora, monto, notas, descripción) revisada en mobile: popovers y editores a ancho de pantalla, teclado sin tapar el campo, y se conservan Enter/Esc y guardar al tocar afuera.
- Botones "Agregar costo" de cada tarjeta a ancho completo en mobile.

## 5. Viajeras, Notas, Proveedores y diálogos

- Viajeras: filas de la tabla condensadas con la misma estrategia de scroll horizontal y columna de nombre fija.
- Proveedores: la tarjeta de proveedor con sus costos vinculados se apila (servicio, total grupo, por persona) en lugar de columnas apretadas.
- Notas: editor y lista a ancho completo, barra de formato accesible con el pulgar.
- Diálogos y modales (nuevo viaje, editar ítem, miembros, subir documento, enlaces): a ancho casi completo en mobile, con scroll interno y botones de acción apilados y grandes al pie. Se conservan los atajos Enter/Esc ya implementados.

## Detalles técnicos

- Solo cambios de presentación: clases Tailwind responsivas y pequeños ajustes de estructura JSX. No se toca `src/lib/finance.ts`, ni la persistencia, ni las exportaciones.
- Se usa el patrón `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` + `shrink-0` para las filas de encabezado con texto e íconos.
- Tablas: wrapper `overflow-x-auto` activo solo hasta `md`, `colgroup` con `min-width` por columna en mobile y porcentajes en desktop; columna fija con `sticky left-0`.
- Tabs del viaje: `overflow-x-auto` + `flex-nowrap` bajo `md`, `flex-wrap` desde `md`.
- Sidebar drawer: cierre automático en navegación usando el estado del componente `Sidebar` existente en `src/components/AppSidebar.tsx`.
- Archivos principales: `src/routes/_authenticated/viajes.$tripId.tsx`, `src/routes/_authenticated/index.tsx`, `src/components/ProvidersTab.tsx`, `src/components/trip-notes/*`, `src/components/AppLayout.tsx`, `src/components/AppSidebar.tsx`, diálogos en `src/components/*`.
- Verificación con capturas a 390×844 de cada pantalla principal antes de cerrar.

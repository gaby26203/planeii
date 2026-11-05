# Estado del repositorio

Análisis de la exportación de Lovable del 14 de octubre de 2026 y de la versión migrada. Cada
hallazgo indica cómo se comprobó:

- **Verificado**: se ejecutó o se leyó el código y la evidencia es directa.
- **Leído**: se deduce de leer el código, pero no se reprodujo en ejecución.

## Resumen

La app compila, pasa el typecheck y sus tests unitarios. Funcionalmente está madura en dos áreas:
el espacio de trabajo de cada viaje (costos, viajeras, pagos, notas) y el editor de páginas de
venta con su formulario público. Cinco de las once secciones del menú están vacías.

Los problemas más serios no son de build sino de **seguridad en la base de datos**. Los viajes ya
solo se guardan a través del servidor, que valida los permisos finos de cada miembro, pero otras
tablas, como `trip_members`, todavía aceptan escrituras directas que el servidor no permitiría.

| Comprobación | Exportación de Lovable | Versión migrada |
|---|---|---|
| Instalar dependencias | Falla fuera de Lovable: `bun.lock` apunta a su registro privado (403) y `package-lock.json` está desincronizado | Funciona con `bun install` |
| `tsc --noEmit` | Sin errores | Sin errores |
| `vite build` | Funciona | Funciona |
| `wrangler deploy --dry-run` | No probado | Funciona: 1,8 MB comprimido |
| Tests unitarios (`bun test`) | 37 pasan | 37 pasan |
| Test e2e de Playwright | Requiere sesión de Lovable o login; el selector del botón no coincidía | Selector corregido; requiere servidor, sesión y un viaje real |
| ESLint | 3.463 problemas | 3.375 problemas |
| Migraciones sobre Postgres 16 limpio | Dos carpetas, sin buckets ni algunos permisos | Todas las migraciones aplicadas en orden, buckets y permisos incluidos |

Desglose de ESLint en la versión migrada:

| Regla | Cantidad |
|---|---|
| Formato de Prettier | 3.166 |
| `no-explicit-any` | 166 |
| `react-refresh/only-export-components` | 22 (avisos) |
| `react-hooks/exhaustive-deps` | 14 (avisos) |
| Otras | 7 |

El formato se arregla con `bun run format`, conviene hacerlo en un commit aparte.

## Tamaño y forma del código

| Medida | Valor |
|---|---|
| Líneas de TypeScript, TSX y SQL | unas 46.000 |
| Archivo más grande: `src/routes/_authenticated/viajes.$tripId.tsx` | 10.107 líneas |
| `src/lib/trips-store.ts` | 3.248 líneas |
| Server functions (`*.functions.ts`) | 11 archivos |
| Componentes de UI de shadcn | 46 |
| Planes históricos de Lovable | 38 |

## Seguridad

Ordenado por gravedad.

1. **Las organizadoras pueden gestionar miembros desde la base.** Leído: las server functions
   exigen owner global, pero la RLS de `trip_members` permite a organizadoras insertar, editar
   permisos y borrar miembros. Esos cambios no quedan en `access_audit_log`.
2. **El permiso de finanzas solo oculta la interfaz.** Leído: `listMyTrips` devuelve el JSON
   completo, con finanzas y datos personales de viajeras, a cualquier miembro.
3. **Analítica falsificable.** Leído: `anon` puede insertar en `trip_page_events` con cualquier
   `trip_id` directamente por PostgREST, sin límite de frecuencia y saltando el filtro del
   equipo de `/api/public/track`.
4. **Landings listables.** Leído: `trip_pages` tiene SELECT abierto a `anon`, así que se pueden
   listar todas las páginas con su `owner_id` y `trip_id`.
5. **Canal de actividad público.** Leído: `trip-activity:<tripId>` es un canal broadcast sin
   autorización; quien conozca un id puede escuchar o enviar avisos falsos.
6. **Aceptar invitaciones depende de que Supabase confirme el email.** Leído: se compara
   `claims.email` sin mirar `email_verified`. En el proyecto Supabase nuevo hay que dejar activa
   la confirmación de email; si no, alguien podría registrarse con el email invitado de otra
   persona.
7. **Otros menores.** Leído: cada usuaria puede editar su `profiles.email` (que se usa para los
   avisos de solicitudes); `generateSalesCopy` solo exige sesión y el registro está abierto;
   `/api/public/page-image/*` sirve cualquier ruta válida del bucket aunque la página no esté
   publicada; `has_role` permite averiguar quién es owner.

Ya corregido: los viajes solo se actualizan desde `updateTripData`, que escribe con la clave de
servicio después de validar (`20261105120000_trips_write_via_server.sql`). Antes, cualquier
miembro podía cambiar la fila completa con su sesión, incluso ponerse como `owner_id` y borrar el
viaje; se comprobó con PostgREST sobre las migraciones anteriores. La regla de permisos
(`src/lib/trip-write-scopes.ts`) ahora cubre todos los campos: la papelera y cualquier campo sin
regla declarada son solo del owner.

Las notas de costo, que antes se mostraban sin sanear, pasan por `sanitizeNoteHtml`
(`src/lib/sanitize-note-html.ts`): solo quedan etiquetas de formato y enlaces http, https o mailto.

## Bugs

| Área | Problema | Cómo se sabe |
|---|---|---|
| Guardado del viaje | Cada carga crea objetos nuevos y puede reprogramar el guardado de todos los viajes; con Realtime podría encadenar recargas | Leído, sin reproducir |
| Analítica | "Visitas totales" son solo 30 días con tope de 5.000 filas | Leído |
| Monedas | Dashboard, Finanzas y viajeras formatean en USD aunque la moneda base sea otra, y el dashboard suma monedas distintas | Leído |
| Viajeras | Con crédito aplicado, las cuotas se crean por el precio completo | Leído |
| Itinerario | Título, descripción y actividades del día no se pueden editar, pero las exportaciones los usan | Leído |
| Correo | El correo a la viajera dice "CHAMA VIAJA" para todos los viajes | Leído |
| Base | Borrar solicitudes fallaba por falta de GRANT DELETE | Corregido en la migración nueva |
| Base | La suscripción Realtime a `user_roles` nunca recibía eventos | Corregido en la migración nueva |

## Funcionalidad a medio hacer

- Itinerarios, Proveedores, Pagos, Reportes y CRM del menú están vacíos.
- Ajustes guarda métodos de pago y extras que nadie usa; el viaje usa presets fijos de Stripe.
- Las invitaciones no se envían por correo; se copia el enlace.
- La purga de la papelera depende de que alguien abra la app; los archivos de Storage quedan
  huérfanos al borrar viajes, viajeras o imágenes.
- No hay forma de despublicar una landing ni redirección al cambiar el slug.
- Los permisos `editar_costos`, `editar_itinerario`, `registrar_pagos`, `editar_extras` y
  `marcar_operativo` no se usan en la interfaz; solo los aplica el servidor.

## Deuda técnica

- **Todo el viaje en un JSON.** `trips.data` se guarda entero en cada cambio y gana la última
  escritura. Cada evento de Realtime vuelve a pedir todos los viajes, y `REPLICA IDENTITY FULL`
  transmite el JSON completo. Escala mal con muchas viajeras o mucha edición simultánea.
- **Archivo de 10.000 líneas.** `viajes.$tripId.tsx` mezcla cabecera, costos, viajeras, pagos,
  extras, créditos y resumen. Cortes naturales: `header/`, `costs/`, `enrollees/` (con
  `payments/`, `extras/`, `credits/`), `summary/`.
- **Moneda.** Hay unos 164 usos de `formatUSD` frente a 15 de `formatMoney` en ese archivo.
- **Tests.** Los archivos `*.test.ts` son tests unitarios de funciones puras, y el e2e de
  horarios modifica datos reales. La lista de comprobación de despliegues (`bun run smoke`)
  recorre ingreso, panel, editor, portadas, papelera y el envío del formulario público contra un
  despliegue, pero no hay tests de permisos, analítica ni del contenido de los correos.
- **Código muerto.** `ItineraryTab`, `AutoResizeTextarea`, `seedEnrollee`, `addTripMember`,
  `PracticalInfo`, varios imports sin uso.

## Lo que no se pudo verificar

- **Estado real de la base de Lovable.** Configuración exacta de los buckets, cambios hechos
  solo con datos (marcas `oaxaca-legacy`, respaldos en `trip_page_backups`, borradores de Caripe
  y Tailandia) y la configuración de Auth.
- **Fotos de la plantilla.** La red de este entorno bloquea `lovable.app`; hay que bajarlas con
  `bun run assets:download` desde una máquina con acceso.
- **Comportamiento contra un Supabase real.** OAuth de Google, Realtime y Storage no se probaron.
  Las migraciones se aplicaron sobre Postgres 16 con un esquema que imita `auth` y `storage`.

## Próximos pasos recomendados

1. Completar la puesta en marcha de [migracion.md](migracion.md).
2. Endurecer la RLS de `trip_members` y mover la escritura de analítica solo al servidor.
3. Formatear todo el repo en un commit aparte y partir `viajes.$tripId.tsx`.

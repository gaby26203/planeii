# Estado del repositorio

Análisis de la exportación de Lovable del 14 de octubre de 2026 y de la versión migrada. Cada
hallazgo indica cómo se comprobó:

- **Verificado**: se ejecutó o se leyó el código y la evidencia es directa.
- **Leído**: se deduce de leer el código, pero no se reprodujo en ejecución.

## Resumen

La app compila, pasa el typecheck y sus tests unitarios. Funcionalmente está madura en dos áreas:
el espacio de trabajo de cada viaje (costos, viajeras, pagos, notas) y el editor de páginas de
venta con su formulario público. Cinco de las once secciones del menú están vacías.

Los problemas más serios no son de build sino de **seguridad en la base de datos**: los permisos
finos por miembro solo se aplican en una server function, y las políticas RLS dejan a cualquier
miembro de un viaje escribir la fila completa directamente.

| Comprobación | Exportación de Lovable | Versión migrada |
|---|---|---|
| Instalar dependencias | Falla fuera de Lovable: `bun.lock` apunta a su registro privado (403) y `package-lock.json` está desincronizado | Funciona con `bun install` |
| `tsc --noEmit` | Sin errores | Sin errores |
| `vite build` | Funciona | Funciona |
| `wrangler deploy --dry-run` | No probado | Funciona: 1,8 MB comprimido |
| Tests unitarios (`bun test`) | 37 pasan | 37 pasan |
| Test e2e de Playwright | Requiere sesión de Lovable o login; el selector del botón no coincidía | Selector corregido; requiere servidor, sesión y un viaje real |
| ESLint | 3.463 problemas | 3.375 problemas |
| Migraciones sobre Postgres 16 limpio | Dos carpetas, sin buckets ni algunos permisos | 31 migraciones aplicadas en orden, buckets y permisos incluidos |

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

1. **Cualquier miembro puede escribir la fila completa de un viaje.** Verificado en
   `supabase/migrations/20260716031213_…sql`: la política de UPDATE de `trips` acepta a
   cualquier miembro y el GRANT de UPDATE cubre todas las columnas. Un tour leader puede, con la
   clave pública y su JWT, cambiar `data` sin pasar por `updateTripData` e incluso poner su
   propio `owner_id`, con lo que pasa a cumplir la política de DELETE.
2. **Las organizadoras pueden gestionar miembros desde la base.** Leído: las server functions
   exigen owner global, pero la RLS de `trip_members` permite a organizadoras insertar, editar
   permisos y borrar miembros. Esos cambios no quedan en `access_audit_log`.
3. **`requiredScopes` no cubre todos los campos.** Leído: no revisa `isDeleted`, `purgeAt`,
   `coverImage`, monedas, `country` ni `tags`. Un miembro sin permisos podría marcar un viaje en
   papelera con `purgeAt` vencido, y la próxima carga de la owner lo borraría en duro.
4. **El permiso de finanzas solo oculta la interfaz.** Leído: `listMyTrips` devuelve el JSON
   completo, con finanzas y datos personales de viajeras, a cualquier miembro.
5. **XSS almacenado en notas de costo.** Verificado: `CostNoteEditor.tsx` muestra el HTML guardado
   con `dangerouslySetInnerHTML` sin sanear. Combinado con el punto 1, cualquier miembro puede
   inyectar HTML que se ejecuta en la sesión de otra persona del equipo.
6. **Analítica falsificable.** Leído: `anon` puede insertar en `trip_page_events` con cualquier
   `trip_id` directamente por PostgREST, sin límite de frecuencia y saltando el filtro del
   equipo de `/api/public/track`.
7. **Landings listables.** Leído: `trip_pages` tiene SELECT abierto a `anon`, así que se pueden
   listar todas las páginas con su `owner_id` y `trip_id`.
8. **Canal de actividad público.** Leído: `trip-activity:<tripId>` es un canal broadcast sin
   autorización; quien conozca un id puede escuchar o enviar avisos falsos.
9. **Aceptar invitaciones depende de que Supabase confirme el email.** Leído: se compara
   `claims.email` sin mirar `email_verified`. En el proyecto Supabase nuevo hay que dejar activa
   la confirmación de email; si no, alguien podría registrarse con el email invitado de otra
   persona.
10. **Otros menores.** Leído: cada usuaria puede editar su `profiles.email` (que se usa para los
    avisos de solicitudes); `generateSalesCopy` solo exige sesión y el registro está abierto;
    `/api/public/page-image/*` sirve cualquier ruta válida del bucket aunque la página no esté
    publicada; `has_role` permite averiguar quién es owner.

## Bugs

| Área | Problema | Cómo se sabe |
|---|---|---|
| Formulario público | El campo trampa anti-spam nunca finge éxito: el esquema lo rechaza antes con 400 | Verificado en `apply.ts` |
| Notas de costo | HTML sin sanear (ver Seguridad 5) | Verificado |
| Guardado del viaje | Los errores de autosave se guardan en `saveError` pero ningún componente los muestra; el cambio se pierde en la siguiente recarga | Leído |
| Guardado del viaje | Cada carga crea objetos nuevos y puede reprogramar el guardado de todos los viajes; con Realtime podría encadenar recargas | Leído, sin reproducir |
| Nuevo viaje | El id pre-generado no se regenera al cerrar el diálogo; un segundo viaje sin recargar podría chocar | Leído |
| Analítica | Los clics de la barra de anuncio nunca se cuentan y "Ver itinerario" cuenta como clic de reserva | Leído |
| Analítica | "Visitas totales" son solo 30 días con tope de 5.000 filas | Leído |
| Reservar | `/v/$slug/reservar` muestra el formulario interno aunque el modo sea externo; al enviar responde 409 | Leído |
| Monedas | Dashboard, Finanzas y viajeras formatean en USD aunque la moneda base sea otra, y el dashboard suma monedas distintas | Leído |
| Portada | Para organizadoras el botón aparece pero el diálogo solo se monta para owner | Leído |
| Duplicar | El viaje duplicado comparte la referencia de portada; borrarla en uno rompe el otro | Leído |
| Viajeras | Con crédito aplicado, las cuotas se crean por el precio completo | Leído |
| Itinerario | Título, descripción y actividades del día no se pueden editar, pero las exportaciones los usan | Leído |
| Estados | Valor por defecto `"planificacion"` no existe (debería ser `planificando`) | Leído |
| Correo | El correo a la viajera dice "CHAMA VIAJA" para todos los viajes | Leído |
| Contraseña | Con un enlace de recuperación vencido, `/reset-password` queda cargando para siempre | Leído |
| Editor | "Descartar" puede volver a una versión vieja si se publicó en la misma sesión | Leído |
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
- **Tests.** Los 7 archivos `*.test.ts` son tests unitarios de funciones puras. El único e2e
  prueba los horarios de costos y modifica datos reales. No hay cobertura de publicación,
  formulario público, analítica, correos ni permisos.
- **Código muerto.** `ItineraryTab`, `AutoResizeTextarea`, `seedEnrollee`, `addTripMember`,
  `PracticalInfo`, varios imports sin uso.
- **Textos en voseo.** Lovable escribió la interfaz en español rioplatense ("tenés", "Revisá",
  "Elegí", "¿Sos nueva?"): unas 170 formas en unos 45 archivos de `src/`. El público es
  venezolano, así que hay que pasarlas a español neutro con tú.

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
2. Endurecer la RLS de `trips` y `trip_members`, sanear el HTML de notas y mover la escritura de
   analítica solo al servidor.
3. Mostrar los errores de guardado automático.
4. Formatear todo el repo en un commit aparte y partir `viajes.$tripId.tsx`.

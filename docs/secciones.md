# Secciones de la app

Estado de cada sección según el código a octubre de 2026. "Completa" significa que lee y escribe
datos reales en Supabase; no que no tenga bugs (ver [estado.md](estado.md)).

## Menú lateral

Definido en `src/components/AppSidebar.tsx`. Las rutas están en `src/routes/_authenticated/`.

| Sección | Ruta | Qué hace | Estado | Datos | Quién la ve |
|---|---|---|---|---|---|
| Viajes | `/` | Tarjetas de viajes, indicadores globales, crear, duplicar, mandar a papelera, renombrar, aviso de solicitudes nuevas, enlace a la página publicada | Completa | `trips`, `trip_applications`, `trip_pages`, bucket `trip-covers` | Todas |
| Itinerarios | `/itinerarios` | Texto "Selecciona un viaje", sin selector | Vacía | Ninguno | Owner |
| Proveedores | `/proveedores` | "Próximamente". Los proveedores existen por viaje | Vacía | Ninguno | Owner |
| Finanzas | `/finanzas` | Selector de viaje, costo, ingreso, utilidad, cuotas vencidas, cobranza, créditos de todos los viajes, tabla de costos | Completa, solo lectura | `trips.data` vía store | Owner u organizadora |
| Pagos | `/pagos` | "Próximamente". Los pagos se registran dentro del viaje | Vacía | Ninguno | Owner |
| Reportes | `/reportes` | "Próximamente". Existe exportación PDF/Excel por viaje | Vacía | Ninguno | Owner |
| CRM | `/crm` | "Próximamente". Las solicitudes viven en cada viaje | Vacía | Ninguno | Owner |
| Gestión de accesos | `/accesos` | Usuarios y rol owner, invitaciones, membresías y permisos, bitácora | Completa | `profiles`, `user_roles`, `trip_invitations`, `trip_members`, `access_audit_log` | Owner |
| Mis accesos | `/mis-accesos` | Membresías propias, permisos efectivos, historial, nombre visible | Completa | Mismas tablas, filtradas a la usuaria | Todas |
| Ajustes y plantillas | `/ajustes` | Plantillas de reembolsos, presets de costos, métodos de pago, extras; nombre visible | Parcial: se usan reembolsos y presets de costos; métodos de pago y extras se guardan pero nadie los lee | `account_defaults`, `profiles` | Todas (el comentario dice "solo owners") |
| Papelera | `/papelera` | Viajes borrados, restaurar, eliminar definitivo | Completa | `trips.data.isDeleted`, `deleteTrip` | Ruta abierta; botones solo para owner |

## Espacio de un viaje

Ruta `/viajes/$tripId`, archivo `src/routes/_authenticated/viajes.$tripId.tsx` (unas 10.000
líneas). La pestaña inicial sale de `?tab=`; si no viene, es Costos con permiso de finanzas y
Viajeras sin él.

| Pestaña o bloque | Qué hace | Componente | Permiso para verla |
|---|---|---|---|
| Cabecera | Exportar, enlaces a página de venta y solicitudes, miembros, duplicar o eliminar, portada, nombre, estado, resumen plegable (destino, fechas, cupos, moneda, ocupación) | `TripHeader` | Acceso al viaje |
| Itinerario & Costos (`costos`) | Precio, costo y utilidad; costos por "General" y "Día N"; ciudad por día, horario, tags, filtros, deshacer | `CostsTab` | `ver_finanzas` |
| Viajeras (`viajeras`) | Inscripciones con cuotas, abonos, extras, créditos, descuentos, cancelación y auditoría; subpestaña Logística con vuelos, seguro y archivos | `EnrolleesTab`, `EnrolleeCard`, `enrollees/LogisticsTab` | Acceso al viaje |
| Proveedores (`proveedores`) | Proveedores del viaje, estado y costos vinculados | `components/ProvidersTab.tsx` | Acceso al viaje |
| Resumen (`resumen`) | Resumen financiero y simulador de escenarios | `FinancialSummaryTab`, `ScenarioSimulator` | `ver_finanzas` |
| Notas (`notas`) | Tareas, notas y documentos con páginas de detalle | `components/trip-notes/NotesTab.tsx` | Acceso al viaje |

Rutas hermanas del viaje:

| Ruta | Qué hace |
|---|---|
| `/viajes/$tripId/pagina` | Editor de la página de venta |
| `/viajes/$tripId/metricas` | Métricas de la landing de los últimos 30 días |
| `/viajes/$tripId/solicitudes` | Panel de solicitudes del formulario público |
| `/viajes/$tripId/notas/$noteId` | Detalle de una nota |
| `/viajes/$tripId/todos/$todoId` | Detalle de una tarea, con responsable y fechas |

Permisos finos por miembro (`src/lib/trip-permissions.ts`): `ver_finanzas`, `editar_costos`,
`editar_itinerario`, `gestionar_viajeras`, `registrar_pagos`, `editar_extras`,
`editar_proveedores`, `marcar_operativo`.

## Página de venta (landing)

Orden por defecto en `src/lib/trip-editor.ts`; render en `src/components/trip/TripLanding.tsx`.
Todas las secciones se pueden reordenar u ocultar, salvo las marcadas como fijas.

| Sección | Componente |
|---|---|
| Barra de anuncio (fuera del contenedor, programable, se cierra por sesión) | `StickyBar` en `Closing.tsx` |
| Navegación | `Navbar.tsx` |
| Portada (fija) | `Hero` en `Hero.tsx` |
| Datos del viaje (fija) | `TripMeta` en `Hero.tsx` |
| Historia | `Story.tsx` |
| Experiencias (carrusel) | `HighlightsCarousel.tsx` |
| Itinerario en zig-zag con acordeón | `Itinerary` en `Details.tsx` |
| Incluye / no incluye | `Included`, `NotIncluded` en `Details.tsx` |
| Alojamiento | `Accommodation` en `Details.tsx` |
| Precio y reserva | `BookingCTA`, `AskContact` en `Closing.tsx` |
| Testimonios | `Testimonials` en `Closing.tsx` |
| Anfitrionas | `Host.tsx` |
| Para quién es | `TravelerProfile` en `Closing.tsx` |
| Preguntas frecuentes | `FAQ` en `Closing.tsx` |
| Historias visuales | `Gallery` en `Details.tsx` |
| Cierre (fija) | `FinalCTA` en `Closing.tsx` |
| Pie | `Footer` en `Closing.tsx` |
| Formulario y gracias | `ApplyFormView.tsx` |

Herramientas del editor (`src/components/editor/`): edición de texto en línea con formato,
reemplazo de imágenes con recorte, encuadre móvil de la portada, colores y estilos por sección y
por texto, destinos de cada botón, editor del formulario, textos con IA, checklist antes de
publicar, historial de 20 publicaciones, vista previa compartible por 24 horas.

## Rutas públicas y API

| Ruta | Qué hace |
|---|---|
| `/auth` | Ingreso, registro y Google; conserva la invitación |
| `/reset-password` | Nueva contraseña desde el enlace de recuperación |
| `/invitacion/$token` | Acepta una invitación a un viaje |
| `/v/$slug` | Landing publicada con SSR y analítica |
| `/v/$slug/reservar` | Formulario de solicitud |
| `/preview` | Lienzo del editor (iframe) o snapshot de vista previa |
| `POST /api/public/apply` | Recibe solicitudes y envía correos |
| `POST /api/public/track` | Registra eventos de analítica |
| `GET /api/public/page-image/*` | Sirve fotos de landings desde el bucket privado |
| `GET /api/dev/email-preview` | Vista previa de plantillas de correo, solo en desarrollo |

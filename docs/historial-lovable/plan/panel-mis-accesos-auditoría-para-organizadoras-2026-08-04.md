# Panel "Mis accesos" (auditoría para organizadoras)

Nueva página interna donde cada organizadora ve, sin depender del owner:
sus roles/membresías por viaje, qué permisos tiene habilitados y cuándo se
actualizaron por última vez.

## Cómo se vería

Ruta nueva `/mis-accesos`, con entrada en el menú lateral (icono de escudo,
visible para cualquier usuaria con sesión — no solo owner).

```text
┌───────────────────────────────────────────────────────────────┐
│  Mis accesos                            [Actualizar]          │
│  Rol global: Organizadora   ·   3 viajes con acceso           │
├───────────────────────────────────────────────────────────────┤
│  Oaxaca me encantas                       Organizadora        │
│  Acceso desde 12 mar 2026 · Últ. cambio 3 ago 2026 (owner)    │
│  ✓ Ver finanzas      ✓ Editar costos     ✓ Itinerario         │
│  ✓ Proveedores       ✓ Viajeras          ✓ Pagos              │
│  ✓ Extras            ✓ Operativo                              │
│  [Abrir viaje]                          Permisos: 8 de 8      │
├───────────────────────────────────────────────────────────────┤
│  Tailandia 2026                           Tour leader         │
│  Acceso desde 1 ago 2026 · Últ. cambio 1 ago 2026             │
│  ✗ Ver finanzas      ✗ Editar costos     ✗ Itinerario         │
│  ✗ Proveedores       ✗ Viajeras          ✗ Pagos              │
│  ✗ Extras            ✓ Operativo                              │
│  [Abrir viaje]                          Permisos: 1 de 8      │
└───────────────────────────────────────────────────────────────┘
```

Detalles visuales:
- Una tarjeta por viaje, cabecera oscura con el nombre del viaje y chip de rol
  (terracota para organizadora, gris para tour leader), en la línea del estilo
  actual de la app.
- Los permisos se muestran como grilla de chips: activo en terracota suave con
  check, inactivo en gris con línea tenue. Tooltip con la descripción de cada
  permiso (se reutilizan los textos ya definidos en el sistema de permisos).
- Contador "X de 8" y etiqueta "según defaults del rol" cuando el owner no ha
  personalizado nada.
- Al pie, un bloque colapsable "Historial de cambios" con las últimas entradas
  que le afectan a ella (invitación, alta, cambio de permisos, baja), con fecha,
  acción y quién la hizo.
- Estado vacío: "Aún no tienes viajes asignados. Pide a la dueña de la cuenta
  que te invite" con enlace al dashboard.
- Mobile: tarjetas a una columna, chips de permisos en 2 columnas.

Este panel es solo de lectura: nadie puede cambiar sus propios permisos desde
aquí. Los cambios los sigue haciendo el owner en la pantalla de Accesos.

## Detalles técnicos

- Nueva ruta `src/routes/_authenticated/mis-accesos.tsx` + entrada en
  `AppSidebar.tsx` (sin gate de owner).
- Nuevo `src/lib/my-access.functions.ts` con un server fn
  `getMyAccessAudit` protegido por `requireSupabaseAuth`, que devuelve para el
  usuario autenticado: membresías (`trip_members`: trip_id, role, permissions,
  created_at), nombre/estado del viaje, si es owner global (`user_roles`), y su
  historial desde `access_audit_log`. La política actual de
  `access_audit_log` solo permite lectura al owner, así que el historial se lee
  con el cliente admin dentro del handler, filtrado estrictamente por
  `target_user_id = context.userId` (o su email) — no se expone nada de otras
  usuarias.
- Los permisos efectivos se calculan con `normalize`/`defaultsForRole` de
  `src/lib/trip-permissions.ts`, la misma fuente que usa la app, para que el
  panel no pueda desviarse de lo real.
- "Última actualización de permisos" se deriva de la entrada más reciente del
  audit log para ese viaje/usuaria; si no hay ninguna, se muestra la fecha de
  alta de la membresía.
- Datos con TanStack Query desde el componente (no en loader) + botón
  Actualizar que invalida la query y llama a `refreshAccess()`.
- `head()` propio con título y descripción de la página.

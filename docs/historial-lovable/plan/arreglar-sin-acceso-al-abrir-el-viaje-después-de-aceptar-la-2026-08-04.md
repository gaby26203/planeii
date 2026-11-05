# Arreglar "Sin acceso" al abrir el viaje después de aceptar la invitación

## Qué verifiqué en la base

- Una organizadora invitada ([email y user_id redactados]) **sí tiene membresía** en el viaje "Tailandia con el Alma" con rol `organizadora` y los 8 permisos en `true`.
- Las políticas de acceso y los permisos de tabla (`trips`, `trip_members`) están correctos: no es un problema de base de datos ni de RLS.

## Causa

Los permisos de pantalla se cargan **una sola vez** al montar la app (contexto de accesos) y solo se recargan cuando cambia la sesión (entrar/salir).

Su membresía se creó **después** de ese momento: al entrar a la app, el cierre automático de invitaciones pendientes crea la membresía y recarga la lista de viajes — por eso el viaje aparece en el dashboard — pero **no** recarga el contexto de permisos. Ese contexto sigue creyendo que no es miembro de ningún viaje, así que la pantalla del viaje muestra "No tenés permisos para ver esta sección".

Se resuelve solo si recarga la página por completo (o cierra y vuelve a iniciar sesión), lo que coincide con el síntoma reportado: el viaje se ve, pero al entrar dice sin permiso.

## Solución

1. **Recargar permisos al aceptar invitaciones**: cuando el cierre automático de invitaciones acepta algo, además de recargar los viajes, refrescar el contexto de accesos (membresías + rol).
2. **Mantener los permisos sincronizados en vivo**: cuando lleguen cambios en membresías o roles (los mismos eventos en tiempo real que ya recargan los viajes), refrescar también los permisos, con el mismo agrupado de 300 ms.
3. **No mostrar "Sin acceso" antes de tiempo**: si el viaje existe en la lista pero las membresías todavía no llegaron, mostrar el estado de carga y hacer un reintento de refresco antes de negar el acceso — así nunca se ve un falso "sin permiso".
4. **Mensaje del bloqueo**: si tras refrescar realmente no hay acceso, mantener la pantalla actual pero indicando a quién escribir.

Sin cambios de base de datos, sin tocar roles ni permisos existentes.

## Detalles técnicos

- `src/lib/access.tsx`: exponer el `refresh` del contexto de forma accesible fuera de React (registro de un refresher a nivel de módulo o mover el estado a un store) para poder invocarlo desde `TripsSyncer`.
- `src/routes/_authenticated/route.tsx`: tras `acceptMyPendingInvitations` con resultado no vacío, llamar al refresh de accesos; añadir el refresh al `scheduleRehydrate` de los eventos Realtime de `trip_members`, `user_roles` y `trip_invitations`.
- `src/components/AccessGate.tsx`: distinguir "cargando/aún sin datos" de "denegado" y disparar un único refresh de cortesía antes de renderizar el bloqueo.

## Prueba

1. Con la cuenta de ella (o una cuenta nueva invitada como Organizadora): abrir el enlace, crear cuenta, entrar.
2. En el dashboard aparece el viaje; pulsar "Ver más detalles" → entra al viaje **sin recargar la página** y sin mensaje de sin permiso.
3. Ve las secciones de Organizadora (Itinerario & Costos, Viajeras, Notas, Proveedores) y no las de owner.
4. Cerrar sesión, volver a entrar y desde otro dispositivo: conserva el acceso.
5. Caso negativo: una cuenta sin membresía sigue viendo el bloqueo con el mensaje correcto.

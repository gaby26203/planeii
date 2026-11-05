# Notificaciones en vivo de cambios dentro del viaje

Cuando otra organizadora o tour leader guarde un cambio en el viaje abierto, verás un toast breve tipo:

> **Ana** actualizó *Itinerario & Costos*

Reglas de comportamiento:

- Solo aparece dentro del dashboard de ese viaje (no en el dashboard general).
- Nunca se muestra por tus propios cambios.
- Se agrupan: si la misma persona guarda varias veces seguidas en la misma sección, se actualiza un solo toast en vez de apilar muchos (ventana de ~4 segundos).
- Duración corta (~4s) y posición discreta, sin bloquear la tabla.
- Se identifica a la persona por su nombre de perfil (o el email si no tiene nombre).
- El aviso es solo informativo: los datos ya se refrescan solos con la sincronización en vivo actual.

## Detalle técnico

- Canal Realtime por viaje (`trip-activity:<tripId>`) usando `broadcast`: quien guarda emite `{ actorId, actorName, section }`; los demás lo reciben y muestran el toast con `sonner`.
- Se emite desde el punto de guardado del viaje (la cola de guardado en `src/lib/trips-store.ts`), tomando la sección activa del dashboard como etiqueta; se ignora el evento si `actorId` es el usuario actual.
- Nuevo hook `src/hooks/use-trip-activity.ts`: suscribe/desuscribe el canal en `useEffect`, mantiene el mapa de agrupación y expone `notifyTripActivity(section)` para el emisor. Limpieza de canal al desmontar (sin fugas de suscripción).
- La sección activa (Resumen, Notas, Itinerario & Costos, Viajeras, Proveedores...) se registra en el store del viaje desde `src/routes/_authenticated/viajes.$tripId.tsx` para que el broadcast la incluya.
- Sin cambios de base de datos ni migraciones: es efímero, no se persiste historial.

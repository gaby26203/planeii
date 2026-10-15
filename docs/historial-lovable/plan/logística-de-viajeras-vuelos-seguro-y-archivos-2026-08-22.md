# Logística de viajeras: vuelos, seguro y archivos

Nueva sub-pestaña **Logística** dentro de Viajeras, con una tabla comparativa de todas las viajeras y edición inline. Los mismos datos quedan disponibles en la ficha de cada viajera.

## La tabla de Logística

Una fila por viajera (respeta el buscador y los filtros ya existentes de Viajeras):

```text
Viajera | Vuelo IDA | Vuelo VUELTA | Seguro | Archivos
```

- **Vuelo IDA / VUELTA**: celda compacta que muestra aerolínea + número de vuelo y fecha/hora; al hacer click se abre el editor con todos los campos.
- **Seguro**: chip de estado (Con seguro / Sin seguro / Vence antes del viaje) + aseguradora y póliza.
- **Archivos**: contador de adjuntos con acceso rápido para subir o ver.

Arriba de la tabla, un resumen de avance: cuántas ya tienen boleto de ida, de vuelta y seguro cargado, con filtros rápidos (Sin boleto, Sin seguro, Seguro vencido).

## Datos de cada vuelo (ida y vuelta)

Aerolínea, número de vuelo, código de reserva, aeropuerto de salida y de llegada, fecha y hora de salida, fecha y hora de llegada, escalas (texto libre, ej. "Panamá 2h"), terminal, equipaje incluido y notas libres.

Validaciones suaves: aviso si la fecha de ida cae después del inicio del viaje o la de vuelta antes del fin, sin bloquear el guardado.

## Datos del seguro

Tiene seguro (sí/no), aseguradora, número de póliza, vigencia desde y hasta. Si la vigencia no cubre todo el rango del viaje, la fila muestra una alerta visible.

## Archivos adjuntos

Cada viajera puede tener varios adjuntos etiquetados: **Boleto ida**, **Boleto vuelta**, **Seguro**, **Pasaporte**, **Otro**. Acepta jpg, png, pdf (máximo 25 MB, igual que Docs), con vista previa para imágenes, descarga por enlace temporal y borrado. Se guardan en el mismo almacenamiento privado que ya usa la sección Docs, en una carpeta por viaje y viajera.

## Exportaciones

El Excel del viaje suma una hoja **Logística** con una fila por viajera (vuelos, seguro y lista de adjuntos con su etiqueta). El PDF incluye un bloque resumen de vuelos y seguro por viajera.

## Permisos

Igual que el resto de Viajeras: quien puede editar viajeras puede editar logística y subir archivos; el resto solo lee.

## Detalle técnico

- `src/lib/finance-types.ts`: extender `Enrollee` con `logistics?: { outbound?: FlightSegment; inbound?: FlightSegment; insurance?: InsuranceInfo; attachments?: EnrolleeAttachment[] }`. `FlightSegment` = airline, flightNumber, bookingCode, fromAirport, toAirport, departAt, arriveAt, stops, terminal, baggage, notes. `InsuranceInfo` = hasInsurance, provider, policyNumber, validFrom, validTo. `EnrolleeAttachment` = id, kind, title, storagePath, fileName, mimeType, sizeBytes, uploadedAt, uploadedBy.
- Sin migración de base de datos: las viajeras ya viven en el JSON del viaje (`trips.data`), así que los campos nuevos se persisten con el flujo actual de guardado (`enqueueLatestTripSave` / `updateTrip`), y quedan cubiertos por las RLS del viaje.
- Archivos: bucket privado existente `trip-notes-docs`, ruta `${tripId}/viajeras/${enrolleeId}/${uuid}.${ext}`. Lectura con URL firmada, subida desde el cliente igual que `UploadDocumentDialog`, borrado del objeto al quitar el adjunto.
- Nuevos componentes en `src/components/enrollees/`: `LogisticsTab.tsx` (tabla + filtros + resumen), `FlightSegmentEditor.tsx` (popover/diálogo con Enter para guardar y Esc para cancelar, siguiendo `createDialogShortcuts`), `InsuranceEditor.tsx`, `EnrolleeAttachments.tsx`.
- Integración: sub-pestañas dentro del tab Viajeras de `src/routes/_authenticated/viajes.$tripId.tsx` (Inscripciones | Logística), reutilizando el estado de búsqueda/filtros existente; y una sección de logística en la ficha de la viajera.
- Auditoría: agregar acciones `logistica_editada` y `adjunto_agregado` / `adjunto_eliminado` al `auditLog` de la viajera, ya soportado por `AuditEntry`.
- Exportaciones: nueva hoja y bloque en `src/lib/trip-exports.server.ts` / `trip-exports.ts`, leyendo el JSON del viaje ya cargado en el servidor.
- Mobile: tabla con scroll horizontal y columna Viajera fija, igual que las demás tablas de la app.

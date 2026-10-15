# Colores independientes en las dos listas «Incluye»

## Qué pasa hoy
La lista «Incluye» de la sección Qué incluye y la lista «Incluye» de la sección de Reserva muestran los mismos ítems, y el editor guarda el color y formato de cada texto pegado a ese ítem. Por eso, cuando pintaste los ítems de oscuro en Qué incluye, ese mismo color se aplicó en Reserva (por eso se ven oscuros sobre el vino, salvo «8 días - 7 noches», que es otro dato).

## Qué voy a cambiar
- El **texto** de cada ítem sigue siendo uno solo: si corregís «Desayunos diarios» en un lugar, se actualiza en ambos (es la misma información).
- El **estilo** (color, negrita, cursiva, subrayado, enlace, tamaño, alineación) pasa a ser propio de cada sección. Lo que cambies en la lista de Reserva no toca Qué incluye, y viceversa.
- Lo mismo para «8 días - 7 noches» de la lista de Reserva, para que su color no dependa de otros lugares donde aparezca la duración.

## Cómo quedan las páginas existentes
- Qué incluye conserva exactamente los colores que ya tiene.
- En Reserva, los ítems dejan de heredar el color oscuro de Qué incluye y vuelven a tomar el color de texto de la sección (crema sobre vino). Desde ahí podés darles el color que quieras.
- Si después cambiás la redacción de un ítem desde una sección, el formato parcial por palabra de la otra sección se descarta (porque ya no coincide con el texto) y ese ítem toma el estilo general de su sección. Es la misma regla que ya existe para formatos desactualizados.
- Aplica igual en el editor, la vista previa y la página publicada.

## Detalles técnicos
- `EditableText` recibe una prop opcional `styleKey` (por defecto igual a `path`). El contenido se lee/escribe por `path`; `textStyles` se lee/escribe por `styleKey`.
- Mensajes del iframe: `trip-editor-text-select` envía `styleKey` como ruta seleccionada para el panel de estilo, y el listener de `trip-editor-inline-format` compara contra `styleKey`. `trip-editor-text-commit` envía `path` (contenido) y `styleKey` (estilo); `TripEditor` guarda el valor con `path` y el inline/estilo bajo `styleKey`.
- `Closing.tsx` (lista de reserva): `styleKey="booking.included.N"` y `styleKey="booking.duration"`. `Details.tsx` sin cambios (sigue usando `included.N`).
- Prueba nueva: un commit en la lista de reserva guarda el estilo en `booking.included.N` sin modificar `textStyles["included.N"]`, y el texto queda compartido.
- Regla en AGENTS.md: un mismo dato mostrado en dos secciones comparte el texto pero tiene un styleKey por ubicación.

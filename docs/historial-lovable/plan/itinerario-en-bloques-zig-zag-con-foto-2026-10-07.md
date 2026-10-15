# Itinerario en bloques zig-zag con foto

## Qué cambia

Los 8 días dejan de ser una lista continua. Se agrupan en bloques, y cada bloque
se muestra a un lado con una foto al lado contrario, alternando:

```text
ITINERARIO
Ocho días, día a día

Día 1 ───────────── ∨        ┌──────────────┐
Día 2 ───────────── ∨        │              │
Día 3 ───────────── ∨        │  foto 1      │
                             └──────────────┘

┌──────────────┐
│              │   Día 4 ──── ∨
│  foto 2      │   Día 5 ──── ∨
└──────────────┘

Día 6 ───────────── ∨        ┌──────────────┐
Día 7 ───────────── ∨        │              │
Día 8 ───────────── ∨        │  foto 3      │
                             └──────────────┘

[ Quiero reservar mi lugar ]
```

- El encabezado "ITINERARIO / Ocho días, día a día" queda intacto.
- Cada día sigue siendo una fila con su línea fina y su chevron, cerrada por defecto,
  con un solo día abierto a la vez (ahora compartido entre los bloques).
- El botón de reserva sigue al final de la sección.
- Editor, vista previa y página publicada muestran exactamente lo mismo.

## Cómo se edita

- **Días por bloque, desde el panel.** En el panel "Itinerario" aparece una lista de
  bloques: cada uno tiene un campo "Días" (número), su foto y su texto alternativo.
  Abajo, el total: "3 + 3 + 2 = 8 días". Si la suma queda por debajo de los días reales,
  los sobrantes forman un bloque final visible en el panel, con su botón "Cambiar foto".
- **Agregar o quitar bloques.** "Agregar bloque" toma un día del bloque más grande
  (no se puede superar un bloque por día). "Eliminar bloque" pasa sus días al bloque
  anterior. Nunca se pierde un día.
- **La foto de cada bloque, elegida por vos.** Se cambia tocándola en la vista previa
  (igual que las otras fotos) o con "Cambiar foto" en el panel. Entra al recorte
  recomendado con la proporción correspondiente.
- **Si un bloque todavía no tiene foto**, no se muestra un cuadro vacío: ese bloque
  queda solo con sus días y el respiro lo da la separación.

## Reglas de composición

- Sin `position: absolute`, márgenes negativos ni transforms: las dos columnas son
  Grid real, con `col-span` y alturas automáticas.
- La columna que alterna lado se decide en el orden del DOM, no con utilities de orden,
  así el orden de lectura coincide con el visual en todas las pantallas.
- Si el ancho del lienzo no alcanza para dos columnas, el bloque pasa a una columna
  (mismo comportamiento en editor, preview y publicada).
- Fotos con proporción fija y `object-cover` (no se deforman). Se alternan
  vertical (4/5) y horizontal (4/3) para reforzar el aire editorial.
- La separación entre bloques es un valor del sistema de diseño (`--itinerary-block-gap`,
  4rem; 6rem en pantallas medianas), no un margen suelto.
- Los títulos no cambian de tamaño ni de posición por estar en el editor.

## Detalles técnicos

- `src/data/trip.ts`: `TripData.itineraryGroups?: { id: string; size: number; image: Img }[]`,
  opcional, para que borradores y versiones publicadas sigan funcionando.
- `src/lib/trip-itinerary.ts` (nuevo): `ItineraryGroup`, `defaultItineraryGroups(totalDays)`
  (8 → 3 + 3 + 2, sin bloques de un solo día), `itineraryGroupPlan(trip)` que normaliza
  (tamaños ≥ 1, recorte al total, bloque final para los sobrantes) y
  `itinerarySlices(trip)` que devuelve por bloque sus días con el índice de origen.
- `src/components/trip/Details.tsx`: `Itinerary` arma bloques con `itinerarySlices`.
  El estado abierto del acordeón se sube a `Itinerary` (`value` / `onValueChange`
  controlado) y se pasa a cada bloque, para que siga habiendo un solo día abierto
  y el estado no se guarde en ningún lado.
- `src/components/editor/TripContentEditor.tsx`: sección "Bloques del itinerario" dentro
  del acordeón Itinerario, con RepeatEditor (Días / Cambiar foto / Texto alternativo /
  Eliminar), "Agregar bloque" y la suma de días.
- `src/components/editor/TripEditor.tsx`: rama `itinerary-group-{i}` en `applyCroppedImage`,
  proporción de recorte por paridad de bloque, y las fotos de bloque sumadas a las
  miniaturas de "Imágenes".
- `src/styles.css`: token `--itinerary-block-gap` y regla de separación entre bloques.
- `AGENTS.md` y la memoria del acordeón: la conducta "un día abierto a la vez, sin
  persistir" ahora se sostiene con estado compartido entre los bloques.

## Validación

- `bunx tsgo --noEmit` limpio y build OK.
- Playwright en editor, preview y publicada a 1280, 715 y 375 px: bloques alternados,
  sin cruces de títulos ni textos, un día abierto a la vez, foto reemplazable tocándola.
- Prueba de estrés: 7 y 9 días y un bloque sin foto, para confirmar que la repartición
  y el armado no dejan días fuera ni cuadros vacíos.

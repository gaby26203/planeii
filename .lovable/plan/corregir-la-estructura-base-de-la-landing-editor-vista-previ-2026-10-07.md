# Corregir la estructura base de la landing (editor = vista previa = publicada)

## Principio
Una sola composición para todas las vistas. Los ajustes se hacen en el layout base, así que lo que se ve en el editor es exactamente lo que se publica. Solo los controles del editor (bordes al pasar el cursor, botón de eliminar etiqueta, barra de formato) son exclusivos, y no ocupan espacio ni mueven contenido.

## Auditoría: qué depende hoy de técnicas frágiles

| Sección | Problema detectado | Corrección en el layout base |
|---|---|---|
| Portada y cierre final | Imagen y degradado en `absolute` detrás del texto; altura mínima de pantalla; el degradado bloquea el clic en la imagen | Usar una grilla de una celda donde imagen, degradado y texto comparten celda en el flujo normal; la altura crece con el contenido; el degradado no captura clics |
| Alojamiento | El título de sección y la imagen se cruzan (captura enviada); columnas 7/5 fijas | Título siempre en su propia fila arriba; imagen y texto en dos columnas solo cuando ambas tienen ancho mínimo suficiente, si no, una columna |
| Anfitriones | Nombre y biografía se montan uno sobre otro y el título invade la foto (captura enviada); uso de `row-start`/`col-start` forzados y `-order-1` | Grilla explícita sin posiciones forzadas: texto y foto en celdas separadas, con paso a una columna cuando no caben |
| Historia | Primera letra decorativa flotante que desplaza y rompe la edición del párrafo | Reemplazar por una inicial que no flote ni altere el flujo |
| Itinerario | Puntos decorativos con margen negativo fuera de la columna | Integrar el punto dentro de la línea de tiempo, sin salir del contenedor |
| Perfil de viajera | Desplazamiento vertical decorativo de la segunda columna | Alinear columnas en flujo normal; separación con espacio, no con desplazamientos |
| Datos del viaje | Botón eliminar en `absolute` sobre la etiqueta | Reservar su espacio en la fila (solo visible en editor, sin mover el texto publicado) |
| Títulos grandes (todas) | Tamaños basados en el ancho de la ventana, no en el de su columna; palabras largas o en mayúsculas desbordan | Tamaño calculado según el ancho de su contenedor, con corte de línea seguro; mismo resultado en editor y publicado |
| Columnas (todas) | Cambio a dos/tres columnas según la ventana, aunque la columna real sea estrecha | Columnas que se adaptan al ancho disponible de la sección, con mínimos por columna |

Primer paso de la implementación: confirmar en el navegador la causa exacta de cada cruce de las dos capturas (incluyendo estilos personalizados guardados en esa página) antes de cambiar código.

## Reglas aplicadas en todas las secciones
- Sin `absolute`, márgenes negativos ni `transform` para posicionar contenido principal.
- Alturas automáticas donde hay texto editable; nada de alturas fijas que recorten.
- Textos crecen hacia abajo y hacen wrap sin invadir columnas vecinas.
- Si dos columnas no caben, pasan a una, igual en editor y publicado.
- No se reducen tamaños, no se cambian posiciones ni se agregan fondos solo en el editor.
- Se conserva el estilo editorial: tipografías, colores, proporciones de imagen y ritmo de espacios.

## Validación
- Comparar capturas del editor y de la página publicada en los mismos anchos (amplio, mediano, estrecho y móvil): deben coincidir.
- Detectar automáticamente cruces entre cajas de títulos, párrafos e imágenes en todas las secciones, con textos de ejemplo largos y tamaño "Destacado".
- Comprobar que edición directa, cambio de imágenes, deshacer/rehacer y autoguardado siguen funcionando.

## Detalles técnicos
- Portada/cierre: `display:grid` con `grid-area: 1/1` para imagen, overlay (`pointer-events:none`) y contenido; `min-height` como mínimo, no altura fija.
- Breakpoints de composición pasan a container queries (`@container`) sobre el wrapper de sección, válidos tanto dentro del iframe como en la página publicada.
- Tipografía display/section-title con `clamp()` en unidades `cqi`, `overflow-wrap:anywhere` y `min-width:0` en celdas.
- Grillas con `grid-template-columns: repeat(auto-fit, minmax(min(100%, Xrem), 1fr))` o reglas `@container` equivalentes.
- Controles del editor en capas que no participan del layout (outline, pseudo-elementos o espacio reservado idéntico en ambos modos).
- Se registrará en AGENTS.md la regla: la landing usa un único layout de flujo para editor y publicación.

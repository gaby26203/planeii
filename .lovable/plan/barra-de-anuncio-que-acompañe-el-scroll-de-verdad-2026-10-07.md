# Barra de anuncio: que acompañe el scroll de verdad

Objetivo: la barra no queda clavada al principio de la página; viaja con la viajera al bajar y al subir, siempre visible en la parte superior de la pantalla.

## Qué pasa hoy
La barra está marcada como "fija arriba", pero el bloque que la envuelve en la landing está configurado para adaptar su diseño a su propio ancho. Esa configuración hace que el navegador trate la barra como fija **dentro de ese bloque** y no dentro de la pantalla. Como el bloque está al principio de la página, la barra se queda allí y desaparece al bajar.

## Qué voy a cambiar
1. Quitar del bloque que envuelve la barra esa configuración de "adaptarse a su ancho", para que la barra quede fija respecto de la pantalla.
2. Pasar esa misma configuración a la propia barra, así el texto, la cuenta regresiva, el botón y la X se siguen acomodando igual en escritorio y móvil.
3. Mantener los colores personalizados, la edición directa de textos y el cierre con X sin cambios.
4. Comprobar en editor, vista previa y página publicada (1280 px y 390 px) que la barra queda pegada arriba al bajar y al subir, sin tapar el menú ni la portada.

## Importante
La página publicada solo mostrará el arreglo después de volver a publicar.

## Detalle técnico
- En `TripLanding.tsx`, el wrapper `data-editor-section="announcement"` tiene `@container` (y `editor-preview`, que define `container-type: inline-size`). `container-type` aplica layout containment, lo que convierte al wrapper en containing block de los descendientes `position: fixed`.
- Solución: el wrapper conserva `data-editor-section`, `section-buttons` y las variables de estilo, pero sin `@container` ni `editor-preview`; esas clases pasan al `div.announcement-bar` en `StickyBar` (un elemento fijo puede ser su propio container; las queries `@2xl:` de sus hijos siguen funcionando contra el ancho del viewport).
- Verificación con Playwright: `getBoundingClientRect().top === 0` de la barra tras scroll a 600/1800/3000 px y de vuelta.
- Registrar en AGENTS.md: ningún ancestro de la barra fija puede tener container-type/transform/filter/contain.

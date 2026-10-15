# Completar el editor de la página de ventas

## Resultado de la auditoría

El editor actual guarda borradores por viaje, muestra los cambios en vivo y permite publicar la página. Sin embargo, hoy solo permite editar desde el panel lateral:
- Marca, destino, país, título, introducción, precio, moneda, cupos, duración y fechas.
- Enlace de reserva.
- Nombre, biografía e imagen de un solo anfitrión.
- Portada, historia, galería y cierre desde un selector de imágenes.
- Paletas, tipografías y escala mediante opciones predeterminadas.
- Orden y visibilidad de secciones.

Quedan fuera del editor la mayoría de los textos de historia, experiencias, incluidos, itinerario, alojamiento, perfil de viajera, información práctica, testimonios, preguntas frecuentes, cierre y contacto. También hay títulos, botones y frases fijas dentro de la plantilla. Las imágenes de experiencias y alojamientos no se pueden reemplazar. Las fotos no responden al clic dentro de la vista previa. No existe soporte para varios anfitriones ni colores personalizados por sección.

## Cambios a implementar

### 1. Edición completa del contenido
- Organizar **Contenido** por secciones plegables, siguiendo el mismo orden de la página.
- Añadir controles para todos los campos visibles: títulos, subtítulos, párrafos, etiquetas, botones, textos auxiliares, datos de reserva y contacto.
- Convertir el texto fijo que forma parte de la página en contenido editable, incluyendo navegación, llamadas a reservar, encabezados de sección, textos de ayuda, pie y barra inferior.
- Permitir agregar, eliminar y reordenar elementos repetibles: experiencias, párrafos, incluidos/no incluidos, días, alojamientos, características, perfiles, información práctica, testimonios, preguntas y fotos.
- Mantener como comportamiento interno únicamente los textos funcionales del editor, que no aparecen en la página publicada.

### 2. Imágenes editables directamente
- Hacer clic sobre cualquier foto en la vista previa abrirá la selección de archivo y luego el recorte.
- Incluir portada, historia, experiencias, anfitriones, alojamientos, galería y cierre.
- Mostrar en modo edición una indicación discreta sobre cada imagen, sin publicarla en la página final.
- Añadir edición de texto alternativo y pie de foto cuando corresponda.
- Mantener el panel **Imágenes** como alternativa para localizar y reemplazar fotos.

### 3. Varios anfitriones
- Cambiar el documento de un único anfitrión a una lista de anfitriones.
- Permitir agregar, eliminar y reordenar anfitriones; cada uno tendrá nombre, biografía, foto y texto alternativo.
- Adaptar la sección pública para mostrar uno o varios perfiles con una composición clara en móvil y computadora.
- Convertir automáticamente los documentos ya guardados con un solo anfitrión para no perder contenido existente.

### 4. Colores personalizables
- Conservar las tres paletas actuales como punto de partida.
- Añadir un editor de colores general para fondo, títulos, texto, texto secundario, acento y botones.
- Añadir ajustes opcionales por sección para fondo, títulos y texto; cada ajuste podrá volver al valor general.
- Incluir selector visual y campo de color, con vista previa inmediata.
- Avisar cuando una combinación tenga contraste insuficiente y ofrecer restaurar los colores de la paleta.

### 5. Documento, borradores y publicación
- Extender el formato guardado con una versión para migrar borradores y páginas publicadas anteriores de forma segura.
- Conservar el guardado automático por viaje y la publicación en el mismo enlace.
- Evitar que un documento antiguo, incompleto o con campos nuevos ausentes rompa la vista previa o la página pública.

## Detalles técnicos

- Añadir identificadores estables para textos, listas e imágenes editables.
- Comunicar los clics de imagen desde la vista previa embebida al editor mediante mensajes del mismo origen.
- Representar anfitriones como una colección y estilos como valores generales más anulaciones por sección.
- Aplicar colores elegidos por la organizadora mediante variables CSS acotadas a la página de ventas, sin afectar Planeii.
- Mantener compatibilidad de lectura con el formato actual de `trip_pages.document` y los borradores locales.

## Verificación

- Comprobar que cada texto visible tiene un control y que los cambios aparecen y se publican.
- Probar el clic y recorte de cada tipo de imagen.
- Probar uno, dos y tres anfitriones en móvil y computadora.
- Probar colores generales, colores por sección, restauración y alertas de contraste.
- Abrir una página publicada anterior y confirmar su migración sin pérdida de contenido.
- Validar borrador, publicación, reapertura del editor y página pública sin sesión.

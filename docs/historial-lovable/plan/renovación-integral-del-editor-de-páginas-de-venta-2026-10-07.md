# Renovación integral del editor de páginas de venta

## Objetivo
Convertir la propia página en la forma principal de edición: la organizadora podrá tocar cualquier texto, imagen o sección, modificarlo donde aparece y mantener una vista ordenada en cualquier tamaño de pantalla.

La vista móvil continuará como modo visitante interactivo, sin controles de edición, para revisar navegación, preguntas frecuentes, enlaces y reserva tal como los verá la viajera.

## 1. Simplificar el flujo del editor
- Reorganizar los controles en tres áreas claras: **Página**, **Diseño** y **Organización**.
- Usar la vista previa de escritorio como superficie principal de edición; dejar el panel como alternativa para contenido largo, listas y ajustes avanzados.
- Incorporar una guía inicial breve y descartable que indique que textos e imágenes se editan tocándolos.
- Mantener visibles los datos pendientes desde cualquier área del editor.
- Sustituir la ambigüedad entre autoguardado y Guardar por estados claros: `Guardando…`, `Guardado` y `Error al guardar`.
- Mantener **Publicar** como acción principal y separar visualmente deshacer/historial de descartar/restaurar.
- Usar confirmaciones diferenciadas para volver a la última publicación y restaurar la plantilla.
- Ordenar el navegador de contenido igual que la página visible y agruparlo en esenciales, contenido del viaje, confianza y cierre.

## 2. Edición directa completa
- Auditar y envolver todos los textos visibles que todavía son fijos: barra de reserva, pie, contacto, etiquetas de Instagram/Email/WhatsApp y menú móvil.
- Mantener automáticos únicamente los números de orden, como día o número de experiencia.
- Eliminar o integrar campos antiguos que existen en el documento pero no aparecen en la página, sin perder compatibilidad con borradores publicados.
- Añadir una comprobación automatizada que detecte nuevos textos visibles no conectados al documento editable.
- Proteger títulos, botones y campos esenciales contra guardados vacíos; conservar deshacer para el resto.
- Señalar claramente placeholders pendientes antes de publicar.
- Mantener una edición terminada como un solo paso de deshacer/rehacer.

## 3. Formato inline y estilo por selección
Al seleccionar texto en escritorio, mostrar una barra contextual discreta con:
- color de texto;
- estilo semántico coherente: etiqueta, párrafo, subtítulo, título de sección o título principal;
- negrita y cursiva cuando el tipo de contenido lo permita;
- alineación;
- enlace;
- interlineado compacto, normal o amplio;
- restaurar el estilo heredado de la sección.

Para evitar diseños inconsistentes, los tamaños usarán niveles definidos, no valores numéricos libres. El formato se guardará por campo dentro del documento y se normalizarán documentos anteriores.

Al tocar el fondo de una sección, abrir ajustes contextuales de:
- fondo, color de títulos y color de texto;
- espaciado compacto, normal o amplio;
- alineación general;
- restaurar estilo general.

Las advertencias de contraste incluirán colores particulares de cada sección.

## 4. Imágenes más visuales
- Mantener el reemplazo tocando la imagen.
- Convertir el panel de imágenes en una galería de miniaturas con la sección y el uso de cada imagen.
- Permitir reemplazar y reencuadrar desde cada miniatura.
- Mantener textos alternativos y pies de foto editables directamente.

## 5. Organización de secciones
- Unificar el orden de **Contenido** y **Secciones** para que reflejen la página real.
- Mostrar portada y cierre en el navegador, identificándolos como obligatorios.
- Mantener arrastrar, subir/bajar y visibilidad con estados inequívocos.
- Al seleccionar una sección en la página, sincronizar y enfocar su bloque correspondiente en el panel.

## 6. Adaptación a cualquier pantalla
- Separar el tamaño real del editor del selector de vista escritorio/teléfono.
- Pantalla amplia: panel lateral y página lado a lado.
- Pantalla mediana: panel plegable y página aprovechando el ancho disponible.
- Pantalla pequeña: página a ancho completo y controles en una bandeja inferior.
- Dividir la barra superior en grupos estables para evitar que controles y título se superpongan.
- Hacer el marco de teléfono adaptable al espacio disponible sin perder su ancho visual de referencia.
- Calcular la altura útil según la barra real, evitando medidas rígidas que corten el contenido.
- Permitir ocultar o mostrar el panel con una sola acción.

## 7. Orden y legibilidad de la página
- Proteger todos los textos editables contra palabras largas y crecimiento horizontal.
- Hacer que títulos y párrafos crezcan verticalmente sin cubrir botones, imágenes ni secciones siguientes.
- Suavizar la escala de títulos entre tamaños de pantalla y limitarla según el ancho disponible.
- Rehacer la banda de datos del viaje para que sus columnas, divisores y espacios funcionen con cualquier ancho y cantidad de elementos.
- Revisar cada sección repetible —experiencias, itinerario, alojamiento, testimonios, preguntas y galería— en teléfono, tablet, portátil y escritorio.
- Mantener anchos de lectura, espacios y alineación coherentes aunque el contenido sea mucho más largo que el ejemplo.

## 8. Historial y seguridad de cambios
- Mostrar en deshacer/rehacer una descripción breve de la última acción cuando sea posible.
- Mejorar el historial publicado con fecha, autora y una identificación visual clara.
- Mantener borradores, versiones publicadas, restauración, autoguardado y comunicación con la vista previa bajo las reglas actuales.
- No cambiar la lógica de publicación ni permitir que el modo móvil introduzca ediciones accidentales.

## Implementación técnica
- Ampliar el documento de página con estilos tipográficos por ruta y ajustes de espaciado/alineación por sección; normalizar versiones antiguas.
- Centralizar el catálogo de campos editables, su tipo, si admite varias líneas, si es obligatorio y qué formato permite.
- Sustituir detecciones por nombre de ruta por metadatos explícitos del catálogo.
- Conservar todas las mutaciones mediante el historial central y los eventos de mismo origen entre editor y vista previa.
- Adaptar el editor mediante consultas del espacio disponible y dimensiones fluidas, sin vincular su disposición al dispositivo simulado.
- Añadir pruebas de cobertura de textos, documentos antiguos, formato, deshacer/rehacer y adaptación.

## Verificación
- Comprobar edición directa de cada familia de texto, incluida barra fija, pie, contacto, botones y listas.
- Verificar color, nivel de tamaño, negrita, cursiva, alineación, enlace, interlineado y restauración.
- Confirmar que los cambios se reflejan en panel, borrador, recarga, publicación y restauración de versiones.
- Probar textos vacíos, placeholders, palabras largas, párrafos extensos y títulos de varias líneas.
- Revisar el editor en 320, 375, 715, 768, 1024, 1280 y 1440 px sin solapamientos ni desplazamiento horizontal accidental.
- Revisar la página publicada en teléfono, tablet y escritorio.
- Confirmar que la vista móvil no ofrece edición y que menú, acordeones, enlaces y reserva funcionan.
- Validar contraste general y por sección, accesibilidad de teclado, tipos, pruebas y compilación final.

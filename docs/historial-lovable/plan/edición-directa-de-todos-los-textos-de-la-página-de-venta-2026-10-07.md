# Edición directa de todos los textos de la página de venta

## Objetivo
Permitir que la organizadora edite el contenido escrito directamente sobre la vista previa de escritorio: clic en cualquier texto, escribir en el mismo lugar y guardar, sin abrir un recuadro, campo flotante ni modal.

La vista móvil seguirá en modo visitante, sin edición, para comprobar fielmente navegación, preguntas frecuentes, enlaces y reserva.

## Experiencia de edición
- Al pasar el cursor, los textos editables tendrán una señal visual discreta sin alterar el diseño de la página publicada.
- Al hacer clic, el cursor aparecerá dentro del texto y se editará conservando su tipografía, tamaño, color, alineación y espacio real.
- Títulos y textos cortos: `Enter` guarda y `Esc` restaura el valor anterior.
- Párrafos y respuestas largas: `Enter` guarda, `Shift+Enter` crea una nueva línea y `Esc` restaura el valor anterior.
- Al hacer clic fuera, se guarda el cambio.
- Los botones y enlaces no navegarán mientras se esté editando su texto; fuera del modo edición conservarán su comportamiento normal.
- Cada edición terminada será un único paso de deshacer/rehacer, evitando guardar una entrada por cada tecla.

## Cobertura completa
- Portada: marca, destino, país, título, subtítulo, disponibilidad, fechas, duración, grupo, precio, moneda y botones.
- Navegación y datos rápidos: nombres de enlaces, etiquetas y valores visibles.
- Historia y experiencias: encabezados, párrafos, leyendas, títulos y descripciones.
- Incluye/no incluye, itinerario, alojamiento y galería.
- Anfitrionas, perfil de viajera e información práctica.
- Testimonios y preguntas frecuentes, tanto preguntas como respuestas.
- Reserva, cierre, barra fija y pie de página.
- Textos dentro de listas y elementos repetibles se editarán individualmente.
- Los números generados automáticamente —por ejemplo, orden de experiencia o número de día— seguirán siendo automáticos, no texto manual.

## Sincronización y seguridad
- La edición directa actualizará el mismo documento que usa el panel lateral; ambos permanecerán sincronizados.
- Los cambios pasarán por el historial existente para conservar deshacer, rehacer, autoguardado y restauración de versiones.
- Se mantendrá la comunicación de mismo origen entre la vista previa y el editor.
- Los placeholders seguirán siendo visibles antes de editar y se convertirán en texto normal al reemplazarlos.
- Al recibir una actualización externa mientras un texto está activo, no se pisará lo que la organizadora está escribiendo; se aplicará al cerrar la edición.

## Implementación técnica
- Reemplazar el clic que hoy abre el editor flotante por edición `contentEditable` dentro de cada `EditableText` de la vista previa.
- Enviar al editor principal eventos de inicio, confirmación y cancelación con la ruta del campo y su valor; confirmar solo al finalizar para crear un único checkpoint de historial.
- Mantener estado local durante la escritura para evitar que el re-render del iframe mueva el cursor o reemplace el contenido.
- Incorporar en `EditableText` los textos actualmente estáticos pero editables, incluidos moneda, valores rápidos, datos de reserva y etiquetas del pie/barra fija.
- Eliminar únicamente la interfaz flotante de edición de texto; conservar el selector actual para imágenes y el panel lateral como alternativa.
- Aplicar estilos de foco accesibles y discretos, con soporte de teclado y texto multilínea.

## Verificación
- Probar edición directa de un título, un párrafo, un botón, una FAQ y un elemento de lista.
- Confirmar `Enter`, `Shift+Enter`, `Esc`, clic fuera, deshacer y rehacer.
- Confirmar que el panel lateral, el borrador guardado y la recarga muestran exactamente el mismo contenido.
- Confirmar que botones, acordeones, navegación y barra de reserva funcionan normalmente fuera de la edición.
- Confirmar que la vista móvil y la página publicada no muestran controles de edición ni cambios visuales.
- Revisar escritorio y teléfono, validación de tipos y estado final de compilación.

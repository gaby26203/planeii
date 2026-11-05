# Franja promocional fija y opcional

## Objetivo
Convertir la franja inferior actual en un anuncio configurable —por ejemplo, para un precio Early Bird— que permanezca visible al desplazarse y se vea igual en editor, vista previa y página publicada.

## Cambios

### 1. Configuración del anuncio
Agregar en **Página → Anuncio fijo**:
- Interruptor **Mostrar anuncio**.
- Texto promocional editable.
- Texto del botón y URL propia del anuncio.
- Fecha y hora opcionales de inicio y finalización.
- Opción para mostrar una cuenta regresiva hasta la fecha límite.
- Vista clara del estado: inactivo, programado, activo o finalizado.

El interruptor será el control principal. Si además se configuran fechas, el anuncio solo aparecerá dentro de ese período; al vencer, se ocultará automáticamente.

### 2. Presentación y comportamiento
- Mantener la franja fija en la parte inferior mientras la viajera recorre la landing.
- Usar un contenido más limpio: mensaje promocional, fecha o cuenta regresiva y botón de acción.
- Añadir un botón de cierre con icono **X**.
- Al cerrarla, permanecerá oculta durante esa visita; una visita posterior podrá volver a verla si el anuncio sigue activo.
- Adaptar el contenido a móvil: sin texto cortado, con wrap entre palabras y controles accesibles.
- Evitar que la franja tape el final de la página, botones o contenido importante.

### 3. Edición visual
- Permitir editar el texto y la etiqueta del botón directamente desde el lienzo de escritorio.
- Al hacer clic en el botón dentro del editor, abrir su configuración sin navegar a la URL.
- Añadir en **Diseño** los controles de fondo, color de texto, color del botón, estilo y forma del botón.
- Mantener el comportamiento real del enlace en la vista previa para viajeros y en la página publicada.

### 4. Compatibilidad y persistencia
- Guardar la configuración dentro del documento versionado de la landing, junto al resto del borrador y de cada publicación.
- Normalizar documentos anteriores para que sigan funcionando. La franja conservará inicialmente el comportamiento visible actual hasta que la organizadora la desactive o reconfigure.
- Usar el mismo componente y las mismas reglas en editor, vista previa y publicación; solo los indicadores de edición serán exclusivos del editor.

## Validación
- Comprobar encendido/apagado manual, programación futura, período activo y fecha vencida.
- Comprobar cuenta regresiva y cierre temporal durante la visita.
- Verificar clic del botón en editor frente a vista de viajero/publicada.
- Revisar composición y ausencia de solapamientos en 1280, 715 y 390 px.
- Confirmar que borradores antiguos, autoguardado y publicación mantienen la configuración correctamente.

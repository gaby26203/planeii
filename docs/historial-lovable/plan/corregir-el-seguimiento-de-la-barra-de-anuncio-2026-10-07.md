# Corregir el seguimiento de la barra de anuncio

## Objetivo
La barra de anuncio debe aparecer desde el inicio y permanecer visible en la parte superior de la pantalla mientras se baja o se sube, tanto dentro del editor como en Vista previa y en la página publicada.

## Cambios
1. Reproducir el desplazamiento en las tres vistas y confirmar cuál es el contenedor que realmente se desplaza en cada una.
2. Separar la barra fija de su bloque inicial para que su posición no quede limitada por la sección donde se renderiza.
3. Mantener la barra anclada a la ventana o al lienzo visible correspondiente, conservando sus colores, textos, cuenta regresiva, botón y cierre.
4. Mantener una reserva dinámica de su altura para que no tape el menú, la portada ni los botones, incluyendo el cambio de altura en móvil.
5. Conservar el cierre por sesión y el comportamiento de edición actual.

## Verificación
- Probar al inicio, a mitad y al final de la landing, bajando y subiendo.
- Validar editor, Vista previa y página publicada.
- Revisar escritorio y móvil, comprobando que la barra siga visible y no cubra contenido.

## Detalles técnicos
La barra se desacoplará del contenedor de sección que puede crear límites de posicionamiento. La altura medida seguirá alimentando la separación superior del menú y del contenido, sin duplicar espacio ni provocar saltos.

# Colores independientes para el título del viaje

## Objetivo
Mantener el mismo texto del título del viaje en la portada y en el encabezado del formulario, pero permitir que cada ubicación tenga su propio color y formato.

## Cambios
- Separar la clave visual del título que aparece en el formulario de la clave visual usada en la portada.
- Conservar una sola fuente de contenido: si se cambia el texto del título, seguirá actualizándose en ambos lugares.
- Hacer que los cambios de color o formato aplicados directamente sobre el título del formulario afecten solo al formulario.
- Mantener independientes también los controles generales: el color de Portada seguirá afectando la landing y el color de la banda del viaje seguirá afectando el formulario.
- Comprobar en editor, vista previa y página publicada que ambos títulos muestran el mismo texto con colores diferentes.

## Detalle técnico
Actualmente ambas ubicaciones usan la misma ruta de contenido y la misma clave de estilo (`title`). El formulario conservará la ruta de contenido `title`, pero usará una clave de estilo propia para esa ubicación, siguiendo el patrón existente de texto compartido con formato independiente.

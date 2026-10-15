# Actualizar todas las páginas de venta y la plantilla nueva

## Objetivo
Llevar a Caripe, Tailandia y Catatumbo todos los cambios estructurales usados en Oaxaca, sin copiar textos, fotos, colores ni decisiones editoriales propias de Oaxaca. También dejar la plantilla neutra como fuente completa para cualquier página creada en el futuro.

Se activará el formulario interno en Caripe y Tailandia, según lo elegido, conservando el contenido y diseño propio de cada viaje.

## Cambios nuevos de hoy que deben quedar disponibles en todas las páginas

1. **Textos y estilos independientes por ubicación**
   - Separar el texto libre sobre el título de portada del título de la sección de reserva.
   - Mantener sincronizados título, marca, fechas, precio, moneda, cupos, etiquetas y listas compartidas, pero permitir colores y formato distintos donde aparecen: portada, banda de datos, reserva, formulario y pie.
   - Permitir que la lista “Incluye” tenga un estilo en su sección y otro en “Precio y reserva”.

2. **Controles de diseño por sección**
   - Organizar “Estilo por sección” como desplegables.
   - Abrir y resaltar automáticamente la sección correspondiente al seleccionar un botón o elemento en la vista.
   - Hacer que “Texto” cambie todo el texto de la sección, mientras el formato inline siga afectando solo la selección.
   - Agregar el color “Acento/Números” y hacer que checks y cruces hereden el color del texto asociado.

3. **Alineación completa**
   - Cuando una sección se centra, alinear en el mismo eje títulos, textos, listas y botones, incluida la portada.

4. **Botones y destinos**
   - Unificar el botón del menú para escritorio y móvil.
   - Mantener destinos independientes por botón: formulario interno, URL o sección.
   - Mantener estilo propio del CTA secundario de portada.

5. **Visual Stories**
   - No ampliar ni recortar imágenes por encima de su tamaño original.
   - Usar una sola cuadrícula continua sin huecos intermedios.
   - Mostrar todas las fotos al editar; para viajeras, mostrar seis y luego “Ver más fotos”.

6. **Ajustes para móvil**
   - Ocultar en móvil la línea divisora del cierre que solo corresponde al diseño de escritorio.
   - Conservar el encuadre móvil independiente de la portada cuando esté configurado.

7. **Formulario integrado**
   - Activar el formulario interno en Caripe y Tailandia usando una copia independiente de la plantilla base de Catatumbo.
   - Conservar textos y respuestas por viaje; ningún cambio posterior en Catatumbo debe propagarse a los demás.
   - Mantener el contenido compartido sincronizado con la landing, pero con colores y formato propios del formulario.

## Implementación

### 1. Proteger los documentos actuales
- Guardar una copia previa de los borradores de Caripe y Tailandia en los respaldos de páginas.
- No modificar el documento publicado de Oaxaca ni su marca `oaxaca-legacy`.
- No tocar contenido editorial: textos, fotos, itinerario, alojamientos, testimonios, colores y orden elegido por cada viaje se preservan.

### 2. Actualizar las páginas existentes
- Normalizar los borradores de Caripe y Tailandia contra la base neutra actual.
- Incorporar solo los campos estructurales ausentes y activar su formulario interno.
- Conservar Catatumbo, que ya usa formulario interno, y verificar que reciba los mismos comportamientos compartidos.
- Persistir los documentos actualizados para que editor, vista previa y próxima publicación usen la misma estructura.

### 3. Fortalecer la plantilla para viajes nuevos
- Separar las etiquetas genéricas de interfaz de cualquier copy propio de Oaxaca, evitando que nuevos campos puedan filtrarse desde la base legacy.
- Completar la plantilla neutra con todos los campos estructurales actuales: textos separados, estilos por ubicación, formulario interno independiente, botones, secciones y galería.
- Mantener la creación inicial alimentada por los datos reales del viaje: destino, país, fechas, duración, precio, moneda, capacidad e itinerario inicial.

### 4. Compatibilidad y verificación
- Agregar pruebas que confirmen que una página nueva no contiene contenido de Oaxaca y nace con formulario interno.
- Verificar que normalizar una página existente conserva su información y diseño, incorporando únicamente defaults estructurales ausentes.
- Comprobar Caripe, Tailandia, Catatumbo y Oaxaca en editor, vista de viajera y móvil.
- Confirmar que los botones de Caripe y Tailandia abren su propio formulario y que Visual Stories no deja huecos ni amplía imágenes.

## Resultado esperado
- Oaxaca conserva intacto su contenido y documento publicado.
- Caripe y Tailandia mantienen su identidad, reciben la estructura actual y pasan al formulario interno.
- Catatumbo conserva su configuración actual y comparte el mismo comportamiento visual.
- Toda página nueva nace desde una plantilla neutra completa, sin contenido heredado de otro viaje.

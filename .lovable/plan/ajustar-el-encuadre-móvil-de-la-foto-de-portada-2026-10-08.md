# Ajustar el encuadre móvil de la foto de portada

## Objetivo
Permitir elegir, arrastrando la misma foto, qué parte de la portada se ve en teléfonos. El ajuste será propio de cada landing y no cambiará el encuadre de escritorio.

## Experiencia de edición
- En la vista móvil del editor, agregar una acción clara **“Ajustar portada móvil”** junto al indicador de teléfono.
- Abrir un cuadro con un marco vertical que reproduce la portada en móvil.
- Permitir arrastrar la foto dentro del marco para centrar el rostro, paisaje u objeto importante.
- Incluir **Cancelar**, **Restablecer al centro** y **Guardar encuadre**.
- Mostrar el resultado inmediatamente en la vista móvil del editor.

## Resultado compartido
- Guardar la posición horizontal y vertical elegida dentro del documento de esa landing.
- Aplicarla únicamente en tamaños móviles mediante el posicionamiento de la imagen, sin crear otra copia ni reducir su calidad.
- Mantener el encuadre actual en escritorio.
- Usar exactamente el mismo encuadre móvil guardado en el editor, la vista previa para viajeras y la página publicada.
- Las páginas existentes que no tengan este ajuste seguirán centradas, por lo que Oaxaca y las demás landings no cambiarán visualmente hasta que se configure una posición.

## Detalles técnicos
- Ampliar los datos de la foto para aceptar una posición móvil opcional con coordenadas normalizadas; la lectura de documentos viejos añadirá el centro como valor seguro.
- Reutilizar la foto ya almacenada: el control modifica su foco mediante `object-position`, no hace un recorte destructivo.
- Crear un control de arrastre táctil y con mouse, limitado al área visible del marco móvil.
- Integrar el cambio con el historial, deshacer/rehacer y autoguardado existentes.
- Verificar el resultado en el lienzo móvil del editor y en una vista de viajera a 390 px, además de confirmar que escritorio permanece igual.

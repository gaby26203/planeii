# Vista del formulario dentro del editor

Viaje de prueba: **Relámpagos del Catatumbo**.

## Qué vas a ver
- Al tocar la pestaña **Formulario**, el lienzo de la derecha deja de mostrar la landing y muestra la **página del formulario** (/reservar) tal como la verá la viajera: cabecera del viaje, preguntas, privacidad y botón de envío, con los colores y tipografía de la landing.
- Cada cambio en el panel (agregar, ocultar, reordenar o editar preguntas) aparece en el lienzo al instante.
- Un selector arriba del lienzo: **Formulario | Página de gracias**, para ver y ajustar también la pantalla final.
- Funciona en escritorio y en vista teléfono.
- Al volver a Página, Diseño u Organización, el lienzo vuelve a la landing.
- En el editor el formulario no envía ni registra métricas; enviar está desactivado.
- Si el viaje está en modo "URL externa", se muestra un aviso: "El botón Reservar usa un enlace externo" con opción para cambiar a formulario de Planeii.

## Prueba con Relámpagos del Catatumbo
- Activar modo formulario de Planeii en su borrador, armar algunas preguntas y verificar vista en 1280 y 390 px.
- Publicar y hacer un envío de prueba en /v/<enlace>/reservar, confirmarlo en Solicitudes y luego borrar solo esa solicitud.

## Detalles técnicos
- Extraer el cuerpo de la página /reservar a un componente compartido (ApplyFormView) usado por la ruta pública y por el editor; un solo diseño, sin versión especial.
- Parámetro `mode: "live" | "editor"`: en editor no hay tracking ni fetch, y permite forzar la pantalla de gracias.
- TripEditor: cuando panel === "form", el lienzo renderiza ApplyFormView con el documento actual (docRef) en lugar de la landing; mismo contenedor y anchos de dispositivo.

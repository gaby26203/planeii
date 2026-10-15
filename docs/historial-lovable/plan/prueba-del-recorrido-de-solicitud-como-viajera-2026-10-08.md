# Prueba del recorrido de solicitud, como viajera

Probaré el recorrido completo en el viaje de prueba **Relámpagos del Catatumbo**, tal como lo haría una viajera, en escritorio y en teléfono. Después te entregaré un informe. No cambiaré nada de la página.

## Qué voy a probar

1. **Landing publicada**: abrir el enlace sin iniciar sesión. Revisar que cada botón de reserva (portada, menú, Qué incluye, itinerario, precio, cierre y barra promocional) lleve al formulario de ese mismo viaje. También revisar que el botón secundario baje a la sección correcta.
2. **Datos de campaña**: entrar con un enlace que tenga datos de campaña (`?utm_source=prueba`) y comprobar que esos datos lleguen hasta la solicitud.
3. **Página del formulario**: comprobar que use los colores, la tipografía y los textos editados, y que la banda de datos del viaje se muestre u oculte según lo que elegiste.
4. **Validaciones**: intentar enviar el formulario vacío, con un correo inválido o un WhatsApp sin código de país, y sin aceptar la casilla de privacidad. Revisar que los mensajes de error sean claros.
5. **Envío correcto**: completar todas las preguntas y enviar. Revisar que aparezca la página de gracias con su título, mensaje, próximos pasos y botón.
6. **Duplicados y límites**: enviar de nuevo con el mismo correo. Revisar que la solicitud se marque como duplicada y que los envíos repetidos se frenen.
7. **Panel de Solicitudes**: revisar que la solicitud aparezca como "Nueva" con sus respuestas y su origen. Probar el cambio de estado, una nota interna, el botón de WhatsApp y "Crear viajera".
8. **Métricas**: confirmar que se registraron la visita, el clic, el inicio del formulario y el envío.
9. **Teléfono**: repetir los pasos 1, 3 y 5 en tamaño de teléfono.

## Limpieza
Al terminar, borraré solo las solicitudes de prueba y, si la creé, la viajera de prueba, una por una. No tocaré ninguna solicitud real.

## Informe que vas a recibir
- Una lista de lo que funciona y lo que falla en cada paso.
- Los problemas ordenados por gravedad (bloquea a la viajera, molesta o detalle visual), con capturas.
- Una propuesta de arreglo para cada problema. No aplicaré ningún arreglo sin tu aprobación.

## Detalle técnico
Usaré Playwright contra la página publicada (`/v/<slug>` y `/v/<slug>/reservar`), con envío real a `/api/public/apply`. Revisaré `trip_applications`, `trip_application_events` y `trip_page_events` con consultas de solo lectura y borraré las filas de prueba filtrando por su id. Si Relámpagos no está publicado o su formulario está en modo de enlace externo, lo indicaré en el informe y pediré permiso antes de publicarlo.

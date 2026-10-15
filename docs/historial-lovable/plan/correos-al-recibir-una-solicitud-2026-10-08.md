# Correos al recibir una solicitud

## Qué va a pasar
Cuando una viajera envía el formulario de un viaje:
1. **Aviso a las organizadoras**: te llega un correo a vos y otro a la otra organizadora del viaje (la dueña del viaje y quienes tengan rol "organizadora" en ese viaje). Incluye nombre, WhatsApp (con botón para escribirle), correo, respuestas del formulario, de dónde llegó y un botón "Ver solicitud" que abre el panel Solicitudes.
2. **Confirmación a la viajera**: recibe "Recibimos tu solicitud para [viaje]" con los próximos pasos (los mismos de la página de gracias) y un botón para volver a la página del viaje.

Cada correo sale una sola vez por solicitud (si se reintenta, no se duplica). Si el envío del correo falla, la solicitud igual queda guardada.

## Requisito previo: dominio de envío
Para enviar correos se necesita un dominio propio (por ejemplo **chamaviaja.com**); los correos saldrán desde algo como `hola@chamaviaja.com`. Hay que configurarlo una vez con el botón de configuración de correo; mientras se verifica, todo queda listo y los correos empiezan a salir solos al terminar la verificación.

## Detalles a tener en cuenta
- Todo correo incluye al pie un enlace para darse de baja (es obligatorio y no se puede quitar).
- No se pueden adjuntar archivos; se usan enlaces.
- Los textos del correo serán en español, con la paleta de la marca (negro, beige, terracota) y fondo blanco.

## Detalles técnicos
- Configurar dominio, luego infraestructura de correos y scaffold de app emails.
- Dos plantillas nuevas: `application-received-organizer` y `application-received-traveler`, registradas en el registro de plantillas.
- En `/api/public/apply`, tras insertar la solicitud (y no si es honeypot/rate-limit), encolar envíos internamente con credenciales de servidor: una por organizadora (owner + `trip_members` rol organizadora, email desde `profiles`) y una a la viajera. Idempotencia: `app-<applicationId>-org-<userId>` y `app-<applicationId>-traveler`. Errores de envío se registran sin romper la respuesta.
- Página de baja con la marca en la ruta que indique el scaffold.
- Prueba: destinatarios = dueña + organizadoras, sin tour leaders ni duplicados.

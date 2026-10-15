# Funnel de Solicitudes por viaje

Landing → Formulario (/v/<viaje>/reservar) → Solicitud recibida → Seguimiento → Confirmada → Viajera

Dentro de Planeii el módulo se llama **Solicitudes**; "reserva" queda solo para la viajera en la URL y los botones.

## Fase 1 (esta implementación, en el orden de prioridad que pediste)

1. **Constructor del formulario** (pestaña "Formulario" en el editor de la página de venta)
   - Fijos: Nombre, WhatsApp con selector de código de país, Email.
   - Bloques agregables: texto corto, texto largo, opción única, selección múltiple, sí/no, fecha, **título/subtítulo** y **texto informativo**.
   - Por bloque: obligatoria, ocultar sin borrar, duplicar, eliminar, reordenar (arrastrar o flechas).
   - Casilla de **privacidad/uso de datos** con texto editable y enlace a tu política.
   - Modo del botón Reservar: **formulario de Planeii** o **URL externa** (Google Form sigue disponible por viaje).
   - Se guarda y publica junto con la landing (Publicar actualiza también el formulario).

2. **Página pública del formulario** `/v/<viaje>/reservar`
   - Hereda tipografía, colores, botones y marca de la landing.
   - Cabecera compacta: nombre del viaje, fechas, precio y lugares disponibles (si están en la banda de datos).
   - El formulario es el foco; validación clara y adaptada a móvil.

3. **Guardar solicitudes**: cada envío queda ligado al viaje, con sus respuestas, la versión de preguntas que vio, el consentimiento y el **origen**: página, fecha, utm_source / utm_medium / utm_campaign y sitio desde el que llegó (se conservan desde la landing hasta el envío).

4. **Panel Solicitudes** dentro del viaje (nueva pestaña)
   - Tabla: Nombre, WhatsApp, Email, Fecha, Estado, Origen/campaña; filtro por estado y búsqueda.
   - Etiqueta **"Posible duplicado"** cuando coincide email o WhatsApp con otra solicitud del mismo viaje (no bloquea el envío).
   - Detalle: todas las respuestas, notas internas, estado e historial básico (quién cambió qué y cuándo).

5. **Estados editables en cualquier momento**: Nueva, Contactada, En conversación, Llamada agendada, Pendiente de pago, Confirmada, No interesada, Descartada.

6. **Notas internas** por solicitud, con autora y fecha.

7. **WhatsApp**: botón "Escribir por WhatsApp" con número internacional correcto y **mensaje inicial configurable por viaje** con variables [Nombre] y [Viaje].

8. **Página de gracias** dentro del mismo funnel: título, mensaje, próximos pasos y CTA opcional (ej. "Escribirnos por WhatsApp"), todo editable.

9. **Métricas básicas**: se suman a las de la landing → visitas, clics en reservar, **formulario iniciado** (primer campo tocado; es simple de medir, entra ahora), enviados y confirmadas, con conversión landing→solicitud y solicitud→confirmada.

10. **Preparado para Confirmada → Viajera**: la solicitud guarda un vínculo opcional a la viajera. Al pasar a Confirmada aparece el botón **"Crear viajera"**, que copia nombre, WhatsApp y email a la lista de viajeras del viaje y deja ambos registros conectados (sin duplicar si ya existe).

Las respuestas solo se usan en su viaje; nunca se copian a otros.

## Fase 2 (lo dejaría para después)
- **Correo a las organizadoras** por cada solicitud: requiere dominio de correo propio verificado (hoy no hay ninguno). Los registros igual se guardan y se ven en el panel desde el día uno.
- Instrucciones/pago de reserva en la página de gracias y paso automático a "Pendiente de pago".
- Campos condicionales (mostrar una pregunta según otra respuesta) y subida de archivos.
- Exportar solicitudes a Excel y vista tipo tablero (columnas por estado).
- Fusionar duplicados con un clic.

## Detalles técnicos
- Configuración del formulario en el documento de la landing (`bookingForm`), versionada y normalizada como el resto; la base neutra y Oaxaca reciben un formulario por defecto sin contenido de otros viajes.
- Tablas nuevas: `trip_applications` (trip_id, page slug, datos básicos, answers jsonb, form snapshot, consent, utm/referrer, status, enrollee_id opcional, duplicate_of opcional), `trip_application_notes` y `trip_application_events` (historial). RLS: solo dueña u organizadoras del viaje; sin lectura anónima.
- Envío público por ruta de servidor bajo /api/public: valida contra el formulario publicado, límites de longitud, tasa y campo trampa anti-spam; inserta con credenciales del servidor. Duplicados se marcan al insertar.
- "Formulario iniciado" y "enviado" usan el mismo registro de eventos de métricas existente; solo /v/* registra.
- Crear viajera reutiliza la función de alta de viajeras existente y guarda el id en la solicitud.
- Verificación: envío de prueba, confirmar en panel y base, borrar solo esa fila; revisar 1280 / 390 px.

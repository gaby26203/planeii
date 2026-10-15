# Editar botones de acción con un clic en el editor

## Objetivo

En la vista de editor, hacer clic en un botón de acción (Reservar, Ver itinerario, etc.) ya no navega al enlace: abre la edición de ese botón. En la página publicada y en la vista de visitante, el clic sigue llevando al enlace como siempre.

## Qué se podrá editar al hacer clic en un botón

- **Color del botón** y **color del texto**.
- **Estilo:** relleno, solo contorno, o texto subrayado.
- **Forma:** esquinas rectas, redondeadas, o píldora.
- **URL:** muestra el enlace al que lleva en la página publicada y permite cambiarlo.

## Cómo funciona

1. **Clic en el botón dentro del editor** → se abre la sección "Botón" del panel lateral (mismo lugar donde hoy está "Estilo por sección"), con los controles de color, estilo, forma y el campo de URL. El botón queda marcado con un borde sutil para saber cuál se está editando.
2. **Sin navegación en el editor:** el clic nunca abre el enlace dentro de la vista de edición (hoy sí lo hace).
3. **Alcance del estilo:** color, estilo y forma se aplican a los botones de esa sección (igual que hoy con "Estilo por sección"). La URL de reserva es una sola para todo el viaje: cambiarla desde cualquier botón la actualiza en todos; el campo lo indica con una nota ("Este enlace se usa en todos los botones de reserva").
4. **Botón "Ver itinerario"** (el de contorno de la portada): muestra su destino (#itinerario) como referencia, editable también.
5. **Barra fija y menú superior:** sus botones también se pueden editar con clic; su estilo sigue el general de la página.

## Detalles técnicos

- `BookLink` (src/components/trip/shared.tsx): en modo editor, `onClick` hace `preventDefault` + `stopPropagation` y envía `postMessage` `trip-editor-button-click` con la sección correspondiente (mismo patrón que `trip-editor-image-click`).
- TripEditor recibe el mensaje, abre el panel en la pestaña Diseño → sección del botón y marca el botón activo.
- El campo URL edita `trip.bookingUrl` (ya existe en el panel como "Enlace de reserva"); se reutiliza ese campo dentro del editor de botón.
- El estilo usa las variables CSS por sección ya existentes (`--sbtn-*`); no se toca el tema de la aplicación.
- Sin cambios en la página publicada: allí los botones siguen siendo enlaces normales.

## Verificación

- Clic en cada botón dentro del editor: abre el panel, no navega.
- Cambiar color/estilo/forma y verlo reflejado al instante.
- Cambiar la URL y publicar: el botón lleva al nuevo enlace.
- Pantallas 1280 / 715 / 375 px, editor y publicada.

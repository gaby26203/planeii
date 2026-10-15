# Corregir la apertura de Vista previa

## Objetivo
Que **Vista previa** abra siempre los cambios actuales como los verá la viajera, aunque la página todavía no esté publicada y aunque el almacenamiento del navegador esté lleno.

## Cambios
- Reemplazar el snapshot guardado en el navegador por un snapshot temporal en Lovable Cloud, identificado con una clave única y asociado al viaje y a la organizadora.
- Al pulsar **Vista previa**, guardar primero una copia exacta del documento visible y abrir la nueva pestaña con esa clave; no depender del autoguardado ni de la versión publicada.
- Hacer que la vista de viajera cargue ese snapshot temporal, sin controles de edición y con enlaces, anuncio y cuenta regresiva funcionando normalmente.
- Mantener el mensaje de “vista previa no disponible” solo para enlaces inexistentes, vencidos o sin permiso; mostrar un aviso claro si el guardado falla.
- Eliminar automáticamente los snapshots temporales antiguos para que no se acumulen.

## Seguridad y compatibilidad
- Permitir crear y leer snapshots únicamente a integrantes autorizadas del viaje.
- Mantener intactos los borradores y las versiones publicadas existentes.
- Conservar la URL de vista previa con clave única, de modo que cada clic represente exactamente el estado de ese momento.

## Validación
- Probar con almacenamiento del navegador bloqueado o lleno.
- Confirmar que cambios sin publicar aparecen en la nueva pestaña.
- Confirmar que la vista no contiene edición y que botones, anuncio y cuenta regresiva funcionan.
- Verificar recarga, enlace inválido y apertura en computadora y móvil.

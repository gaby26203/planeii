# Arreglar Publicar y el enlace para la viajera

## Qué pasa hoy
Al tocar Publicar se abre primero "Antes de publicar". Su botón "Continuar a publicar" queda bloqueado hasta que todas las revisiones automáticas pasen y se marquen las tres casillas manuales, sin explicar por qué. Si falta un enlace de reserva válido o un contacto real, nunca se puede avanzar. Además la ventana final queda en "Cargando sesión…" si la sesión tarda, y algunos errores se ignoran sin aviso.

## Propuesta: publicar en 3 pasos dentro de una sola ventana
```text
[1 Revisar]  ->  [2 Elegir enlace]  ->  [3 Compartir]
```
- **Revisar**: resumen en tono amable ("Todo listo" o "2 detalles para mejorar"); cada detalle trae un botón que te lleva directo a corregirlo. Nunca bloquea.
- **Elegir enlace**: dirección sugerida y editable, con la vista completa del enlace y un aviso al instante si ya está en uso.
- **Compartir**: enlace grande con Copiar, WhatsApp y Abrir; una vista miniatura de la página publicada.
- **Ya publicada**: el botón pasa a "Actualizar página" y publica en un clic, sin repetir los pasos; aparece un aviso "Página actualizada" con el enlace.
- **Siempre visible**: junto al botón, un indicador "Publicada" o "Cambios sin publicar" con el enlace a mano.

## Cambios
1. **La lista previa avisa pero no bloquea**: las revisiones fallidas se muestran como advertencias con "Ir a corregir". "Publicar igual" queda siempre disponible y las casillas manuales pasan a ser opcionales.
2. **Ventana de publicación más clara**:
   - Sugiere la dirección automáticamente (ej. `/v/chile-mar-2026`) y la valida en vivo (disponible / en uso).
   - Muestra la dirección completa antes de publicar.
   - Muestra mensajes de error concretos en lugar de no hacer nada (sesión vencida, sin permiso, imágenes pesadas, conexión).
3. **Después de publicar**: enlace completo, botones Copiar, Abrir página y Compartir por WhatsApp, y la fecha de la última publicación.
4. **Estado en el editor**: junto a Publicar se muestra "Publicada · ver enlace" o "Cambios sin publicar". Cuando ya está publicada, el botón pasa a decir "Actualizar".
5. **Verificación de punta a punta**: publicar con la cuenta real, confirmar que se guarda la página y su historial, y que el enlace `/v/...` abre la landing para la viajera sin controles y registra la visita en Métricas.

## Detalles técnicos
- `PrePublishChecklist.tsx`: `ready` deja de deshabilitar el botón; los fallos se muestran como advertencias.
- `PublishDialog.tsx`: usar `supabase.auth.getUser()` con estado de error si no hay sesión; los errores de `select`/`insert`/`update` se muestran a la usuaria; el error de `recordPageVersion` también se avisa; consulta de disponibilidad de la dirección con debounce.
- Comprobar los permisos de `trip_pages` y `trip_page_versions` (insert/update del dueño, lectura pública por slug) y corregirlos con una migración si fallan.
- `TripEditor.tsx`: cargar el slug publicado para la etiqueta de estado y el botón "Actualizar".
- Probar con Playwright y la sesión de la usuaria: publicar y abrir `/v/<slug>`.

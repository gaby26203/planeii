# Paso 1: Oaxaca se independiza y todo lo demás usa la plantilla neutra

## Qué hay hoy
- **Oaxaca Me Encantas**: publicada, con todos sus datos propios guardados (textos, fotos, orden, colores, anuncio). No depende de la plantilla.
- **Caripe** y **Tailandia del mar a la montaña**: solo borrador, sin publicar. Sus datos del viaje son correctos (destino, fechas, precio, cupos), pero todo el contenido editorial vino de Oaxaca; por ejemplo, el título dice "Un viaje para entrar en Oaxaca, no solamente visitarla".

## Resultado
- Oaxaca queda exactamente igual.
- Caripe, Tailandia y todo viaje nuevo usan la plantilla neutra.
- El contenido de Oaxaca queda solo como respaldo interno de la página de Oaxaca; ningún otro viaje puede caer en él.

## Qué se conserva y qué se reemplaza en Caripe y Tailandia
La regla es simple: **se conserva lo que sale de la ficha del viaje; se reemplaza todo lo que escribió la plantilla.** No hace falta adivinar, porque esos borradores nunca se editaron a mano: todo lo que no es un dato del viaje es copia de Oaxaca.

**Se conserva (se toma de nuevo de la ficha del viaje, para que no quede nada desactualizado):**
- Destino
- Fechas (versión larga y corta) y duración calculada desde las fechas
- Precio y moneda
- Cupos (lugares disponibles y tamaño del grupo)
- Enlace de reserva, si se había cargado uno distinto al de ejemplo

**Se conserva del diseño (no es contenido de Oaxaca):**
- Paleta, tipografía, escala y forma de botones
- Orden de secciones y secciones ocultas
- Colores por sección, estilo de botones, etiquetas de la banda de datos
- Anuncio: queda apagado y con textos neutros

**Se reemplaza por placeholders neutros:**
- Título, subtítulo y descripción de la portada; fotos de portada y cierre
- Historia y su foto
- Experiencias, itinerario (mismo número de días según las fechas, con "Día N · Título del día"), alojamiento, anfitriona, testimonios, FAQ, galería, para quién es, qué incluye y qué no incluye
- Cierre: "Nos vemos en [destino]" con botón genérico
- Textos de etiquetas que nombran a Oaxaca

Antes de reemplazar, se muestra en el borrador si algún campo editorial fue editado a mano y no coincide con Oaxaca. Si aparece alguno, se conserva y te aviso.

## Pasos
1. **Copias de seguridad**: guardar el borrador actual de Caripe y de Tailandia, y una versión más de Oaxaca, en un respaldo aparte desde el que se pueden restaurar.
2. **Plantilla neutra**: textos genéricos y fotos vacías ("Agregá una foto"). Misma estructura y secciones que hoy.
3. **Respaldo solo para Oaxaca**: el contenido de Oaxaca queda asociado únicamente a su viaje. Cualquier otra página que tenga un dato faltante recibe el placeholder neutro.
4. **Migrar Caripe y Tailandia** con la regla de arriba.
5. **Verificar**: la página publicada de Oaxaca se ve igual antes y después; Caripe, Tailandia y un viaje nuevo no muestran ninguna palabra ni foto de Oaxaca.

## Riesgo para Oaxaca
Bajo. Su página no usa la plantilla para nada, sus fotos de fábrica se mantienen y tiene copia de seguridad. Sí cambian Caripe y Tailandia, que es lo pedido, y se pueden restaurar desde la copia.

## Detalles técnicos
- Nueva tabla de respaldo `trip_page_backups` (trip_id, document, reason, created_at), solo con acceso de miembros del viaje, con GRANT y RLS.
- `TRIP_DATA` pasa a `OAXACA_LEGACY_DATA`; nuevo `NEUTRAL_TRIP_DATA`. `normalizeEditorDocument(doc, tripId)` usa el respaldo legado solo cuando el trip es el de Oaxaca (id fijado en una constante), en cualquier otro caso usa la base neutra. Aplica a editor, vista previa, `/v/$slug`, snapshots y respaldo local.
- La migración de los 2 borradores se hace con una actualización de datos que reconstruye el documento: datos del viaje desde `trips` + diseño del borrador + base neutra. Se compara antes cada campo editorial con el de Oaxaca para detectar ediciones manuales.
- Registrar en AGENTS.md que el respaldo legado es exclusivo de Oaxaca y que todo lo demás se normaliza contra la base neutra.

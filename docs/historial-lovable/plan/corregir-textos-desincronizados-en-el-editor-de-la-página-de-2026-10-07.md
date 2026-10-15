# Corregir textos desincronizados en el editor de la página de venta

## Diagnóstico (confirmado con pruebas en el viaje Oaxaca)

La página publicada (`/v/oxacaedit`) se ve correcta en desktop, tablet y teléfono. El problema está en el **editor**: la vista previa muestra textos de la plantilla ("[NOMBRE DE LA MARCA]", "$[X,XXX]", título genérico) mientras el panel lateral muestra los textos reales del viaje.

Dos errores lo causan:

1. **El autoguardado pisa el borrador con la plantilla vacía.** Al abrir el editor, los textos reales se cargan en la pantalla, pero la copia interna que usa el autoguardado no se actualiza. A los ~1,5 segundos, el autoguardado guarda la plantilla vacía (en el dispositivo y en la nube), sobrescribiendo el contenido real. Confirmado: el borrador en la nube del viaje Oaxaca tiene el título genérico de la plantilla.
2. **La vista previa puede quedarse con datos viejos.** El cuadro de vista previa lee el borrador local viejo al abrirse, y si el primer mensaje del editor llega antes de que esté lista, nunca recibe los textos reales.

Además, el orden de carga actual prioriza el borrador local del dispositivo sobre la versión publicada, lo que hace que un borrador local contaminado tape el contenido publicado.

## Cambios

1. **Sincronizar la copia interna del autoguardado** (`TripEditor.tsx`): mantenerla siempre igual al documento visible, para que el autoguardado guarde lo que la organizadora ve, nunca la plantilla vacía.
2. **Orden de carga correcto**: borrador de la nube → versión publicada → borrador local del dispositivo (hoy el local pisa al publicado).
3. **La vista previa pide el documento al editor** (`TripPreview.tsx`): al abrirse envía una señal de "lista" y el editor responde con los textos actuales, eliminando la condición de carrera.
4. **Limpiar datos contaminados**: borrar el borrador en la nube del viaje Oaxaca (tiene la plantilla vacía) y revisar si otros viajes tienen borradores con el título genérico de la plantilla para limpiarlos igual. La versión publicada no se toca.

## Verificación

- `bunx tsgo --noEmit` limpio y build OK.
- Prueba con Playwright en el viaje Oaxaca: abrir el editor y confirmar que la vista previa muestra los mismos textos que el panel y la página publicada; recargar y confirmar que se mantiene; verificar que el borrador guardado en la nube tiene los textos reales.

## Detalles técnicos

- `TripEditor.tsx`: agregar `useEffect(() => { docRef.current = document; }, [document])`; cambiar `fallback` para preferir `publishedDocument` sobre `readDraft(localStorage)`; responder al mensaje `trip-editor-ready` con el documento actual.
- `TripPreview.tsx`: al montar, `window.parent.postMessage({ type: "trip-editor-ready" })`.
- SQL: `DELETE FROM trip_page_drafts` donde el documento tenga el título por defecto de la plantilla (borradores contaminados).

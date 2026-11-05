# Barra promocional persistente y compacta

## Objetivo
Convertir el anuncio actual en una barra inferior fija, visible desde que carga la landing y durante todo el recorrido, sin competir con la portada ni ocultar el cierre de la página. Se verá igual en vista previa de viajera y página publicada.

## Cambios

### 1. Presencia y cierre
- Mantener la barra fija en la parte inferior desde el primer render cuando el anuncio esté activo; no depender del scroll.
- Conservar la programación y la cuenta regresiva actuales.
- Mantener una X visible y accesible para cerrarla.
- Guardar el cierre en `sessionStorage`: no reaparece durante esa visita, pero vuelve en una visita futura.
- La clave de cierre seguirá vinculada al contenido y fecha final del anuncio, para que una campaña nueva pueda aparecer aunque se haya cerrado una anterior.

### 2. Composición compacta
- Desktop: mensaje promocional, cuenta regresiva opcional, CTA y X en una sola fila, con altura mínima y texto sin cortes.
- Mobile: composición compacta con mensaje de hasta dos líneas, sin reducir excesivamente la tipografía ni cortar palabras para forzarlo en una sola línea.
- El CTA y la X permanecerán siempre visibles, con ancho y área táctil suficientes. Si no caben limpiamente mensaje, cuenta regresiva, CTA y X, se priorizarán mensaje, CTA y X; la cuenta regresiva se abreviará o se ocultará solo en mobile.
- Agregar un texto móvil opcional dentro de la configuración del anuncio. Si queda vacío, se usa el mensaje general.
- Respetar `env(safe-area-inset-bottom)` para que la barra no choque con el área segura inferior del dispositivo.

### 3. Sin solapes ni saltos
- La barra permanecerá superpuesta en la parte inferior, fuera del flujo editorial, para que aparezca desde el inicio sin desplazar la portada.
- Reservar al final de la landing exactamente la altura real de la barra mediante una medida compartida, en vez de alturas fijas distintas por pantalla. Así el pie y los últimos botones podrán desplazarse completamente por encima de ella.
- La altura reservada se actualizará solo cuando cambie el contenido o el ancho, evitando saltos durante el scroll.
- La altura seguirá siendo dinámica según el contenido real, incluido el área segura inferior.
- Usar un nivel de superposición suficientemente alto para mantener la barra visible, pero inferior al de diálogos, menús y otros elementos que deban aparecer por encima.
- Mantener una capa visual contenida y discreta para que no compita con la portada.

### 4. Editor y compatibilidad
- Añadir en “Anuncio fijo” el campo “Texto breve para móvil”, junto a los controles actuales de mensaje, botón, URL, fechas y cuenta regresiva.
- Normalizar documentos anteriores para que sigan funcionando sin cambios manuales; el nuevo texto móvil será opcional.
- En el editor embebido conservar la edición inline y el clic de configuración; en Vista previa y publicada funcionarán el CTA y el cierre como para la viajera.

## Verificación
- Comprobar en 1280, 715 y 390 px que la barra aparece al cargar, permanece al hacer scroll y no corta textos.
- Comprobar en mobile mensajes de una y dos líneas, CTA y X siempre visibles, cuenta regresiva completa/simplificada/oculta según el espacio y área segura inferior simulada.
- Confirmar que el cierre persiste al recargar dentro de la misma sesión y reaparece en una sesión nueva.
- Verificar anuncio manual, programado, vencido y con cuenta regresiva.
- Confirmar que el último botón y el pie pueden quedar completamente visibles por encima de la barra.
- Comprobar paridad entre vista previa de viajera y página publicada, sin errores de compilación o ejecución.

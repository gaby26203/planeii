# Excluir al equipo organizador de las métricas

## Resultado
Las visitas y acciones futuras de la dueña del viaje y de quienes tengan rol de **organizadora** no se sumarán a las métricas cuando abran la página publicada con su sesión iniciada. Las viajeras y visitantes anónimas seguirán registrándose normalmente.

## Cambios
1. La página publicada enviará de forma segura la sesión vigente junto con cada evento de métricas, si la persona está conectada.
2. Antes de guardar una visita, clic o inicio de formulario, el sistema comprobará en el servidor si esa cuenta es la dueña del viaje o una organizadora asignada.
3. Si pertenece al equipo organizador, descartará el evento; si es una visitante o no inició sesión, lo guardará como hasta ahora.
4. La comprobación se hará para el viaje específico: ser organizadora de un viaje no excluirá visitas legítimas a otros viajes donde no tenga ese rol.

## Seguridad y compatibilidad
- La identidad se validará en el servidor; no se confiará en indicadores guardados en el navegador.
- La página seguirá funcionando y midiendo visitas aunque no exista una sesión.
- No se modificarán los datos históricos: las visitas anteriores no contienen identidad y no pueden separarse con precisión.

## Verificación
- Probar una visita anónima y confirmar que se registra.
- Probar como dueña y como organizadora del viaje y confirmar que no se registra ningún evento del recorrido.
- Probar una cuenta sin acceso a ese viaje y confirmar que sí se registra.
- Mantener pruebas automáticas para cada una de estas reglas.

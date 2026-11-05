# Demo guiada

La demo muestra PlanEII como plataforma, con Chama Viaja como organizadora. Se arma con **viajes
vitrina**, cuyas viajeras y solicitudes son ficticias, y se presenta en **modo presentación**, que
oculta todo lo demás (ver [secciones.md](secciones.md#modo-presentación)).

## Datos de ejemplo

`scripts/demo/` genera el SQL de dos viajes vitrina:

| Viaje | Landing | Viajeras | Solicitudes |
|---|---|---|---|
| Canaima y el Salto Ángel, 5 días | `/v/demo-canaima` | 8 con planes de 1 a 4 cuotas, pagos parciales | 4 |
| Altiplano: lagunas y salares, 8 días | `/v/demo-altiplano` | 5 con planes de 3 a 6 cuotas | 3 |

Qué incluye cada viaje:

- **Costos:** fijos, variables y de equipo, así se ve el punto de equilibrio y la utilidad.
- **Landing publicada:** con fotos de marca y formulario interno. Quedan ocultas las secciones que
  necesitan contenido real: experiencias, alojamiento, testimonios, anfitriona, perfil de viajera
  y preguntas frecuentes.
- **Métricas de 30 días:** visitas por país, dispositivo y origen; clics y formularios.

Las fechas se calculan desde el día en que se genera el SQL, así que los viajes siempre quedan en
el futuro. Las viajeras se inscriben con las mismas acciones del store que usa la app, así que las
cuotas y los cálculos financieros cuadran.

**Todo es de ejemplo.** Los correos usan `example.com` y los teléfonos el prefijo `+58 400`, que
no está asignado. Los viajes no son ofertas de Chama Viaja: cuando el cliente confirme qué viajes
mostrar, se reemplazan en `scripts/demo/data.ts`.

### Cargarlos

1. La cuenta que va a presentar tiene que existir y tener rol owner
   (`supabase/snippets/grant-owner.sql`).
2. Genera el SQL:

   ```bash
   bun run demo:sql --owner-email tu@correo.com > demo.sql
   ```

3. Pega `demo.sql` en el SQL Editor de Supabase y ejecútalo, o corre
   `psql "$DATABASE_URL" -f demo.sql`.

El script borra y vuelve a crear los viajes de la demo por su id fijo, así que se puede correr de
nuevo para actualizar fechas sin duplicar nada. Si la cuenta no existe, se detiene sin cambiar
nada.

### Borrarlos

```bash
bun run demo:sql --remove > borrar-demo.sql
```

Al ejecutarlo se borran los dos viajes. Sus páginas, solicitudes, métricas y membresías se van en
cascada.

## Guion

Un recorrido de unos 15 minutos. Antes de empezar, activa el modo presentación desde el menú de la
cuenta y confirma que el panel solo muestra los viajes con la etiqueta "Vitrina".

1. **Panel.** Los dos viajes con su portada, la ocupación de cupos, lo cobrado y el aviso de
   solicitudes nuevas.
2. **Costos del viaje** (Canaima). Costos fijos, variables y de equipo, el precio por persona y
   cuántas viajeras hacen falta para cubrir los costos.
3. **Viajeras.** Planes de cuotas, abonos registrados, saldo pendiente y el historial de cada
   inscripción.
4. **Resumen y simulador.** Qué pasa con la utilidad si se llenan los cupos o si sube un costo.
5. **Página de venta.** Abrir `/v/demo-canaima` como visitante: portada, itinerario, qué incluye
   y el botón de reserva.
6. **Formulario.** Enviar una solicitud de prueba con datos ficticios y ver cómo llega al panel
   de solicitudes del viaje.
7. **Editor.** Cambiar un texto o una foto de la landing, ver la vista previa y publicar.
8. **Métricas.** Visitas, origen del tráfico, dispositivos y clics en reservar de los últimos 30
   días.
9. **Cierre.** Volver al panel y mostrar el segundo viaje para dejar claro que cada viaje tiene
   su propio espacio.

Al terminar, sal del modo presentación. Si se envió una solicitud de prueba, bórrala desde el
panel de solicitudes o vuelve a cargar la demo.

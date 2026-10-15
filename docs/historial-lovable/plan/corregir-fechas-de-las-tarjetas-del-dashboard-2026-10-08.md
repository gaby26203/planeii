# Corregir fechas de las tarjetas del dashboard

## Diagnóstico

Las fechas de los viajes se guardan como texto `AAAA-MM-DD` (ej. `2026-10-15`), sin hora. En las tarjetas del dashboard, la función `formatDate` (src/routes/_authenticated/index.tsx:51) hace `new Date("2026-10-15")`, y JavaScript interpreta ese texto como **medianoche en UTC**. Como estás en Caracas (UTC-4), esa medianoche UTC corresponde a las 8 de la noche del **día anterior**, y la tarjeta muestra un día menos que el elegido dentro del viaje.

Revisé el resto de la app: la página del viaje y el editor ya convierten la fecha por partes (año, mes, día) y no tienen este problema. El único lugar afectado es la tarjeta del dashboard.

## Cambio

- En `formatDate` del dashboard, interpretar la fecha por partes (`año, mes-1, día`) en hora local, igual que ya hace la página del viaje. Así la tarjeta muestra exactamente la fecha elegida, sin importar la zona horaria de quien la mira.
- Sin cambios de datos ni de formato visual: solo se corrige el día mostrado.

## Verificación

- Confirmar que las tarjetas de Caripe, Tailandia y Oaxaca muestran las mismas fechas que aparecen dentro de cada viaje.
- Build sin errores.

# Métricas por landing de viaje

## Objetivo
Saber cuántas veces se abrió la landing de cada viaje, desde qué país, con qué dispositivo, de dónde llegó el visitante (Instagram, WhatsApp, Google, directo) y cuántos tocaron los botones de acción. Todo visible dentro de la app, sin datos personales de los visitantes.

## 1. Registro de visitas y clics
- Nueva tabla en la base de datos `trip_page_events`: una fila por evento con:
  - viaje (trip_id), tipo de evento (`view` = apertura de la landing, `click` = toque en botón de reserva o anuncio), fecha/hora
  - país (lo detecta el servidor automáticamente desde la conexión, sin pedir permisos al visitante)
  - dispositivo (celular / computadora, deducido del navegador)
  - origen (referrer simplificado: instagram, whatsapp, google, directo, otro)
- Inserción pública (cualquier visitante puede registrar su visita, sin sesión), lectura solo para integrantes del viaje. Sin nombre, sin IP, sin datos personales.
- La landing publicada registra automáticamente:
  - una `view` al cargar la página (una sola por carga, sin contar recargas internas del editor)
  - un `click` cuando se toca un botón de reserva o el botón del anuncio (con cuál botón fue)
- El editor y la vista previa de la organizadora **no** registran eventos, para no ensuciar los números.

## 2. Panel de métricas dentro de la app
- Nueva sección "Métricas" en la página del viaje (junto al editor de la landing), visible solo para la organizadora e integrantes:
  - Visitas totales y de los últimos 7 y 30 días
  - Visitantes por país (lista ordenada, con cantidad)
  - Clics en botones de reserva y del anuncio, con tasa simple (clics / visitas)
  - Dispositivos: % celular vs computadora
  - Origen de las visitas (Instagram, WhatsApp, Google, directo, otros)
  - Gráfico simple de visitas por día (últimos 30 días)
- Sin librerías pesadas: barras y números con los componentes visuales ya existentes.

## 3. Alcance y límites
- La ubicación es el país aproximado (a veces región), nunca la dirección exacta.
- Visitantes que repiten cuentan como visitas nuevas en cada apertura (no hay seguimiento individual).
- No se muestran métricas en la landing pública; solo dentro de la app.

## Detalles técnicos
- Migración: `CREATE TABLE public.trip_page_events` + GRANT (INSERT a `anon` y `authenticated`, SELECT solo `authenticated` vía política con `is_trip_member`/`is_trip_owner`) + RLS + índice por (trip_id, created_at).
- Endpoint: ruta de servidor `/api/public/track` (POST) que valida el payload con Zod, lee el país del header de la plataforma (`cf-ipcountry` o equivalente) e inserta con cliente publishable; la landing lo llama con `fetch` + `keepalive` al cargar y al hacer clic.
- Lectura: `createServerFn` con `requireSupabaseAuth` que agrega conteos por viaje (totales, por país, por dispositivo, por origen, por día) y alimenta el panel de Métricas.
- Detección de origen: `document.referrer` clasificado en el cliente (instagram.com, wa.me/whatsapp, google, vacío = directo).
- Verificación: cargar la landing publicada y hacer clic en un botón, confirmar que los eventos aparecen en el panel; comprobar que el editor y la vista previa no registran; build y typecheck limpios.

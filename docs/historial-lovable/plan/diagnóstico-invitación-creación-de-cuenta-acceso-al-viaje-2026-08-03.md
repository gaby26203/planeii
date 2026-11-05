# Diagnóstico: invitación → creación de cuenta → acceso al viaje

## 1. Cómo funciona hoy

- La organizadora principal (owner global) crea la invitación desde el viaje o desde Accesos. Se guarda una fila en `trip_invitations` con: viaje, email (en minúsculas), rol (`organizadora` / `tour_leader`), permisos opcionales, un `token` aleatorio, `status = pending` y `expires_at` a 7 días.
- No se envía email automático: el enlace `/invitacion/<token>` se comparte a mano.
- Al abrir el enlace, la pantalla de invitación pide sesión. Si no hay sesión: guarda el token en `sessionStorage` y manda a `/auth`.
- En `/auth`, tras entrar (email o Google), la app lee ese token de `sessionStorage` y vuelve a `/invitacion/<token>`. Ahí la persona pulsa "Aceptar invitación", y solo entonces el servidor: crea/actualiza su perfil, la inserta en `trip_members` con el rol y permisos de la invitación, marca la invitación como `accepted` (con `accepted_by`) y registra auditoría.
- Los permisos de pantalla se calculan desde `trip_members` (rol + permisos efectivos). El dashboard solo lista los viajes donde existe membresía.

Estado real en la base: las dos invitaciones reales quedaron `accepted` y sus membresías existen con permisos completos de organizadora. O sea, el mecanismo de fondo funciona; lo que falla es la continuidad del flujo de alta.

## 2. Comportamiento esperado

Abrir un enlace válido debe conservar la invitación durante todo el registro, dejar la invitación vinculada al `user_id`, pasarla a `accepted`, crear la membresía con rol Organizadora y llevar a la persona directo al viaje, sin mensajes de "esperá una invitación".

## 3. Dónde falla exactamente

El punto de quiebre no es la base de datos ni las políticas: es que **la aceptación depende de que la persona vuelva por sí misma a `/invitacion/<token>` y pulse un botón**, y el token vive únicamente en `sessionStorage` de esa pestaña.

Se rompe en cuatro puntos concretos:

1. **Registro con email + confirmación.** `signUp` no devuelve sesión cuando hay confirmación de email. La app muestra "Cuenta creada" y se queda ahí. El enlace de confirmación apunta a `/auth`, no a la invitación, y muchas veces se abre en otra pestaña, otro navegador o el teléfono: ahí `sessionStorage` está vacío, así que la app manda a `/`. La invitación sigue `pending`, no hay membresía, el dashboard aparece vacío.
2. **Login con Google.** El `redirect_uri` es el origen (`/`), no la invitación. Si el proveedor abre otra pestaña o se pierde el `sessionStorage`, tampoco se retoma el token.
3. **Aceptación manual.** Incluso volviendo bien, la invitación queda pendiente hasta que se pulse "Aceptar". Cualquier abandono deja la cuenta creada sin acceso.
4. **Mensajería confusa al quedar sin acceso.** En ese estado la persona ve el texto de `/auth` "El acceso al viaje se habilita solo con una invitación de la organizadora" o el dashboard vacío "Creá tu primer viaje" (sin botón, porque no es owner). De ahí la lectura "tengo que esperar a que me inviten", cuando en realidad la invitación existe y solo faltó cerrarla.

Además, cuando el email de registro no coincide con el invitado, el error correcto sí existe en el servidor, pero solo se ve si la persona llega a la pantalla de invitación; si aterriza en `/` nunca lo ve.

## 4. Causa confirmada

Persistencia frágil del contexto de invitación (solo `sessionStorage`) + redirecciones que no incluyen el token (`emailRedirectTo` y `redirect_uri` apuntan a `/auth` y `/`) + aceptación 100 % manual. No hay problema de RLS, GRANTs, rol asignado, duplicados ni de `has_role`.

## 5. Involucrados

- `src/routes/invitacion.$token.tsx` — pantalla de invitación, guarda el token, aceptación manual.
- `src/routes/auth.tsx` — signup/login, `emailRedirectTo`, `redirect_uri`, `redirectAfterAuth`, copy confuso.
- `src/lib/trip-invitations.functions.ts` — `lookupTripInvitation`, `acceptTripInvitation`.
- `src/routes/_authenticated/index.tsx` — estado vacío del dashboard.
- `src/lib/access.tsx`, `src/components/AccessGate.tsx` — permisos derivados de la membresía.
- Tablas: `trip_invitations`, `trip_members`, `profiles`, `trips`.

## 6. Solución recomendada (orden de trabajo)

1. **Token en la URL, no solo en la sesión del navegador.** `/invitacion/<token>` pasa el token a `/auth?invite=<token>`; `/auth` lo usa como fuente principal (y `sessionStorage` como respaldo). `emailRedirectTo` y el `redirect_uri` de Google apuntan a `/auth?invite=<token>` para que el retorno desde el correo o desde Google conserve la invitación en cualquier dispositivo.
2. **Prellenar y fijar el email invitado.** La pantalla de invitación muestra el email de la invitación y `/auth` llega con ese email prellenado, para evitar registros con otro correo.
3. **Aceptación automática al volver con sesión.** Si hay sesión, el token es válido y el email coincide, la invitación se acepta sola y se navega directo al viaje; solo se pide confirmación cuando hay algo que decidir (email distinto, expirada, revocada).
4. **Aceptar invitaciones pendientes por email al iniciar sesión.** Nueva función de servidor que, al entrar, busca invitaciones `pending` no vencidas para el email de la cuenta y las cierra. Esto arregla también a quien ya se registró y quedó colgada, sin tocar datos existentes.
5. **Mensajes claros en vez de "esperá una invitación".** Si el correo no coincide: indicar exactamente con qué correo debe entrar y ofrecer cambiar de cuenta. Si la cuenta no tiene ninguna invitación ni viaje: decir que su acceso todavía no fue habilitado y a quién escribir, nunca "creá tu primer viaje".
6. **Reglas de casos borde** (sin cambios de esquema): enlace reabierto o ya aceptado → si ya es miembro, entrar al viaje; expirada/revocada → mensaje con pedido de nuevo enlace; sin confirmar el correo → pantalla explícita de "confirmá tu email" y al confirmar se retoma la invitación; otro dispositivo → funciona porque el token viaja en la URL.

### Riesgos y compatibilidad

- Riesgo bajo: no se cambia el esquema ni las políticas; se conserva `acceptTripInvitation` tal cual y se añade el cierre automático por email.
- Las invitaciones y membresías actuales siguen válidas; las pendientes se cierran solas al siguiente inicio de sesión del invitado.
- Cuidado con la validación del email: la aceptación seguirá exigiendo coincidencia exacta (minúsculas) con el email de la cuenta, para no abrir acceso a terceros con el enlace.

## 7. Prueba final

Escenario completo a validar (sesión nueva / incógnito):

1. Crear invitación de Organizadora y copiar el enlace.
2. Abrir el enlace sin sesión → se ofrece crear cuenta con el email invitado, ya prellenado.
3. Crear la cuenta; si pide confirmación, confirmar el correo (incluso en otro navegador).
4. Al volver con sesión: la invitación pasa a `accepted`, con `accepted_by` = su `user_id`.
5. Aparece la membresía en `trip_members` con rol `organizadora` y sus permisos.
6. Entra directo al viaje, sin ver ningún mensaje de "esperá una invitación".
7. Ve solo las secciones autorizadas para Organizadora (sin páginas de owner).
8. Cierra sesión, vuelve a entrar y desde otro dispositivo: conserva el acceso.
9. Reabrir el enlace ya aceptado → entra al viaje, sin error.
10. Casos negativos: correo distinto → mensaje indicando el correo correcto; invitación vencida o revocada → mensaje pidiendo un enlace nuevo.

Se revisan además los logs de autenticación, de funciones de servidor y las filas de `access_audit_log` durante la prueba, y se deja una prueba automatizada del camino feliz.

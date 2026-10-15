# Migración fuera de Lovable

El código ya no depende de Lovable. Lo que falta es infraestructura propia y mover los datos.
Esta guía cubre las dos cosas.

## Qué se cambió en el código

| Antes (Lovable) | Ahora | Archivos |
|---|---|---|
| `@lovable.dev/vite-tanstack-config` | `vite.config.ts` explícito con los mismos plugins | `vite.config.ts` |
| `bun.lock` contra el registro npm privado de Lovable | Registro público de npm, mismas versiones e integridades | `bun.lock` |
| `package-lock.json` desincronizado | Eliminado; Bun es el único gestor | `package.json` |
| Google OAuth con `@lovable.dev/cloud-auth-js` (`/~oauth/initiate` del hosting de Lovable) | `supabase.auth.signInWithOAuth` | `src/routes/auth.tsx` |
| Sesión compartida con el iframe del editor de Lovable | `localStorage` estándar | `src/integrations/supabase/client.ts` |
| Correo con `@lovable.dev/email-js` y `LOVABLE_API_KEY` | Resend por HTTP | `src/lib/email-templates/send-email.ts` |
| Ruta `/lovable/email/transactional/preview` | `/api/dev/email-preview`, solo en desarrollo | `src/routes/api/dev/email-preview.ts` |
| AI Gateway de Lovable, modelo `openai/gpt-6-astra` | API compatible con OpenAI configurable | `src/lib/ai-gateway.server.ts` |
| Fotos de plantilla en el CDN de Lovable (`/__l5e/assets-v1/…`) | `public/template-assets/` y re-mapeo al leer documentos | `src/lib/template-assets.ts`, `src/lib/trip-assets.ts` |
| og:image fijo a `planeii.lovable.app` y a una captura en R2 | `VITE_PUBLIC_SITE_URL` | `src/lib/site-url.ts`, `src/routes/v.$slug.tsx` |
| Migraciones en `supabase/` y `drizzle/` con `LOVABLE_DB_MIGRATION_URL` | Todo en `supabase/migrations` | `supabase/migrations/` |
| Buckets, un GRANT y Realtime creados con herramientas de Lovable | Migración `20261015120000_self_hosting_storage_and_grants.sql` | `supabase/migrations/` |
| `.env` versionado con el proyecto de Lovable Cloud | `.env.example`; `.env` ignorado | `.env.example`, `.gitignore` |
| Planes en `.lovable/` | `docs/historial-lovable/` | |

Se eliminaron `@lovable.dev/cloud-auth-js`, `@lovable.dev/email-js`, `@lovable.dev/webhooks-js`
(sin uso), `@lovable.dev/vite-tanstack-config`, `@cloudflare/vite-plugin` (sin uso), `drizzle-kit`,
`drizzle-orm` y `postgres`.

Mientras dure la transición, no sigas editando en Lovable: regenera archivos marcados como
"auto-generated" y volvería a introducir sus dependencias.

## Puesta en marcha

### 1. Proyecto Supabase

1. Creá un proyecto en https://supabase.com.
2. Vinculalo y aplicá las migraciones:

   ```bash
   bunx supabase login
   bunx supabase link --project-ref <ref>
   bun run db:push
   ```

3. Regenerá los tipos para confirmar que no hay diferencias:

   ```bash
   bun run db:types
   git diff src/integrations/supabase/types.ts
   ```

### 2. Auth

En el panel de Supabase, sección Authentication:

1. **URL Configuration.** Site URL con el dominio de producción. Redirect URLs:
   `https://<dominio>/auth**`, `https://<dominio>/reset-password` y `http://localhost:8080/**`.
   Si una URL falta, Supabase vuelve al Site URL y se pierde el parámetro `?invite`.
2. **Confirmación de email activa.** La aceptación de invitaciones confía en el email del JWT.
3. **Google.** En Google Cloud creá un OAuth Client de tipo Web con redirect
   `https://<ref>.supabase.co/auth/v1/callback`. Cargá el client ID y el secret en
   Providers → Google.
4. **SMTP propio.** El SMTP por defecto de Supabase tiene un límite muy bajo. Configurá el SMTP
   de Resend para los correos de confirmación y recuperación.

### 3. Datos

Los usuarios, viajes y archivos actuales están en el proyecto Supabase gestionado por Lovable
Cloud. Hay dos caminos; el primero es el único que conserva contraseñas e ids.

**A. Copia directa de la base (recomendado).** La configuración anterior de Drizzle leía una
cadena de conexión `LOVABLE_DB_MIGRATION_URL`, así que Lovable tiene acceso directo a Postgres.
Si podés obtener esa cadena (o una exportación) desde Lovable o su soporte:

```bash
# Datos de la app, sin esquema (el esquema ya lo crearon las migraciones)
pg_dump "$ORIGEN" --data-only --schema=public --no-owner -f public.sql
# Usuarios con sus contraseñas e identidades de Google
pg_dump "$ORIGEN" --data-only --table=auth.users --table=auth.identities --no-owner -f auth.sql

psql "$DESTINO" -f auth.sql                         # el trigger crea un perfil por usuario
psql "$DESTINO" -c "delete from public.profiles"    # se reemplazan por los del volcado
psql "$DESTINO" -f public.sql
```

Notas para esa carga:

- Si la versión de Supabase Auth difiere entre proyectos, `auth.identities` puede tener columnas
  distintas; en ese caso volcá con `--column-inserts` y ajustá las columnas.
- `trip_applications.duplicate_of` apunta a la misma tabla; si falla, cargá en dos pasadas.
- Revisá los privilegios por defecto del proyecto nuevo contra los del original.

**B. Sin acceso directo.** Sin las contraseñas, cada persona tendría que registrarse de nuevo y
los ids de usuario cambiarían. Habría que reasignar `trips.owner_id`, `trip_members.user_id`,
las rutas de Storage que llevan el uid y demás referencias. Este camino necesita un script de
reasignación que no está incluido.

**Archivos de Storage.** Hay que copiar los objetos de los tres buckets manteniendo las mismas
rutas, porque llevan dentro el uid y el id del viaje. Con la clave de service role de ambos
proyectos se puede hacer con la API de Storage (listar, descargar, subir).

**Primer owner.** Si arrancás sin datos, registrate en la app y ejecutá
`supabase/snippets/grant-owner.sql` con tu email en el SQL editor. Sin esa fila nadie puede
crear viajes.

### 4. Fotos de la plantilla de Oaxaca

Desde una máquina con acceso a la app publicada en Lovable:

```bash
bun run assets:download
git add public/template-assets && git commit -m "Agregar fotos de la plantilla de Oaxaca"
```

Si la app ya no está publicada, copiá las ocho fotos a mano en `public/template-assets/` con los
nombres de `scripts/lovable-assets/*.asset.json`.

### 5. Correo con Resend

1. Verificá el dominio en Resend (SPF y DKIM). Antes, `notify.chamaviaja.com` estaba delegado a
   los nameservers de Lovable: quitá esa delegación.
2. Definí `RESEND_API_KEY` y `EMAIL_FROM`, por ejemplo `PLANEI OS <noreply@chamaviaja.com>`.
3. Revisá las plantillas en `http://localhost:8080/api/dev/email-preview`.

Lovable gestionaba una lista de supresión y el enlace de baja. Resend tiene su propia lista de
supresión; el enlace de baja no se agrega solo.

### 6. IA

Definí `AI_API_KEY` y `AI_MODEL`. Con OpenAI directo, `AI_BASE_URL` queda vacío. El código usa la
Responses API con opciones de razonamiento propias de OpenAI; con otro proveedor, confirmá que
soporte la Responses API y la salida con JSON schema.

### 7. Cloudflare Workers

```bash
bunx wrangler login
# Secretos del Worker (no viajan en el build)
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put AI_API_KEY
# Las VITE_* se leen de .env al compilar; el resto, como vars del Worker
bun run deploy
```

Variables de servidor que también tiene que tener el Worker: `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `EMAIL_FROM`, `AI_MODEL` y, si aplica, `AI_BASE_URL` y
`EMAIL_REPLY_TO`. Se pueden cargar como vars en el panel de Cloudflare o en `wrangler.jsonc`.
Después asigná el dominio propio al Worker.

### 8. Comprobación final

- [ ] Registro con email, confirmación y login.
- [ ] Login con Google vuelve a `/auth` y entra.
- [ ] Recuperación de contraseña.
- [ ] Crear un viaje, agregar una viajera y registrar un pago; recargar y ver que persiste.
- [ ] Subir portada, documento y adjunto de viajera.
- [ ] Invitar a otra cuenta y aceptar la invitación.
- [ ] Editar la página de venta, vista previa y publicar.
- [ ] Abrir `/v/<slug>` en incógnito: fotos, og:image y botones.
- [ ] Enviar el formulario: llega la solicitud y los dos correos.
- [ ] Ver la visita en Métricas.
- [ ] Generar textos con IA.
- [ ] Exportar PDF y Excel.

### 9. Corte

1. Apuntá el dominio al Worker nuevo.
2. Despublicá la app en Lovable para que nadie siga escribiendo en la base vieja.
3. Si hubo actividad entre la copia de datos y el corte, repetí la copia de datos antes de abrir.

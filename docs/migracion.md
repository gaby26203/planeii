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

1. Crea un proyecto en https://supabase.com.
2. Vincúlalo y aplica las migraciones:

   ```bash
   bunx supabase login
   bunx supabase link --project-ref <ref>
   bun run db:push
   ```

3. Regenera los tipos para confirmar que no hay diferencias:

   ```bash
   bun run db:types
   git diff src/integrations/supabase/types.ts
   ```

### 2. Auth

En el panel de Supabase, sección Authentication:

1. **URL Configuration.** Site URL con el dominio de producción. Redirect URLs:
   `https://<dominio>/auth**`, `https://<dominio>/reset-password` y `http://localhost:8080/**`.
   Si una URL falta, Supabase vuelve al Site URL y se pierde el parámetro `?invite`.
2. **Confirmación de email activa.** Las invitaciones solo se aceptan con el email confirmado de
   la cuenta; sin confirmación, nadie que se registre podría aceptarlas.
3. **Google.** En Google Cloud crea un OAuth Client de tipo Web con redirect
   `https://<ref>.supabase.co/auth/v1/callback`. Carga el client ID y el secret en
   Providers → Google.
4. **SMTP propio.** El SMTP por defecto de Supabase tiene un límite muy bajo. Configura el SMTP
   de Resend para los correos de confirmación y recuperación.

### 3. Datos

Los usuarios, viajes y archivos actuales están en el proyecto Supabase gestionado por Lovable
Cloud.

**A. Exportación oficial de Lovable (recomendado).** Según guías publicadas en 2026, Lovable
ofrece en Cloud → Overview → Advanced settings la opción "Export project data". Genera un volcado
de la base con esquema, filas, políticas RLS, funciones, triggers y usuarios de Auth. No incluye
archivos de Storage, secretos ni la configuración de proveedores de login. Las guías mencionan un
límite de 5 GB y una exportación por día. Fuentes:
[carolmonroe.com](https://carolmonroe.com/blog/lovable-cloud-migration),
[lovable2live.com](https://lovable2live.com/cloud-to-supabase/),
[CarolMonroe22/lovable-cloud-to-supabase-migration](https://github.com/CarolMonroe22/lovable-cloud-to-supabase-migration).
Verifícalo en la documentación de Lovable antes de planificar.

Como ese volcado refleja el estado real de la base, incluido lo que se hizo fuera de los archivos
de migración, conviene restaurarlo completo en el proyecto nuevo en lugar de correr las
migraciones desde cero:

```bash
psql "$DESTINO" -f volcado-lovable.sql
# La migración nueva es idempotente: crea solo lo que falte
psql "$DESTINO" -f supabase/migrations/20261015120000_self_hosting_storage_and_grants.sql
# Marca todas las migraciones como aplicadas para que `supabase db push` no las repita
for f in supabase/migrations/*.sql; do
  bunx supabase migration repair --status applied "$(basename "$f" | cut -d_ -f1)"
done
bun run db:types && git diff src/integrations/supabase/types.ts   # debería no cambiar nada
```

Las fuentes no coinciden en si las contraseñas sobreviven a la exportación. Planifica con la
posibilidad de que cada persona tenga que restablecer su contraseña después del corte; quien entra
con Google no se ve afectada.

**B. Copia directa con `pg_dump`.** Si Lovable o su soporte te dan una cadena de conexión a
Postgres, puedes volcar solo los datos sobre un proyecto con las migraciones ya aplicadas:

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
  distintas; en ese caso vuelca con `--column-inserts` y ajusta las columnas.
- `trip_applications.duplicate_of` apunta a la misma tabla; si falla, carga en dos pasadas.
- Revisa los privilegios por defecto del proyecto nuevo contra los del original.

**C. Sin exportación.** Sin las contraseñas, cada persona tendría que registrarse de nuevo y
los ids de usuario cambiarían. Habría que reasignar `trips.owner_id`, `trip_members.user_id`,
las rutas de Storage que llevan el uid y demás referencias. Este camino necesita un script de
reasignación que no está incluido.

**Archivos de Storage.** Ningún volcado trae los archivos. Los objetos de `trip-covers`,
`trip-notes-docs` y `trip-page-images` se copian con `scripts/migrate-storage.ts`, que mantiene las
mismas rutas (llevan dentro el uid y el id del viaje), el tipo de contenido y el `cacheControl`.
Después, `scripts/verify-migration.ts` confirma que llegó todo. Los dos usan la URL y la clave
service role de cada proyecto (Project Settings → API keys). Esas claves saltan RLS: guárdalas en
un archivo local que git ignora, por ejemplo `.env.migracion`, y no en `.env`:

```bash
SOURCE_SUPABASE_URL=https://<ref de Lovable Cloud>.supabase.co
SOURCE_SERVICE_ROLE_KEY=<service role del origen>
TARGET_SUPABASE_URL=https://<ref nuevo>.supabase.co
TARGET_SERVICE_ROLE_KEY=<service role del destino>
```

```bash
bun --env-file=.env.migracion run migrate:storage --dry-run   # lista qué copiaría, sin escribir
bun --env-file=.env.migracion run migrate:storage             # copia
bun --env-file=.env.migracion run migrate:verify              # compara origen y destino
```

`migrate:storage` recorre todas las carpetas de cada bucket, copia 4 objetos a la vez
(`--concurrency=N` lo cambia) y salta lo que ya está en el destino con la misma ruta y el mismo
tamaño. Por eso puedes interrumpirlo y volver a correrlo: sigue donde quedó. Comparar por tamaño
basta porque la app nunca reescribe una ruta: cada subida usa un nombre nuevo. Al final imprime,
por bucket, cuántos objetos copió, saltó y fallaron, con la ruta y el motivo de cada fallo, y sale
con código 1 si algo falló.

`migrate:verify` cuenta las filas de cada tabla de `public` y los objetos de cada bucket en los dos
proyectos, y sale con código 1 si algo difiere. En los buckets agrega la columna "Por copiar": lo
que `migrate:storage` todavía copiaría. Tiene que dar 0 aunque los conteos coincidan.

Orden el día del corte:

1. Despublica la app en Lovable para que nadie siga escribiendo en el origen (paso 1 del
   [corte](#9-corte)). Si el origen cambia durante la copia, los conteos no van a coincidir.
2. Restaura el volcado en el destino (opción A o B). La migración
   `20261015120000_self_hosting_storage_and_grants.sql` tiene que quedar aplicada: crea los buckets.
3. `migrate:storage --dry-run`: revisa cuántos objetos va a copiar y que no falte ningún bucket.
4. `migrate:storage`, hasta que el resumen diga "Todo copiado.".
5. `migrate:verify`, hasta que diga "Todo coincide.". Solo entonces apunta el dominio al Worker
   nuevo.

Con la opción B puedes correr el paso 4 unos días antes, porque ese volcado no toca Storage: el día
del corte solo se copia lo que se subió después. Con la opción A, copia después de la restauración
final. Si ese volcado incluye el esquema `storage`, trae las filas de `storage.objects` sin los
archivos; el script las reconoce (mismo id y misma fecha que en el origen) y sube esos archivos de
todos modos.

Las copias quedan sin `owner` en `storage.objects`, porque las sube la service role. No afecta: las
políticas de Storage de la app miran la ruta, no el `owner`.

Si algo falla:

| Mensaje o diferencia | Qué hacer |
|---|---|
| El bucket no existe en el destino | Aplica la migración del paso 2 con `psql "$DESTINO" -f supabase/migrations/20261015120000_self_hosting_storage_and_grants.sql` y vuelve a correr. |
| No se pudo leer la lista de buckets, o `HTTP 401` / `HTTP 403` | La URL o la clave están mal. Tiene que ser la service role (`service_role` o `sb_secret_…`), no la anon ni la publishable. |
| Un objeto falla al descargar o subir por red o tiempo de espera | Vuelve a correr `migrate:storage`: salta lo ya copiado y reintenta solo lo pendiente. |
| El destino rechaza un objeto por tipo o tamaño | Puede que en Lovable el bucket aceptara más que la migración (5 MB y JPG, PNG o WebP en portadas y fotos de landing; 25 MB en documentos). Amplía ese bucket en el panel (Storage, menú del bucket, Edit bucket) y vuelve a correr. |
| Una tabla tiene menos filas en el destino | La restauración falló en esa tabla: busca su error en la salida de `psql`, por ejemplo `trip_applications.duplicate_of`, y vuelve a cargarla. O el origen recibió filas después del volcado: repítelo. |
| Una tabla tiene más filas en el destino | Alguien escribió en el destino, por ejemplo con `SMOKE_WRITE=1`, o se borraron filas en el origen después del volcado. |
| `trip_page_preview_snapshots` tiene menos filas en el destino | Cada inserción en esa tabla borra las vistas previas vencidas, y la restauración también inserta. No afecta. |
| "sin conteo… ¿existe la tabla?" | Falta la tabla en el destino: no se aplicaron todas las migraciones. |
| Un bucket con objetos "por copiar" | Vuelve a correr `migrate:storage`. |

**Primer owner.** Si arrancas sin datos, regístrate en la app y ejecuta
`supabase/snippets/grant-owner.sql` con tu email en el SQL editor. Sin esa fila nadie puede
crear viajes.

### 4. Fotos de la plantilla de Oaxaca

Desde una máquina con acceso a la app publicada en Lovable:

```bash
bun run assets:download
git add public/template-assets && git commit -m "Agregar fotos de la plantilla de Oaxaca"
```

Si la app ya no está publicada, copia las ocho fotos a mano en `public/template-assets/` con los
nombres de `scripts/lovable-assets/*.asset.json`.

### 5. Correo con Resend

1. Verifica el dominio en Resend (SPF y DKIM). Antes, `notify.chamaviaja.com` estaba delegado a
   los nameservers de Lovable: quita esa delegación.
2. Define `RESEND_API_KEY` y `EMAIL_FROM`, por ejemplo `PLANEI OS <noreply@chamaviaja.com>`.
3. Revisa las plantillas en `http://localhost:8080/api/dev/email-preview`.

Lovable gestionaba una lista de supresión y el enlace de baja. Resend tiene su propia lista de
supresión; el enlace de baja no se agrega solo.

### 6. IA

Define `AI_API_KEY` y `AI_MODEL`. Con OpenAI directo, `AI_BASE_URL` queda vacío. El código usa la
Responses API con opciones de razonamiento propias de OpenAI; con otro proveedor, confirma que
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
Después asigna el dominio propio al Worker.

### 8. Comprobación final

Una parte de la lista es automática y se corre contra el despliegue, desde tu máquina o desde
GitHub (Actions → Comprobar despliegue → Run workflow; el botón aparece cuando el workflow está
en la rama principal):

```bash
SMOKE_BASE_URL=https://<dominio> \
SMOKE_EMAIL=<cuenta de prueba> SMOKE_PASSWORD=<contraseña> \
SMOKE_SLUG=<landing de prueba> SMOKE_WRITE=1 \
bun run smoke
```

Antes de la primera corrida, prepara en el proyecto nuevo:

- **Cuenta de prueba** con rol owner (`supabase/snippets/grant-owner.sql`) y al menos un viaje.
  En GitHub, sus datos van como secretos `SMOKE_EMAIL` y `SMOKE_PASSWORD`.
- **Landing de prueba** publicada, con formulario interno y sin preguntas obligatorias propias.
  Su slug va en `SMOKE_SLUG`.

| Variables definidas | Qué comprueba | Escribe datos |
|---|---|---|
| Solo `SMOKE_BASE_URL` | Ingreso; rutas internas piden sesión; fotos de marca; la API pública valida y llega a la base; landing inexistente; vista previa de correos cerrada; og:image con la URL pública | No |
| Más `SMOKE_SLUG` | La landing de prueba carga sin imágenes rotas, con og:image; la página de reserva carga | No |
| Más `SMOKE_EMAIL` y `SMOKE_PASSWORD` | Login; el panel carga los viajes; abrir un viaje, su editor de página de venta y sus métricas | No |
| Más `SMOKE_WRITE=1` | Crear un viaje con portada de la galería y recargar; un guardado fallido muestra el aviso y se guarda al reintentar; subir una portada al storage y quitarla; mandar el viaje a la papelera y eliminarlo; enviar una solicitud a la landing de prueba | Sí, y lo borra salvo la solicitud |

Las corridas no suman visitas a las métricas: bloquean `/api/public/track`. Si una prueba de
escritura falla a la mitad, el viaje `[prueba] …` queda en el panel y hay que borrarlo a mano. La
solicitud enviada queda en la landing de prueba y dispara los dos correos reales.

El resto se revisa a mano:

- [ ] Registro con email y confirmación.
- [ ] Login con Google vuelve a `/auth` y entra.
- [ ] Recuperación de contraseña.
- [ ] Agregar una viajera y registrar un pago; recargar y ver que persiste.
- [ ] Subir un documento y un adjunto de viajera.
- [ ] Invitar a otra cuenta y aceptar la invitación.
- [ ] Editar la página de venta, vista previa y publicar.
- [ ] Llegan los dos correos de la solicitud de prueba.
- [ ] Una visita real aparece en Métricas.
- [ ] Generar textos con IA.
- [ ] Exportar PDF y Excel.

### 9. Corte

1. Despublica la app en Lovable para que nadie siga escribiendo en la base vieja.
2. Si hubo actividad desde la última copia, repítela como dice la [sección 3](#3-datos): volcado,
   `migrate:storage` (solo copia lo nuevo) y `migrate:verify`.
3. Apunta el dominio al Worker nuevo.

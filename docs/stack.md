# Stack técnico

Versiones instaladas según `bun.lock` a octubre de 2026.

## Aplicación

| Capa | Tecnología | Versión | Uso |
|---|---|---|---|
| Framework | TanStack Start | 1.168 | SSR, server functions, rutas API |
| Router | TanStack Router | 1.170 | Rutas por archivo en `src/routes`, árbol generado en `src/routeTree.gen.ts` |
| UI | React | 19.2 | |
| Estado del viaje | Zustand | 5.0 | `src/lib/trips-store.ts`, caché en memoria de `trips.data` |
| Datos remotos | TanStack Query | 5.99 | Notas, tareas, documentos, solicitudes |
| Estilos | Tailwind CSS | 4.2 | Con `lightningcss`; tokens en `src/styles.css` |
| Componentes | shadcn/ui sobre Radix | 46 componentes | `src/components/ui` |
| Texto enriquecido | Tiptap | 3.28 | Notas, notas de costo y edición en línea de la landing |
| Formularios | react-hook-form + zod | 7.71 / 3.25 | Validación también en server functions |
| Gráficos | Recharts | 2.15 | Métricas y finanzas |
| Arrastrar y soltar | dnd-kit | 6.3 | Orden de tareas, notas y secciones |
| Animación | framer-motion | 12.38 | |
| Exportación | jsPDF + autotable, SheetJS (xlsx) | 4.2 / 0.18 | PDF y Excel del viaje, en el servidor |
| Correo | React Email + Resend (HTTP) | 2.1 | Plantillas en `src/lib/email-templates` |
| IA | AI SDK + `@ai-sdk/openai` | 7.0 / 4.0 | Responses API de OpenAI o compatible |

## Backend y plataforma

| Pieza | Tecnología | Detalle |
|---|---|---|
| Runtime | Cloudflare Workers | `nodejs_compat`, fecha de compatibilidad 2025-09-24, nombre `planeii` |
| Empaquetado del servidor | Nitro 3 (beta) | Preset `cloudflare-module`, salida en `.output/` |
| Base de datos | Supabase Postgres | 19 tablas con RLS, esquema `private` con funciones de membresía |
| Autenticación | Supabase Auth | Email y contraseña, Google OAuth, sesión en `localStorage` |
| Archivos | Supabase Storage | 3 buckets privados |
| Tiempo real | Supabase Realtime | `postgres_changes` sobre 7 tablas y broadcast de actividad |

## Herramientas

| Herramienta | Versión | Uso |
|---|---|---|
| Bun | 1.4 | Gestor de paquetes y runner de tests unitarios |
| Vite | 7.3 | Dev server y build |
| TypeScript | 5.9 | Modo `strict` |
| ESLint + Prettier | 9 / 3 | `bun run lint`, `bun run format` |
| Playwright | 1.56 | Test e2e de horarios del itinerario |
| Wrangler | 4.151 | Despliegue a Cloudflare |
| Supabase CLI | 2.121 | Migraciones, tipos, entorno local |

## Scripts

| Comando | Qué hace |
|---|---|
| `bun install` | Instala dependencias desde `bun.lock` |
| `bun run dev` | Servidor de desarrollo en el puerto 8080 |
| `bun run build` | Build de producción para Cloudflare Workers |
| `bun run preview` | Sirve el build localmente |
| `bun run deploy` | Build y `wrangler deploy` |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint |
| `bun run test` | Tests unitarios de `e2e/*.test.ts` con Bun |
| `bun run test:e2e` | Playwright sobre `e2e/*.spec.ts`; necesita servidor y sesión |
| `bun run assets:download` | Descarga las fotos de la plantilla de Oaxaca desde la app de Lovable |
| `bun run db:push` | Aplica `supabase/migrations` al proyecto vinculado |
| `bun run db:types` | Regenera `src/integrations/supabase/types.ts` |

Si tu máquina no tiene IPv6, el servidor de desarrollo falla al escuchar en `::`. En ese caso
usa `bun run dev -- --host 127.0.0.1`.

## Variables de entorno

Plantilla completa en [`.env.example`](../.env.example).

| Variable | Dónde se usa | Tipo |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Cliente del navegador y landing pública | Públicas, se incrustan en el build |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | SSR, server functions, `/api/public/track` | Servidor, valor público |
| `SUPABASE_SERVICE_ROLE_KEY` | `client.server.ts`: apply, imágenes, invitaciones, accesos | Secreta |
| `VITE_PUBLIC_SITE_URL` | og:image de landings con rutas relativas | Pública |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | `src/lib/email-templates/send-email.ts` | Secreta / configuración |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | `src/lib/ai-gateway.server.ts` | Secreta / configuración |
| `PLAYWRIGHT_BASE_URL`, `E2E_*` | Tests e2e | Solo tests |

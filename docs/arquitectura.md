# Arquitectura de Planeii

Grafo vivo de la arquitectura. Si cambiás un módulo, una tabla o un límite entre capas,
actualizá el diagrama correspondiente en el mismo commit. Los flujos paso a paso están en
[flujos.md](flujos.md).

Los diagramas son Mermaid: GitHub los dibuja directamente. Para editarlos con vista previa
podés usar https://mermaid.live.

## 1. Contexto del sistema

Una sola aplicación TanStack Start que se ejecuta como Cloudflare Worker. Sirve el panel de
gestión (privado), las landings de venta (públicas) y unas pocas rutas API. Toda la
persistencia vive en Supabase.

```mermaid
flowchart LR
  subgraph Personas
    ORG["Owner y equipo<br/>(organizadoras, tour leaders)"]
    VIS["Visitante / viajera"]
  end

  subgraph Worker["Cloudflare Worker · Nitro + TanStack Start"]
    SSR["SSR de rutas<br/>src/routes"]
    SF["Server functions<br/>src/lib/*.functions.ts"]
    API["Rutas API públicas<br/>/api/public/apply · track · page-image/*"]
    ASSETS["Assets estáticos<br/>.output/public"]
  end

  subgraph Supabase
    AUTH["Auth<br/>email + Google"]
    PG[("Postgres + RLS<br/>19 tablas")]
    ST[("Storage<br/>trip-covers · trip-notes-docs · trip-page-images")]
    RT["Realtime<br/>postgres_changes + broadcast"]
  end

  RESEND["Resend<br/>correo transaccional"]
  LLM["API compatible OpenAI<br/>textos de venta"]

  ORG -->|"navegador: panel /"| SSR
  VIS -->|"/v/$slug · /v/$slug/reservar"| SSR
  ORG -. "supabase-js + JWT (RLS)" .-> PG
  ORG -. "subidas directas" .-> ST
  ORG -. "suscripciones" .-> RT
  ORG -->|"login"| AUTH
  SF -->|"cliente con JWT del usuario"| PG
  SF -->|"service role (tras validar)"| PG
  API -->|"service role"| PG
  API -->|"service role"| ST
  API -->|"correos de solicitud"| RESEND
  SF -->|"generateSalesCopy"| LLM
```

Puntos clave:

- **Dos caminos a la base.** El navegador habla con Supabase directamente (lecturas, notas,
  páginas de venta, subidas) protegido solo por RLS. Las operaciones sensibles pasan por server
  functions que validan el JWT y, si hace falta, usan el cliente con service role.
- **SSR sin sesión.** La sesión vive en `localStorage`; el SSR no la conoce. Por eso el layout
  autenticado tiene `ssr: false` y las landings públicas leen con la clave publicable.
- **Sin backend propio aparte del Worker.** No hay colas, cron ni Edge Functions. La purga de la
  papelera la hace el cliente al cargar.

## 2. Capas del código

```mermaid
flowchart TB
  subgraph Rutas["src/routes (file-based)"]
    ROOT["__root.tsx<br/>layout, AccessProvider"]
    PUB["Públicas<br/>auth · reset-password · invitacion.$token<br/>v.$slug · v.$slug_.reservar · preview"]
    PRIV["_authenticated/*<br/>dashboard, viaje, página, métricas,<br/>solicitudes, finanzas, accesos, ajustes…"]
    APIR["api/public/* · api/dev/*"]
  end

  subgraph Componentes["src/components"]
    WS["Espacio del viaje<br/>enrollees · itinerary · trip-notes<br/>ProvidersTab · TripMembersDialog"]
    ED["editor/*<br/>TripEditor · TripPreview · PublishDialog…"]
    LAND["trip/*<br/>TripLanding y secciones · ApplyFormView"]
    UI["ui/* (shadcn/Radix)"]
  end

  subgraph Lib["src/lib"]
    STORE["trips-store.ts<br/>Zustand: caché de trips.data<br/>+ autosave"]
    FN["*.functions.ts<br/>server functions"]
    SRV["*.server.ts<br/>solo servidor: exports, IA, auditoría"]
    DOM["Dominio puro<br/>finance · cta-links · booking-form<br/>trip-editor · inline-text · tags"]
    PAGE["trip-page-store.ts<br/>borradores, versiones, snapshots"]
  end

  subgraph Integr["src/integrations/supabase"]
    CL["client.ts (navegador)"]
    MW["auth-attacher + auth-middleware"]
    ADM["client.server.ts (service role)"]
    TY["types.ts (generado)"]
  end

  PRIV --> WS & ED
  PUB --> LAND
  ED --> LAND
  WS --> STORE
  ED --> PAGE
  STORE --> FN
  WS --> FN
  FN --> MW
  FN --> SRV
  FN --> ADM
  APIR --> ADM
  STORE & PAGE --> CL
  WS & ED & LAND --> DOM
  WS & ED --> UI
  CL & MW & ADM --> TY
```

Reglas que sostienen esta estructura:

- Los módulos `*.server.ts` y `client.server.ts` nunca se importan desde el cliente. Vite lo
  hace cumplir con `importProtection` en `vite.config.ts`.
- `src/start.ts` registra `attachSupabaseAuth` como middleware global: cada llamada a una
  server function lleva `Authorization: Bearer <jwt>`. `requireSupabaseAuth` valida ese token y
  crea un cliente con RLS del usuario.
- Las reglas del editor de páginas de venta están en [`AGENTS.md`](../AGENTS.md).

## 3. Modelo de datos

Casi todo el negocio de un viaje vive en una sola columna `trips.data` (jsonb): itinerario,
costos, viajeras con sus cuotas y pagos, extras, créditos, proveedores, tags, logística y el
estado de papelera. Las tablas propias son para lo colaborativo (notas, tareas, documentos),
el acceso (miembros, invitaciones, auditoría) y las páginas de venta.

```mermaid
erDiagram
  AUTH_USERS ||--|| profiles : "trigger on_auth_user_created"
  AUTH_USERS ||--o{ user_roles : "rol global owner"
  AUTH_USERS ||--o| account_defaults : "plantillas"
  AUTH_USERS ||--o{ trips : "owner_id"

  trips ||--o{ trip_members : "equipo"
  trips ||--o{ trip_invitations : "invitaciones"
  trips ||--o{ trip_todos : ""
  trips ||--o{ trip_notes : ""
  trips ||--o{ trip_documents : ""
  trips ||--o{ trip_pages : "landing publicada"
  trips ||--o| trip_page_drafts : "borrador"
  trips ||--o{ trip_page_versions : "historial (20)"
  trips ||--o{ trip_page_preview_snapshots : "vista previa 24 h"
  trips ||--o{ trip_page_events : "analítica"
  trips ||--o{ trip_page_backups : "respaldos"
  trips ||--o{ trip_applications : "solicitudes"
  trip_applications ||--o{ trip_application_notes : ""
  trip_applications ||--o{ trip_application_events : ""
  trip_applications |o--o{ trip_applications : "duplicate_of"
  profiles |o--o{ trip_applications : "contacted_by"

  trips {
    uuid id PK
    uuid owner_id FK
    text name
    text status
    jsonb data "itinerario, costos, viajeras, pagos, proveedores…"
  }
  trip_members {
    uuid trip_id FK
    uuid user_id FK
    trip_member_role role "organizadora | tour_leader"
    jsonb permissions "8 permisos finos"
  }
  trip_invitations {
    uuid trip_id FK
    text email
    text token UK
    text status "pending | accepted | revoked"
    timestamptz expires_at "7 días"
  }
  trip_pages {
    uuid trip_id FK
    text slug UK
    jsonb document "EditorDocument v4"
  }
  trip_applications {
    uuid trip_id FK
    text page_slug
    text status "nueva…"
    jsonb answers
    jsonb form_snapshot
    text enrollee_id "id dentro de trips.data"
  }
  trip_page_events {
    uuid trip_id FK
    text event "view | click | form_start | form_submit"
  }
```

Además, sin relación declarada:

- `access_audit_log` registra cambios de acceso (actor, destinatario, viaje). Solo la escribe el
  servidor con service role.
- `trip_documents.storage_path` apunta a un objeto de `trip-notes-docs`; `trips.data.coverImage`
  a `trip-covers`; las imágenes dentro de `trip_pages.document` a `trip-page-images`.

Todas las migraciones están en `supabase/migrations/` y se aplican en orden con
`supabase db push`. La última, `20261015120000_self_hosting_storage_and_grants.sql`, crea lo que
en Lovable se configuró fuera de los archivos.

## 4. Modelo de permisos

```mermaid
flowchart LR
  U["Usuaria autenticada"] --> Q1{"¿user_roles = owner?"}
  Q1 -->|sí| OWN["Owner global<br/>ve y gestiona todos los viajes,<br/>crea viajes, gestiona accesos"]
  Q1 -->|no| Q2{"¿trips.owner_id = yo?"}
  Q2 -->|sí| DUE["Dueña del viaje<br/>acceso total a ese viaje"]
  Q2 -->|no| Q3{"¿fila en trip_members?"}
  Q3 -->|organizadora| ORGA["Permisos por defecto amplios<br/>+ overrides en permissions"]
  Q3 -->|tour_leader| TL["Permisos por defecto reducidos<br/>+ overrides en permissions"]
  Q3 -->|no| NO["Sin acceso"]

  ORGA & TL --> CHK["Dónde se comprueba"]
  CHK --> C1["Cliente: AccessGate, usePermissions<br/>(solo oculta UI)"]
  CHK --> C2["Servidor: updateTripData compara<br/>JSON viejo vs nuevo (requiredScopes)"]
  CHK --> C3["RLS: solo distingue miembro / dueña / owner"]
```

Los 8 permisos finos están en `src/lib/trip-permissions.ts`. La base de datos no los conoce:
solo los aplica `updateTripData`. Ver los riesgos que esto abre en [estado.md](estado.md).

## 5. Despliegue

```mermaid
flowchart LR
  DEV["bun run dev<br/>vite :8080"] --> BUILD["bun run build<br/>Nitro preset cloudflare-module"]
  BUILD --> OUT[".output/server (Worker)<br/>.output/public (assets)<br/>.wrangler/deploy/config.json"]
  OUT --> DEPLOY["bun run deploy<br/>wrangler deploy"]
  DEPLOY --> CF["Cloudflare Workers<br/>vars y secrets del Worker"]
  MIG["supabase/migrations"] -->|"supabase db push"| SB["Proyecto Supabase"]
```

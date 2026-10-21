# Flujos implementados

Cada flujo describe lo que hace el código hoy, no lo que debería hacer. Los problemas conocidos
de cada flujo están en [estado.md](estado.md). Si cambias un flujo, actualiza su diagrama en el
mismo commit.

Participantes habituales: **UI** (componente React), **Store** (Zustand, `src/lib/trips-store.ts`),
**SF** (server function), **DB** (Postgres con RLS), **ST** (Storage), **RT** (Realtime).

Índice:

- Acceso: [1. Llamada autenticada](#1-llamada-autenticada-a-una-server-function) ·
  [2. Login e invitación](#2-login-registro-e-invitación) ·
  [3. Gestión de accesos](#3-gestión-de-accesos-owner)
- Espacio del viaje: [4. Carga y sincronización](#4-carga-y-sincronización-de-viajes) ·
  [5. Guardado del viaje](#5-guardado-del-viaje-autosave) ·
  [6. Crear viaje](#6-crear-y-duplicar-viaje) ·
  [7. Costos e itinerario](#7-costos-e-itinerario) ·
  [8. Viajeras y pagos](#8-viajeras-pagos-y-créditos) ·
  [9. Logística](#9-logística-y-adjuntos-de-viajeras) ·
  [10. Notas, tareas y documentos](#10-notas-tareas-y-documentos) ·
  [11. Exportar](#11-exportar-pdf-y-excel) ·
  [12. Papelera](#12-papelera-y-borrado) ·
  [13. Actividad en vivo](#13-actividad-en-vivo)
- Página de venta: [14. Editar](#14-editar-con-autosave-y-deshacer) ·
  [15. Editor e iframe](#15-editor--iframe-por-postmessage) ·
  [16. Vista previa](#16-vista-previa-con-snapshot) ·
  [17. Publicar](#17-publicar-y-servir-vslug) ·
  [18. CTAs](#18-resolución-de-ctas) ·
  [19. Imágenes](#19-imágenes-de-la-landing) ·
  [20. IA](#20-textos-con-ia)
- Recorrido público: [21. Solicitud](#21-solicitud-pública-y-correos) ·
  [22. Analítica](#22-analítica-y-métricas) ·
  [23. Panel de solicitudes](#23-panel-de-solicitudes)

---

## Acceso

### 1. Llamada autenticada a una server function

Todas las server functions usan este camino (`src/start.ts`, `src/integrations/supabase/`).

```mermaid
sequenceDiagram
  participant UI
  participant AT as attachSupabaseAuth (cliente)
  participant MW as requireSupabaseAuth (Worker)
  participant H as Handler
  participant DB
  UI->>AT: useServerFn(fn)(data)
  AT->>AT: supabase.auth.getSession()
  AT->>MW: RPC + Authorization: Bearer jwt
  MW->>MW: getClaims(jwt) → userId, email
  MW->>H: context.supabase (RLS del usuario), userId, claims
  alt operación normal
    H->>DB: consulta como el usuario (RLS)
  else operación privilegiada
    H->>H: valida owner / membresía / token
    H->>DB: supabaseAdmin (service role)
  end
  H-->>UI: resultado
```

### 2. Login, registro e invitación

`src/routes/auth.tsx`, `src/routes/invitacion.$token.tsx`, `src/lib/trip-invitations.functions.ts`.

```mermaid
sequenceDiagram
  actor P as Persona invitada
  participant INV as /invitacion/$token
  participant AUTH as /auth
  participant SA as Supabase Auth
  participant SF
  participant DB
  P->>INV: abre el enlace copiado por la owner
  alt sin sesión
    INV->>INV: guarda token en sessionStorage
    INV->>AUTH: /auth?invite=token
    alt email y contraseña
      AUTH->>SA: signUp / signInWithPassword
    else Google
      AUTH->>SA: signInWithOAuth(google, redirectTo=/auth?invite=…)
      SA-->>AUTH: vuelve con la sesión en la URL
    end
    AUTH->>INV: redirectAfterAuth()
  end
  INV->>SF: lookupTripInvitation(token)
  SF->>DB: trip_invitations, trips (service role)
  INV->>SF: acceptTripInvitation(token)
  SF->>SF: email del JWT = email invitado
  SF->>DB: upsert profiles, upsert trip_members, invitación → accepted
  SF->>DB: access_audit_log (2 filas)
  INV->>P: navega a /viajes/$tripId
```

Respaldo: cada vez que se monta el layout autenticado, `acceptMyPendingInvitations` acepta
todas las invitaciones pendientes del email de la sesión. Las invitaciones no se envían por
correo: la owner copia el enlace.

Reset de contraseña: `resetPasswordForEmail` con `redirectTo=/reset-password`, que espera el
evento `PASSWORD_RECOVERY` y llama a `updateUser({ password })`.

### 3. Gestión de accesos (owner)

`/accesos` y `src/lib/admin-access.functions.ts`. Cada acción llama a `assertOwner` y luego usa
service role.

```mermaid
flowchart LR
  A["/accesos (owner)"] --> U["Usuarios<br/>listAllUsers → setOwnerRole"]
  A --> I["Invitaciones<br/>createGlobalInvitation · revokeTripInvitation"]
  A --> M["Membresías<br/>updateTripMember · removeTripMember"]
  A --> B["Bitácora<br/>listAccessAudit"]
  U & I & M --> LOG[("access_audit_log")]
  U --> UR[("user_roles")]
  I --> TI[("trip_invitations")]
  M --> TM[("trip_members")]
  MA["/mis-accesos (todas)"] --> GA["getMyAccessAudit<br/>roles, membresías, historial propio"]
```

---

## Espacio del viaje

### 4. Carga y sincronización de viajes

`src/routes/_authenticated/route.tsx` (`TripsSyncer`) y `hydrateFromSupabase` en el store.

```mermaid
sequenceDiagram
  participant L as Layout autenticado
  participant S as Store
  participant SF
  participant DB
  participant RT
  L->>SF: acceptMyPendingInvitations()
  L->>S: hydrateFromSupabase()
  S->>SF: listMyTrips()
  SF->>DB: select trips (filtrado por RLS)
  SF-->>S: filas con data completo
  S->>S: backfill de moneda, purga de viajes vencidos en papelera
  L->>RT: canal trips-live-sync (trips, trip_members, trip_notes,<br/>trip_todos, trip_documents, trip_invitations, user_roles)
  RT-->>L: cualquier cambio
  L->>S: re-hidratación completa (debounce 300 ms)
```

### 5. Guardado del viaje (autosave)

Todo cambio de `trips.data` pasa por aquí (`trips-store.ts`, `trips.functions.ts`).

```mermaid
sequenceDiagram
  participant UI
  participant S as Store
  participant Q as Cola por viaje
  participant SF as updateTripData
  participant DB
  participant RT as Broadcast trip-activity
  UI->>S: acción (updateCost, addInstallmentPayment…)
  S->>S: set() + auditLog dentro del JSON
  S->>Q: suscriptor detecta cambio → espera 800 ms<br/>(saveTripNow la salta)
  Q->>SF: persistTrip(trip) serializado por viaje
  SF->>DB: lee trips.data actual
  SF->>SF: loadEffectivePerms + requiredScopes(viejo, nuevo)
  alt faltan permisos
    SF-->>S: error (se guarda en saveError, no se muestra)
  else ok
    SF->>DB: UPDATE trips (data + columnas espejo)
    S->>RT: notifyTripActivity
  end
```

### 6. Crear y duplicar viaje

`src/components/NewTripDialog.tsx`, `createTrip` en `trips.functions.ts`.

```mermaid
sequenceDiagram
  participant UI as NewTripDialog
  participant ST
  participant SF
  participant S as Store
  participant DB
  opt portada
    UI->>ST: trip-covers/{uid}/{tripId}/{ts}.ext
  end
  UI->>SF: getAccountDefaults() (reembolsos, presets de costos)
  UI->>S: createTrip(data) optimista
  S->>SF: createTrip
  SF->>DB: has_role(owner) → INSERT trips → INSERT trip_members (organizadora)
  opt paso 2
    UI->>SF: createTripInvitation → enlace al portapapeles
  end
```

Duplicar (`TripActionsDialogs.tsx`) copia el JSON sin viajeras, miembros ni invitaciones y
reutiliza el mismo flujo.

### 7. Costos e itinerario

Pestaña "Itinerario & Costos" (`CostsTab` en `viajes.$tripId.tsx`). Todo vive en `trips.data`.

```mermaid
flowchart LR
  E["Editar fila, celda, horario,<br/>ciudad del día, tags"] --> S["Store: updateCost, setCosts,<br/>setItineraryDayCity, addTag…"]
  N["Nota de costo<br/>CostNoteEditor (Tiptap, HTML)"] --> S
  H["Deshacer / rehacer<br/>use-costs-history (memoria)"] --> S
  S --> G["Guardado del viaje (flujo 5)<br/>scopes editar_costos / editar_itinerario"]
```

El itinerario visible son los costos agrupados por `itineraryDay`. Los campos `title`,
`description` y `activities` de cada día no tienen editor; las exportaciones sí los leen.

### 8. Viajeras, pagos y créditos

Pestaña "Viajeras" (`EnrolleesTab`, `EnrolleeCard`) y acciones del store.

```mermaid
flowchart TB
  ADD["AddEnrolleeDialog"] --> AE["addEnrollee<br/>aplica créditos reservados de otros viajes"]
  AE --> PP["setPaymentPlan (cuotas)"]
  CARD["EnrolleeCard"] --> PAY["addInstallmentPayment<br/>comisión, neto, redistribución, sobrepago"]
  CARD --> OTH["descuentos, extras, cancelación,<br/>participación, contacto, notas"]
  CARD --> CR["créditos: resolveOverpayment,<br/>applyCreditToTrip (2 viajes), reserveCreditForFuture"]
  APP["Solicitud aprobada (flujo 23)"] --> AE
  AE & PP & PAY & OTH & CR --> SAVE["Guardado del viaje (flujo 5)<br/>scopes gestionar_viajeras / registrar_pagos / editar_extras"]
  SAVE --> FIN["/finanzas y pestaña Resumen<br/>calculateTripFinancials, aggregateEnrollees"]
```

### 9. Logística y adjuntos de viajeras

`src/components/enrollees/LogisticsTab.tsx`, `src/lib/enrollee-files-storage.ts`.

```mermaid
sequenceDiagram
  participant UI as LogisticsTab
  participant ST
  participant S as Store
  UI->>S: setEnrolleeLogistics (vuelos, seguro)
  UI->>ST: trip-notes-docs/{tripId}/viajeras/{enrolleeId}/{ts}-{nombre} (≤15 MB)
  UI->>S: addEnrolleeAttachment(ruta)
  S->>S: guardado del viaje (flujo 5)
  UI->>ST: abrir → URL firmada 1 h
```

### 10. Notas, tareas y documentos

Pestaña "Notas" (`src/components/trip-notes/`) con React Query sobre `trip-notes.functions.ts`.

```mermaid
sequenceDiagram
  participant UI as NotesTab / páginas de detalle
  participant SF
  participant DB
  participant ST
  UI->>SF: listTripNotes(tripId)
  SF->>DB: trip_todos, trip_notes, trip_documents + profiles
  UI->>SF: upsertTodo / upsertNote / reorder / togglePin / delete
  SF->>DB: escritura (RLS: miembro o dueña)
  UI->>UI: invalidateQueries(["trip-notes", tripId])
  opt documento
    UI->>ST: trip-notes-docs/{tripId}/{uuid}.ext (≤25 MB)
    UI->>SF: upsertDocument → trip_documents
    UI->>SF: getSignedDocumentUrl (1 h)
  end
```

Las páginas `/viajes/$tripId/notas/$noteId` y `/todos/$todoId` editan con `RichEditor` y
guardan a los 800 ms.

### 11. Exportar PDF y Excel

```mermaid
sequenceDiagram
  participant UI as Menú Exportar
  participant S as Store
  participant SF as generateTripExport
  participant DB
  UI->>S: saveTripNow()
  UI->>SF: generateTripExport(tripId, pdf|xlsx)
  SF->>DB: lee trips
  SF->>SF: canSeeFinance → buildTripPDF / buildTripXLSX (trip-exports.server.ts)
  SF-->>UI: base64 → descarga
```

### 12. Papelera y borrado

```mermaid
stateDiagram-v2
  [*] --> Activo
  Activo --> EnPapelera: trashTrip (isDeleted, purgeAt = +7 días en trips.data)
  EnPapelera --> Activo: restoreTrip
  EnPapelera --> Borrado: purgeTrip (owner) → deleteTrip
  EnPapelera --> Borrado: purgeAt vencido al hidratar en el cliente
  Borrado --> [*]: DELETE trips + cascada en tablas hijas (Storage queda huérfano)
```

### 13. Actividad en vivo

Tras cada guardado, `notifyTripActivity` envía un broadcast al canal `trip-activity:<tripId>`.
`useTripActivity` lo muestra a las demás personas que tienen el viaje abierto, junto con la
sección en la que está cada una. No se guarda nada en la base.

---

## Página de venta

Reglas de diseño del editor: [`AGENTS.md`](../AGENTS.md). Documento: `EditorDocument` versión 4
en `src/lib/trip-editor.ts`.

### 14. Editar con autosave y deshacer

`src/components/editor/TripEditor.tsx` en `/viajes/$tripId/pagina`.

```mermaid
sequenceDiagram
  participant E as TripEditor
  participant LS as localStorage
  participant DB
  E->>DB: loadPageDraft (trip_page_drafts)
  alt sin borrador
    E->>DB: trip_pages.document publicado
    alt sin publicado
      E->>LS: borrador local
    end
  end
  E->>E: normalizeEditorDocument (base neutra u Oaxaca, imágenes re-mapeadas)
  loop cada cambio
    E->>E: mutate() → undoStack (máx. 50), docRef, setDocument
    E->>LS: tras 1500 ms
    E->>DB: upsert trip_page_drafts (onConflict trip_id)
  end
  E->>E: Descartar → vuelve al publicado y borra el borrador
```

### 15. Editor ↔ iframe por postMessage

El lienzo es un iframe de `/preview?trip=<id>&mode=editor`. Todos los mensajes usan el mismo
origen y se valida `event.source`.

```mermaid
sequenceDiagram
  participant E as TripEditor
  participant F as iframe TripPreview
  F->>E: trip-editor-ready
  E->>F: trip-editor-preview {document, view, slug}
  F->>E: trip-editor-text-select {path, marks}
  E->>F: trip-editor-inline-format {path, command}
  F->>E: trip-editor-text-commit {path, styleKey, value, inline}
  F->>E: trip-editor-image-click {imageKey}
  F->>E: trip-editor-button-click {section, ctaId}
  F->>E: trip-editor-meta-add / meta-remove
  E->>E: mutate() y reenvía trip-editor-preview
```

### 16. Vista previa con snapshot

```mermaid
sequenceDiagram
  participant E as TripEditor
  participant W as Pestaña nueva
  participant DB
  E->>W: window.open("") síncrono
  E->>DB: INSERT trip_page_preview_snapshots (expira en 24 h)
  E->>W: /preview?trip=…&snapshot=…
  W->>DB: snapshot vigente (RLS: miembro)
  W->>W: TripLanding en modo visitante, sin analítica
```

### 17. Publicar y servir /v/$slug

```mermaid
sequenceDiagram
  participant E as TripEditor
  participant PD as PublishDialog
  participant DB
  participant V as Visitante
  participant W as Worker /v/$slug
  E->>E: saveNow()
  E->>PD: PrePublishChecklist (avisa, no bloquea)
  PD->>DB: slug libre en trip_pages
  PD->>PD: externalizeDocumentImages
  PD->>DB: UPDATE o INSERT trip_pages (document, published_at)
  PD->>DB: recordPageVersion (recorta a 20) + clearPageDraft
  V->>W: GET /v/$slug
  W->>DB: REST trip_pages?slug=eq.… con clave publicable
  W->>W: normalizeEditorDocument + resolveTemplateAssets
  W-->>V: SSR de TripLanding + og:image
```

### 18. Resolución de CTAs

Cada botón tiene un `ctaId` estable y se resuelve con `resolveCtaLink` (`src/lib/cta-links.ts`).

```mermaid
flowchart TB
  B["BookLink(ctaId)"] --> L{"¿ctaLinks[ctaId] con destino?"}
  L -->|sí| T{"tipo"}
  L -->|no| D["defaultCtaLink<br/>heroItinerary → sección itinerario<br/>announcement → announcement.url<br/>form interno → form<br/>si no → url externa / bookingUrl"]
  D --> T
  T -->|form| F["/v/slug/reservar + UTMs<br/>(requiere modo interno y slug)"]
  T -->|section| S["#seccion-id<br/>(debe existir y estar visible)"]
  T -->|url| U["safeTextLink<br/>(sin placeholders ni javascript:)"]
  F & S & U -->|falla| FB["fallback + warning en el editor"]
```

### 19. Imágenes de la landing

```mermaid
sequenceDiagram
  participant E as TripEditor
  participant C as ImageCropDialog
  participant ST
  participant W as /api/public/page-image/*
  E->>E: jpeg/png/webp ≤25 MB → dataURL
  E->>C: recorte según destino → JPEG 0.82, ≤1800 px
  C->>E: blob
  E->>E: compressToTarget (objetivo 450 KB)
  E->>ST: trip-page-images/{tripId}/{uuid}.jpg
  E->>E: src = /api/public/page-image/{tripId}/{uuid}.jpg
  Note over W,ST: al visitar: service role descarga y responde con caché de 1 año
```

Las fotos de la plantilla de Oaxaca se sirven desde `public/template-assets/`. Las rutas del CDN
de Lovable guardadas en documentos viejos se re-mapean en `resolveTemplateAssets`.

### 20. Textos con IA

`AiCopyDialog` → `generateSalesCopy` (`src/lib/sales-copy.functions.ts`) →
`createResponsesModel` (`src/lib/ai-gateway.server.ts`) con `AI_API_KEY`, `AI_BASE_URL` y
`AI_MODEL`. La salida se valida con un esquema zod y se aplica con `mutate()`, así que se puede
deshacer. No toca la base.

---

## Recorrido público

### 21. Solicitud pública y correos

```mermaid
sequenceDiagram
  actor V as Viajera
  participant F as /v/$slug/reservar (ApplyFormView)
  participant A as /api/public/apply
  participant DB
  participant R as Resend
  V->>F: completa el formulario
  F->>F: track form_start (primer foco)
  F->>A: POST {slug, datos, answers, consent, utm, referrer}
  A->>DB: trip_pages por slug (service role) → formulario publicado
  A->>A: modo interno, consentimiento, validateAnswers
  A->>DB: límite 3/persona/10 min y 30/viaje/min, posibles duplicados
  A->>DB: INSERT trip_applications (+ form_snapshot, UTMs)
  A->>DB: trips, trip_members, profiles → dueña + organizadoras
  A->>R: application-organizer (replyTo = viajera)
  A->>R: application-traveler
  A-->>F: ok
  F->>F: track form_submit → página de gracias
```

Un fallo de correo nunca afecta a la solicitud guardada. Sin `RESEND_API_KEY`, los correos se
registran en consola.

### 22. Analítica y métricas

```mermaid
sequenceDiagram
  participant P as /v/$slug (TripLanding)
  participant T as /api/public/track
  participant DB
  participant M as /viajes/$id/metricas
  P->>T: view al montar, click en CTAs, form_start, form_submit
  opt hay sesión
    T->>DB: ¿dueña u organizadora del viaje?
    T-->>P: 202 y descarta
  end
  T->>DB: INSERT trip_page_events (+ país de cf-ipcountry)
  M->>DB: getTripPageMetrics: últimos 30 días (máx. 5000)<br/>+ conteo de trip_applications
```

### 23. Panel de solicitudes

`/viajes/$tripId/solicitudes` trabaja con supabase-js y RLS sobre `trip_applications`,
`trip_application_notes` y `trip_application_events`. Cambiar estado, marcar contacto o
agregar notas escribe un evento. Aprobar crea la viajera con `addEnrollee` (flujo 8) y guarda
su id en `trip_applications.enrollee_id`. El dashboard muestra un punto de "nuevas" consultando
cada 30 s; lo visto se guarda por dispositivo en `localStorage`.

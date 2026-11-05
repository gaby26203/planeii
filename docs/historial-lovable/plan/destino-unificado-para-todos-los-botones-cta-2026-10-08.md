# Destino unificado para todos los botones CTA

## Qué vas a ver
En los controles de cada botón (al hacer clic en un CTA del editor, o en "Estilo por sección → Botones") aparece:

- **Texto del botón** (sigue editable también directo sobre la página).
- **Destino del botón**: Formulario interno / URL / Sección de la landing.
- Si elegís **URL**: campo "URL del botón" y el interruptor "Abrir en nueva pestaña".
- Si elegís **Sección de la landing**: un desplegable con las secciones visibles (Itinerario, Qué incluye, Precio, FAQ, etc.); el botón hace scroll suave hasta ella, compensando la barra fija y el menú. Si la sección está oculta o se elimina, el editor avisa.
- Si elegís **Formulario interno**: no hay que escribir nada; muestra "Lleva a /v/[dirección]/reservar". Si la página aún no tiene dirección publicada o el formulario no está configurado, aparece una advertencia clara y el botón no genera un enlace roto.

Aplica a: Hero, menú (escritorio y móvil), Qué incluye, Itinerario, Precio / Reserva, Cierre final, barra promocional fija, y cualquier CTA futuro.

## Reglas
- Cada botón guarda su propia configuración (texto, tipo de destino, URL, nueva pestaña).
- "Formulario interno" siempre resuelve al formulario del mismo viaje de esa landing; nunca se guarda una URL fija de otro viaje (por eso copiar o duplicar una página no arrastra enlaces ajenos).
- Botones sin configuración propia heredan el comportamiento actual (enlace de reserva general / modo del formulario), así Oaxaca, Caripe y Tailandia no cambian hasta que los edites.
- Mismo resultado en editor, vista previa y página publicada. En el editor el clic sigue abriendo controles; en vista previa y publicada navega.
- URLs se validan (https://, mailto:, tel:, wa.me, rutas internas); una URL inválida muestra error en el editor.
- Si un botón apunta a una sección oculta o eliminada: advertencia en el editor indicando qué botón es, y aparece en el checklist antes de publicar. En la página publicada el botón no genera un enlace roto (cae al destino de reserva general).
- Al ir al formulario interno se conservan automáticamente los UTMs y demás parámetros de atribución que Planeii usa para medir el funnel (origen, referencia, id de campaña), sin configurar cada botón.

## Detalles técnicos
- Documento: `ctaLinks: Record<string, CtaLink>` con `CtaLink = { target: "form" | "url" | "section"; url?: string; newTab?: boolean; sectionId?: SectionKey }`. `sectionId` guarda la clave estable de la sección (nunca su nombre visible). Normalizado en `normalizeEditorDocument`; ausente = heredar; sectionId inválido se conserva pero se marca como advertencia.
- Ids de CTA: los actuales tienen ids fijos (hero, nav, navMobile, included, itinerary, booking, final, announcement); botones futuros generan su propio `ctaId` estable (`cta_<uuid corto>`) al crearse y usan el mismo sistema. Las claves no están cerradas a una lista.
- Un único resolvedor `resolveCtaLink(document, ctaId, { slug, search })` en `src/lib/published-page.ts` (reemplaza el uso directo de `trip.bookingUrl` / `bookingHrefFor`). Devuelve `{ href, newTab, warning }`. Para formulario usa siempre el slug de la landing actual y reenvía una lista central de parámetros de atribución (`utm_*`, `ref`, `src`, `gclid`, `fbclid`).
- Sección: cada sección renderiza un id DOM estable derivado de su clave; scroll suave con offset de barra fija y menú.
- `BookLink` recibe `ctaId` y usa el resolvedor vía contexto de landing; Hero, Navbar, Details, Closing y AnnouncementBar pasan su id.
- Componente `CtaDestinationControls` reutilizado por todas las secciones en el panel de controles del CTA.
- Función `ctaWarnings(document, slug)` alimenta las advertencias del editor y el checklist de publicación (formulario no configurado, sección oculta/eliminada, URL inválida).
- Tests bun: formulario del propio slug con atribución reenviada, URL con nueva pestaña, sección visible/oculta (fallback y advertencia), herencia para documentos viejos, ctaId nuevo funciona, URL insegura rechazada.
- AGENTS.md: regla "todos los CTA resuelven su destino con un único resolvedor por ctaId".

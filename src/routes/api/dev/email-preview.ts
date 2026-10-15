import * as React from "react";
import { render } from "@react-email/render";
import { createFileRoute } from "@tanstack/react-router";
import { TEMPLATES } from "@/lib/email-templates/registry";

// Vista previa local de las plantillas de correo con sus `previewData`.
// Reemplaza a /lovable/email/transactional/preview, que solo usaba el panel de Lovable.
//   GET /api/dev/email-preview                     índice de plantillas
//   GET /api/dev/email-preview?template=<nombre>   HTML renderizado de una plantilla
// Solo responde en `vite dev`; en producción devuelve 404.

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const Route = createFileRoute("/api/dev/email-preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!import.meta.env.DEV) return new Response("Not found", { status: 404 });

        const name = new URL(request.url).searchParams.get("template");
        if (!name) {
          const items = Object.entries(TEMPLATES)
            .map(([key, entry]) => {
              const label = escapeHtml(entry.displayName || key);
              return `<li><a href="?template=${encodeURIComponent(key)}">${label}</a></li>`;
            })
            .join("");
          return new Response(`<!doctype html><meta charset="utf-8"><ul>${items}</ul>`, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }

        const entry = TEMPLATES[name];
        if (!entry) return new Response("Plantilla no encontrada", { status: 404 });
        if (!entry.previewData) {
          return new Response("La plantilla no define previewData", { status: 422 });
        }
        const html = await render(React.createElement(entry.component, entry.previewData));
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      },
    },
  },
});

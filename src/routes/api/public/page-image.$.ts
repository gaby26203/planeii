import { createFileRoute } from "@tanstack/react-router";

// Sirve las fotos de las landings (bucket privado) para que la página publicada pueda mostrarlas.
export const Route = createFileRoute("/api/public/page-image/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as { _splat?: string })._splat ?? "";
        if (!/^[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/.test(path)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("trip-page-images").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        return new Response(data, {
          headers: { "Content-Type": data.type || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
        });
      },
    },
  },
});

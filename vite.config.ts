// Configuración explícita de Vite para TanStack Start.
//
// Reproduce lo que hacía `@lovable.dev/vite-tanstack-config` fuera del sandbox
// de Lovable, sin los plugins propios de su plataforma (proxy de assets, puente
// del editor, diagnósticos de build, manifiesto de rutas):
//   - Tailwind v4, alias `@/` desde tsconfig, TanStack Start y React.
//   - Nitro solo en `build`, con preset Cloudflare Workers (`cloudflare-module`).
//     Se puede cambiar con la variable NITRO_PRESET (p. ej. `node-server`).
//   - Protección de imports: nada bajo `**/server/**` ni `server-only` en el cliente.
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig(({ command, mode }) => {
  // Las variables VITE_* se inyectan como constantes de build, igual que antes.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  return {
    define,
    css: { transformer: "lightningcss" },
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    server: { host: "::", port: 8080 },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      ...(command === "build"
        ? [
            nitro({
              defaultPreset: "cloudflare-module",
              cloudflare: { nodeCompat: true, deployConfig: true },
            }),
          ]
        : []),
      viteReact(),
    ],
  };
});

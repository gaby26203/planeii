import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import appCss from "../styles.css?url";
import { AppLayout } from "@/components/AppLayout";
import { AccessProvider } from "@/lib/access";
import { Toaster } from "@/components/ui/sonner";
// (useTripsStore ya no se hidrata desde el root — ver `_authenticated/route.tsx`)
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La página que buscas no existe o fue movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PLANEI OS — Gestión de Viajes Grupales" },
      {
        name: "description",
        content: "Plataforma de gestión operativa para viajes grupales de mujeres",
      },
      { property: "og:title", content: "PLANEI OS — Gestión de Viajes Grupales" },
      { name: "twitter:title", content: "PLANEI OS — Gestión de Viajes Grupales" },
      {
        property: "og:description",
        content: "Plataforma de gestión operativa para viajes grupales de mujeres",
      },
      {
        name: "twitter:description",
        content: "Plataforma de gestión operativa para viajes grupales de mujeres",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/494b2cd7-5811-42c7-a5ae-1105e8dc6aa6/id-preview-b9d10cea--e3d19316-27e6-4085-9c2f-85d829b6c97a.lovable.app-1783135572483.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/494b2cd7-5811-42c7-a5ae-1105e8dc6aa6/id-preview-b9d10cea--e3d19316-27e6-4085-9c2f-85d829b6c97a.lovable.app-1783135572483.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Manrope:wght@400;500;600;700&family=DM+Serif+Display&family=Outfit:wght@300;400;500&family=Work+Sans:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const PUBLIC_ROUTES = new Set(["/auth", "/reset-password"]);

function RootComponent() {
  const location = useLocation();
  const router = useRouter();
  const { queryClient } = Route.useRouteContext();
  const isPublic = PUBLIC_ROUTES.has(location.pathname) || location.pathname === "/preview" || location.pathname.startsWith("/v/");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const content = isPublic ? (
    <>
      <Outlet />
      <Toaster />
    </>
  ) : (
    <AccessProvider>
      <AppLayout>
        <Outlet />
        <Toaster />
      </AppLayout>
    </AccessProvider>
  );

  return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
}

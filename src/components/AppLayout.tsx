import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useLocation } from "@tanstack/react-router";

const SECTION_TITLES: { match: (path: string) => boolean; title: string }[] = [
  { match: (p) => p === "/", title: "Mis viajes" },
  { match: (p) => p.startsWith("/viajes"), title: "Viaje" },
  { match: (p) => p.startsWith("/itinerarios"), title: "Itinerarios" },
  { match: (p) => p.startsWith("/proveedores"), title: "Proveedores" },
  { match: (p) => p.startsWith("/finanzas"), title: "Finanzas" },
  { match: (p) => p.startsWith("/pagos"), title: "Pagos" },
  { match: (p) => p.startsWith("/reportes"), title: "Reportes" },
  { match: (p) => p.startsWith("/crm"), title: "CRM" },
  { match: (p) => p.startsWith("/accesos"), title: "Gestión de accesos" },
  { match: (p) => p.startsWith("/ajustes"), title: "Ajustes y plantillas" },
  { match: (p) => p.startsWith("/papelera"), title: "Papelera" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const title = SECTION_TITLES.find((s) => s.match(pathname))?.title ?? "PLANEI OS";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 border-b border-border px-2 sm:px-4 bg-card/50 backdrop-blur-sm">
            <SidebarTrigger className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground" />
            <span className="md:hidden min-w-0 truncate font-display text-sm font-semibold text-foreground">
              {title}
            </span>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

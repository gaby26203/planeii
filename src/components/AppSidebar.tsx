import {
  Map,
  CalendarDays,
  Building2,
  DollarSign,
  Users,
  CreditCard,
  BarChart3,
  Compass,
  LogOut,
  User as UserIcon,
  Shield,
  ShieldCheck,
  Settings,
  Trash2,

} from "lucide-react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions, useAccess } from "@/lib/access";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Viajes", url: "/", icon: Map },
  { title: "Itinerarios", url: "/itinerarios", icon: CalendarDays },
  { title: "Proveedores", url: "/proveedores", icon: Building2 },
];

const financeNav = [
  { title: "Finanzas", url: "/finanzas", icon: DollarSign },
  { title: "Pagos", url: "/pagos", icon: CreditCard },
  { title: "Reportes", url: "/reportes", icon: BarChart3 },
];

const crmNav = [
  { title: "CRM", url: "/crm", icon: Users },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const perms = usePermissions();
  const { isOwner } = useAccess();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const visibleMain = mainNav.filter((item) => {
    if (item.url === "/") return true;
    if (item.url === "/itinerarios" || item.url === "/proveedores") return perms.canSeeGlobalOps;
    return true;
  });
  const visibleFinance = financeNav.filter((item) => {
    if (item.url === "/finanzas") return perms.canSeeGlobalFinanzas;
    if (item.url === "/pagos") return perms.canSeeGlobalPagos;
    if (item.url === "/reportes") return perms.canSeeGlobalReportes;
    return true;
  });
  const visibleCrm = crmNav.filter((item) => {
    if (item.url === "/crm") return perms.canSeeGlobalCrm;
    return true;
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      const meta = data.user?.user_metadata as { display_name?: string; full_name?: string } | undefined;
      setDisplayName(meta?.display_name ?? meta?.full_name ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user.email ?? null);
      const meta = session?.user.user_metadata as { display_name?: string; full_name?: string } | undefined;
      setDisplayName(meta?.display_name ?? meta?.full_name ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (displayName || email || "?")
    .split(/\s+|@/)[0]
    .slice(0, 2)
    .toUpperCase();

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={closeOnMobile}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Compass className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-display text-lg font-semibold tracking-tight text-sidebar-foreground">
              PLANEI OS
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {visibleMain.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-sidebar-foreground/40">
              Operación
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url} onClick={closeOnMobile}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleFinance.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-sidebar-foreground/40">
              Finanzas
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleFinance.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url} onClick={closeOnMobile}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleCrm.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-sidebar-foreground/40">
              Comercial
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleCrm.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url} onClick={closeOnMobile}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>


      <SidebarFooter className="p-3 space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent transition-colors ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold shrink-0">
                {initials}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-sidebar-foreground truncate">
                    {displayName || email?.split("@")[0] || "Cuenta"}
                  </p>
                  {email && (
                    <p className="text-[10px] text-sidebar-foreground/50 truncate">{email}</p>
                  )}
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              <span className="truncate">{email || "Cuenta"}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isOwner && (
              <DropdownMenuItem asChild>
                <Link to="/accesos" onClick={closeOnMobile}>
                  <Shield className="h-4 w-4 mr-2" />
                  Gestión de accesos
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link to="/mis-accesos" onClick={closeOnMobile}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Mis accesos
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/ajustes" onClick={closeOnMobile}>
                <Settings className="h-4 w-4 mr-2" />
                Ajustes y plantillas
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/papelera" onClick={closeOnMobile}>
                <Trash2 className="h-4 w-4 mr-2" />
                Papelera
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />


            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {!collapsed && (
          <p className="text-[10px] text-sidebar-foreground/30 text-center">
            PLANEI OS MVP v1.0
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Shield,
  Users as UsersIcon,
  Mail,
  UserCog,
  Search,
  Copy,
  X,
  Trash2,
  Plus,
  Clock,
  CheckCircle2,
  Ban,
  ExternalLink,
  History,
  UserPlus,
  UserMinus,
  Pencil,
  ShieldCheck,
  ShieldOff,
  RefreshCw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccessGate } from "@/components/AccessGate";
import {
  listAllUsers,
  setOwnerRole,
  listAllInvitations,
  listAllMemberships,
  listAllTripsBasic,
  createGlobalInvitation,
  listAccessAudit,
} from "@/lib/admin-access.functions";
import { revokeTripInvitation } from "@/lib/trip-invitations.functions";
import { updateTripMember, removeTripMember } from "@/lib/trip-members.functions";
import {
  PERM_KEYS,
  PERM_LABELS,
  defaultsForRole,
  normalize,
  type TripPermMap,
} from "@/lib/trip-permissions";
import { useAccess } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/accesos")({
  component: () => (
    <AccessGate can="isOwner">
      <AccesosPage />
    </AccessGate>
  ),
});

type UserRow = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isOwner: boolean;
  lastSignInAt: string | null;
  createdAt: string;
};

type InvitationRow = {
  id: string;
  tripId: string;
  tripName: string;
  email: string;
  role: "organizadora" | "tour_leader";
  permissions: Record<string, boolean> | null;
  token: string;
  status: "pending" | "accepted" | "revoked";
  expired: boolean;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  invitedBy: string | null;
  invitedByEmail: string | null;
  invitedByName: string | null;
};

type MembershipRow = {
  id: string;
  tripId: string;
  tripName: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  role: "organizadora" | "tour_leader";
  permissions: Record<string, boolean> | null;
  createdAt: string;
};

type TripBasic = { id: string; name: string; status: string | null };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function relativeDays(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return `expiró hace ${Math.abs(days)}d`;
  if (days === 0) return "expira hoy";
  if (days === 1) return "expira mañana";
  return `expira en ${days}d`;
}

function AccesosPage() {
  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Gestión de accesos</h1>
          <p className="text-sm text-muted-foreground">
            Usuarios, invitaciones y membresías de toda la plataforma.
          </p>
        </div>
      </div>

      <Tabs defaultValue="usuarios" className="w-full">
        <TabsList>
          <TabsTrigger value="usuarios" className="gap-2">
            <UsersIcon className="h-4 w-4" /> Usuarios
          </TabsTrigger>
          <TabsTrigger value="invitaciones" className="gap-2">
            <Mail className="h-4 w-4" /> Invitaciones
          </TabsTrigger>
          <TabsTrigger value="membresias" className="gap-2">
            <UserCog className="h-4 w-4" /> Membresías
          </TabsTrigger>
          <TabsTrigger value="bitacora" className="gap-2">
            <History className="h-4 w-4" /> Bitácora
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-6">
          <UsersTab />
        </TabsContent>
        <TabsContent value="invitaciones" className="mt-6">
          <InvitationsTab />
        </TabsContent>
        <TabsContent value="membresias" className="mt-6">
          <MembershipsTab />
        </TabsContent>
        <TabsContent value="bitacora" className="mt-6">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Usuarios
// ============================================================
function UsersTab() {
  const { userId: currentUserId } = useAccess();
  const list = useServerFn(listAllUsers);
  const toggle = useServerFn(setOwnerRole);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ user: UserRow; isOwner: boolean } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const rows = await list();
      setUsers(rows as unknown as UserRow[]);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(s) ||
        (u.displayName ?? "").toLowerCase().includes(s),
    );
  }, [q, users]);

  async function confirmToggle() {
    if (!pending) return;
    setBusyId(pending.user.id);
    try {
      await toggle({ data: { userId: pending.user.id, isOwner: pending.isOwner } });
      toast.success(
        pending.isOwner ? "Rol owner asignado" : "Rol owner revocado",
      );
      setPending(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar el rol");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por email o nombre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {users.length}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Usuario</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Último ingreso</th>
              <th className="text-left px-4 py-2 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Sin usuarios.
                </td>
              </tr>
            )}
            {filtered.map((u) => {
              const initials = (u.displayName || u.email || "?")
                .split(/\s+|@/)[0]
                .slice(0, 2)
                .toUpperCase();
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center">
                        {initials}
                      </div>
                      <div>
                        <p className="font-medium">
                          {u.displayName || (u.email?.split("@")[0] ?? "Sin nombre")}
                          {isSelf && (
                            <span className="ml-2 text-[10px] text-muted-foreground">(vos)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{fmtDate(u.lastSignInAt)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={u.isOwner}
                        disabled={busyId === u.id}
                        onCheckedChange={(v) =>
                          setPending({ user: u, isOwner: Boolean(v) })
                        }
                      />
                      {u.isOwner && (
                        <Badge variant="secondary" className="text-[10px]">
                          Owner
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!pending} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.isOwner ? "Asignar rol owner" : "Revocar rol owner"}
            </DialogTitle>
            <DialogDescription>
              {pending?.isOwner ? (
                <>
                  <strong>{pending?.user.email}</strong> tendrá acceso total a todos los
                  viajes, finanzas y este panel de accesos.
                </>
              ) : (
                <>
                  <strong>{pending?.user.email}</strong> dejará de tener rol de owner
                  global. Mantendrá sus membresías individuales por viaje.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmToggle} disabled={busyId === pending?.user.id}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Invitaciones
// ============================================================
function InvitationsTab() {
  const list = useServerFn(listAllInvitations);
  const listTrips = useServerFn(listAllTripsBasic);
  const revoke = useServerFn(revokeTripInvitation);

  const [rows, setRows] = useState<InvitationRow[]>([]);
  const [trips, setTrips] = useState<TripBasic[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "accepted" | "expired" | "revoked"
  >("all");
  const [tripFilter, setTripFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [invs, tps] = await Promise.all([list(), listTrips()]);
      setRows(invs as unknown as InvitationRow[]);
      setTrips(tps as unknown as TripBasic[]);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudieron cargar las invitaciones");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tripFilter !== "all" && r.tripId !== tripFilter) return false;
      if (statusFilter === "all") return true;
      if (statusFilter === "expired") return r.expired;
      if (statusFilter === "pending") return r.status === "pending" && !r.expired;
      return r.status === statusFilter;
    });
  }, [rows, statusFilter, tripFilter]);

  async function copyLink(token: string) {
    const url = `${window.location.origin}/invitacion/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error(url);
    }
  }

  async function handleRevoke(inv: InvitationRow) {
    if (!confirm(`¿Revocar invitación a ${inv.email}?`)) return;
    setBusyId(inv.id);
    try {
      await revoke({ data: { id: inv.id } });
      toast.success("Invitación revocada");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo revocar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="accepted">Aceptadas</SelectItem>
            <SelectItem value="expired">Expiradas</SelectItem>
            <SelectItem value="revoked">Revocadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tripFilter} onValueChange={setTripFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los viajes</SelectItem>
            {trips.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">
          {filtered.length} de {rows.length}
        </div>
        <Button className="ml-auto" onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva invitación
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Viaje</th>
              <th className="text-left px-4 py-2 font-medium">Rol</th>
              <th className="text-left px-4 py-2 font-medium">Estado</th>
              <th className="text-left px-4 py-2 font-medium">Invitó</th>
              <th className="text-left px-4 py-2 font-medium">Creada</th>
              <th className="text-right px-4 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Sin invitaciones.
                </td>
              </tr>
            )}
            {filtered.map((inv) => (
              <tr key={inv.id} className="border-t align-middle">
                <td className="px-4 py-2 font-medium">{inv.email}</td>
                <td className="px-4 py-2">{inv.tripName}</td>
                <td className="px-4 py-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {inv.role === "organizadora" ? "Organizadora" : "Tour leader"}
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  <InvitationStatusBadge inv={inv} />
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {inv.invitedByName || inv.invitedByEmail || "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{fmtDate(inv.createdAt)}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {inv.status === "pending" && !inv.expired && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyLink(inv.token)}
                          className="h-8"
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" /> Link
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevoke(inv)}
                          disabled={busyId === inv.id}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Revocar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8" title="Abrir viaje">
                      <Link to="/viajes/$tripId" params={{ tripId: inv.tripId }}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GlobalInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        trips={trips}
        onCreated={load}
      />
    </div>
  );
}

function InvitationStatusBadge({ inv }: { inv: InvitationRow }) {
  if (inv.status === "accepted") {
    return (
      <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> Aceptada
      </Badge>
    );
  }
  if (inv.status === "revoked") {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Ban className="h-3 w-3" /> Revocada
      </Badge>
    );
  }
  if (inv.expired) {
    return (
      <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
        <Clock className="h-3 w-3" /> Expirada
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" /> {relativeDays(inv.expiresAt)}
    </Badge>
  );
}

function GlobalInviteDialog({
  open,
  onOpenChange,
  trips,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trips: TripBasic[];
  onCreated: () => Promise<void>;
}) {
  const create = useServerFn(createGlobalInvitation);
  const [tripId, setTripId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"organizadora" | "tour_leader">("tour_leader");
  const [perms, setPerms] = useState<TripPermMap>(defaultsForRole("tour_leader"));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPerms(defaultsForRole(role));
  }, [role]);

  useEffect(() => {
    if (open) {
      setTripId(trips[0]?.id ?? "");
      setEmail("");
      setRole("tour_leader");
    }
  }, [open, trips]);

  async function submit() {
    if (!tripId || !email.trim()) return;
    setBusy(true);
    try {
      const res = await create({
        data: {
          tripId,
          email: email.trim().toLowerCase(),
          role,
          permissions: perms,
        },
      });
      const url = `${window.location.origin}/invitacion/${(res as any).token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(
          (res as any).reused
            ? "Invitación actualizada. Link copiado."
            : "Invitación creada. Link copiado.",
        );
      } catch {
        toast.success("Invitación creada.");
      }
      onOpenChange(false);
      await onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear la invitación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Nueva invitación
          </DialogTitle>
          <DialogDescription>
            El link es válido por 7 días y se copia al portapapeles al crear.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Viaje</Label>
              <Select value={tripId} onValueChange={setTripId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí un viaje" />
                </SelectTrigger>
                <SelectContent>
                  {trips.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rol base</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organizadora">Organizadora</SelectItem>
                  <SelectItem value="tour_leader">Tour leader</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              placeholder="colaboradora@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <PermsChecklist value={perms} onChange={setPerms} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy || !tripId || !email.trim()}>
            {busy ? "Creando…" : "Crear invitación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Membresías
// ============================================================
function MembershipsTab() {
  const list = useServerFn(listAllMemberships);
  const listTrips = useServerFn(listAllTripsBasic);
  const update = useServerFn(updateTripMember);
  const remove = useServerFn(removeTripMember);

  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [trips, setTrips] = useState<TripBasic[]>([]);
  const [loading, setLoading] = useState(false);
  const [tripFilter, setTripFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MembershipRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [mem, tps] = await Promise.all([list(), listTrips()]);
      setRows(mem as unknown as MembershipRow[]);
      setTrips(tps as unknown as TripBasic[]);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudieron cargar las membresías");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (tripFilter !== "all" && r.tripId !== tripFilter) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      return true;
    });
  }, [rows, tripFilter, roleFilter]);

  async function handleRemove(m: MembershipRow) {
    if (!confirm(`¿Quitar a ${m.displayName || m.email} del viaje "${m.tripName}"?`)) return;
    setBusyId(m.id);
    try {
      await remove({ data: { id: m.id } });
      toast.success("Miembro eliminado");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(nextRole: "organizadora" | "tour_leader", nextPerms: TripPermMap) {
    if (!editing) return;
    setBusyId(editing.id);
    try {
      await update({ data: { id: editing.id, role: nextRole, permissions: nextPerms } });
      toast.success("Membresía actualizada");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={tripFilter} onValueChange={setTripFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los viajes</SelectItem>
            {trips.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="organizadora">Organizadora</SelectItem>
            <SelectItem value="tour_leader">Tour leader</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">
          {filtered.length} de {rows.length}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Usuario</th>
              <th className="text-left px-4 py-2 font-medium">Viaje</th>
              <th className="text-left px-4 py-2 font-medium">Rol</th>
              <th className="text-left px-4 py-2 font-medium">Permisos</th>
              <th className="text-left px-4 py-2 font-medium">Desde</th>
              <th className="text-right px-4 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Sin membresías.
                </td>
              </tr>
            )}
            {filtered.map((m) => {
              const effective = normalize(m.permissions, m.role);
              const activeCount = Object.values(effective).filter(Boolean).length;
              const total = PERM_KEYS.length;
              const custom = m.permissions !== null;
              return (
                <tr key={m.id} className="border-t">
                  <td className="px-4 py-2">
                    <p className="font-medium">
                      {m.displayName || (m.email?.split("@")[0] ?? m.userId)}
                    </p>
                    {m.email && (
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-2">{m.tripName}</td>
                  <td className="px-4 py-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {m.role === "organizadora" ? "Organizadora" : "Tour leader"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {activeCount}/{total}
                    {custom && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{fmtDate(m.createdAt)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(m)}
                        className="h-8"
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(m)}
                        disabled={busyId === m.id}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        title="Quitar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <EditMembershipDialog
        member={editing}
        onOpenChange={(v) => !v && setEditing(null)}
        onSave={saveEdit}
        busy={!!busyId && busyId === editing?.id}
      />
    </div>
  );
}

function EditMembershipDialog({
  member,
  onOpenChange,
  onSave,
  busy,
}: {
  member: MembershipRow | null;
  onOpenChange: (v: boolean) => void;
  onSave: (role: "organizadora" | "tour_leader", perms: TripPermMap) => Promise<void>;
  busy: boolean;
}) {
  const [role, setRole] = useState<"organizadora" | "tour_leader">("tour_leader");
  const [perms, setPerms] = useState<TripPermMap>(defaultsForRole("tour_leader"));

  useEffect(() => {
    if (member) {
      setRole(member.role);
      setPerms(normalize(member.permissions, member.role));
    }
  }, [member]);

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar membresía</DialogTitle>
          <DialogDescription>
            {member?.displayName || member?.email} — {member?.tripName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Rol base</Label>
            <Select
              value={role}
              onValueChange={(v) => {
                const next = v as "organizadora" | "tour_leader";
                setRole(next);
                setPerms(defaultsForRole(next));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="organizadora">Organizadora</SelectItem>
                <SelectItem value="tour_leader">Tour leader</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PermsChecklist value={perms} onChange={setPerms} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(role, perms)} disabled={busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Checklist compartido
// ============================================================
function PermsChecklist({
  value,
  onChange,
}: {
  value: TripPermMap;
  onChange: (next: TripPermMap) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {PERM_KEYS.map((k) => {
        const meta = PERM_LABELS[k];
        const checked = value[k];
        return (
          <label
            key={k}
            className="flex items-start gap-2 rounded-md border border-transparent hover:border-border hover:bg-muted/50 px-2 py-1.5 cursor-pointer transition-colors"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => onChange({ ...value, [k]: Boolean(v) })}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium leading-tight">{meta.title}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{meta.desc}</p>
            </div>
          </label>
        );
      })}
    </div>
  );
}

// ============================================================
// Bitácora de accesos
// ============================================================
type AuditRow = {
  id: string;
  action: string;
  createdAt: string;
  tripId: string | null;
  tripName: string | null;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  targetName: string | null;
  details: Record<string, any>;
};

const ACTION_META: Record<
  string,
  { label: string; icon: any; tone: string }
> = {
  member_added: {
    label: "Miembro agregado",
    icon: UserPlus,
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  member_updated: {
    label: "Miembro editado",
    icon: Pencil,
    tone: "text-amber-600 dark:text-amber-400",
  },
  member_removed: {
    label: "Miembro removido",
    icon: UserMinus,
    tone: "text-destructive",
  },
  invitation_created: {
    label: "Invitación creada",
    icon: Mail,
    tone: "text-primary",
  },
  invitation_updated: {
    label: "Invitación actualizada",
    icon: RefreshCw,
    tone: "text-amber-600 dark:text-amber-400",
  },
  invitation_revoked: {
    label: "Invitación revocada",
    icon: Ban,
    tone: "text-muted-foreground",
  },
  invitation_accepted: {
    label: "Invitación aceptada",
    icon: CheckCircle2,
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  owner_granted: {
    label: "Owner otorgado",
    icon: ShieldCheck,
    tone: "text-primary",
  },
  owner_revoked: {
    label: "Owner revocado",
    icon: ShieldOff,
    tone: "text-destructive",
  },
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeDetails(action: string, details: Record<string, any>): string | null {
  if (!details || typeof details !== "object") return null;
  const parts: string[] = [];
  if (action === "member_updated" && details.from && details.to) {
    const from = details.from as any;
    const to = details.to as any;
    if (from.role !== to.role) {
      parts.push(`rol ${from.role} → ${to.role}`);
    }
    const fromPerms = from.permissions ?? null;
    const toPerms = to.permissions ?? null;
    if (JSON.stringify(fromPerms) !== JSON.stringify(toPerms)) {
      parts.push("permisos actualizados");
    }
  } else {
    if (typeof details.role === "string") parts.push(`rol: ${details.role}`);
    if (typeof details.source === "string") parts.push(`origen: ${details.source}`);
    if (typeof details.via === "string") parts.push(`vía: ${details.via}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

function AuditTab() {
  const list = useServerFn(listAccessAudit);
  const listTrips = useServerFn(listAllTripsBasic);

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [trips, setTrips] = useState<TripBasic[]>([]);
  const [loading, setLoading] = useState(false);
  const [tripFilter, setTripFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [audit, tps] = await Promise.all([list({ data: { limit: 300 } }), listTrips()]);
      setRows(audit as unknown as AuditRow[]);
      setTrips(tps as unknown as TripBasic[]);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cargar la bitácora");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tripFilter === "none" && r.tripId) return false;
      if (tripFilter !== "all" && tripFilter !== "none" && r.tripId !== tripFilter) return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (!s) return true;
      return (
        (r.targetEmail ?? "").toLowerCase().includes(s) ||
        (r.targetName ?? "").toLowerCase().includes(s) ||
        (r.actorEmail ?? "").toLowerCase().includes(s) ||
        (r.tripName ?? "").toLowerCase().includes(s)
      );
    });
  }, [rows, tripFilter, actionFilter, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por email, viaje…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las acciones</SelectItem>
            {Object.entries(ACTION_META).map(([k, m]) => (
              <SelectItem key={k} value={k}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tripFilter} onValueChange={setTripFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los viajes</SelectItem>
            <SelectItem value="none">Sin viaje (rol owner)</SelectItem>
            {trips.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">
          {filtered.length} de {rows.length}
        </div>
        <Button variant="outline" size="sm" className="ml-auto h-9" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refrescar
        </Button>
      </div>

      {loading && rows.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Cargando…
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Sin registros que coincidan con los filtros.
        </div>
      )}

      <ol className="relative border-l border-border/60 ml-3 space-y-3">
        {filtered.map((r) => {
          const meta = ACTION_META[r.action] ?? {
            label: r.action,
            icon: History,
            tone: "text-muted-foreground",
          };
          const Icon = meta.icon;
          const summary = summarizeDetails(r.action, r.details);
          const target =
            r.targetName || r.targetEmail || (r.targetUserId ? "Usuario" : null);
          const actor =
            r.actorName || r.actorEmail || (r.actorId ? "Usuario" : "Sistema");
          return (
            <li key={r.id} className="ml-4">
              <span
                className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-background border ${meta.tone}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="rounded-lg border bg-card px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className={`text-sm font-medium ${meta.tone}`}>{meta.label}</span>
                  {target && (
                    <span className="text-sm text-foreground">
                      · {target}
                    </span>
                  )}
                  {r.tripName && (
                    <Badge variant="secondary" className="text-[10px]">
                      {r.tripName}
                    </Badge>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {fmtDateTime(r.createdAt)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Por <span className="text-foreground/80">{actor}</span>
                  {summary && <> · {summary}</>}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}


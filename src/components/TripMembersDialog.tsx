import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Plus, Trash2, ShieldCheck, Copy, Mail, X, Clock, Pencil, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listTripMembers,
  updateTripMember,
  removeTripMember,
} from "@/lib/trip-members.functions";
import {
  listTripInvitations,
  createTripInvitation,
  revokeTripInvitation,
} from "@/lib/trip-invitations.functions";
import {
  PERM_KEYS,
  PERM_LABELS,
  defaultsForRole,
  normalize,
  type TripPermMap,
} from "@/lib/trip-permissions";
import { updateMemberDisplayName } from "@/lib/profile-name.functions";
import { useAccess } from "@/lib/access";
import { createDialogShortcuts } from "@/hooks/use-submit-on-enter";

type Member = {
  id: string;
  userId: string;
  role: "organizadora" | "tour_leader";
  permissions: TripPermMap | null;
  email: string | null;
  displayName: string | null;
};

type Invitation = {
  id: string;
  email: string;
  role: "organizadora" | "tour_leader";
  permissions: Record<string, boolean> | null;
  token: string;
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

function inviteUrl(token: string) {
  return `${window.location.origin}/invitacion/${token}`;
}

function relativeDays(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return `expiró hace ${Math.abs(days)}d`;
  if (days === 0) return "expira hoy";
  if (days === 1) return "expira mañana";
  return `expira en ${days}d`;
}


interface Props {
  tripId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function TripMembersDialog({ tripId, open, onOpenChange }: Props) {
  const { refresh } = useAccess();
  const list = useServerFn(listTripMembers);
  const update = useServerFn(updateTripMember);
  const remove = useServerFn(removeTripMember);
  const listInv = useServerFn(listTripInvitations);
  const createInv = useServerFn(createTripInvitation);
  const revokeInv = useServerFn(revokeTripInvitation);
  const renameMember = useServerFn(updateMemberDisplayName);

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Alta
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"organizadora" | "tour_leader">("tour_leader");
  const [newPerms, setNewPerms] = useState<TripPermMap>(defaultsForRole("tour_leader"));
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [m, inv] = await Promise.all([
        list({ data: { tripId } }),
        listInv({ data: { tripId } }).catch(() => [] as Invitation[]),
      ]);
      setMembers(m as unknown as Member[]);
      setInvitations(inv as unknown as Invitation[]);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudieron cargar los miembros");
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tripId]);

  useEffect(() => {
    setNewPerms(defaultsForRole(newRole));
  }, [newRole]);

  async function handleInvite() {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const res = await createInv({
        data: {
          tripId,
          email: newEmail.trim().toLowerCase(),
          role: newRole,
          permissions: newPerms,
        },
      });
      const url = inviteUrl((res as any).token);
      try {
        await navigator.clipboard.writeText(url);
        toast.success(
          (res as any).reused
            ? "Invitación actualizada. Link copiado."
            : "Invitación creada. Link copiado al portapapeles.",
        );
      } catch {
        toast.success("Invitación creada. Copiá el link desde la lista.");
      }
      setNewEmail("");
      setNewRole("tour_leader");
      setNewPerms(defaultsForRole("tour_leader"));
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear la invitación");
    } finally {
      setAdding(false);
    }
  }

  async function copyLink(token: string) {
    const url = inviteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error(url);
    }
  }

  async function handleRevoke(inv: Invitation) {
    if (!confirm(`¿Revocar invitación a ${inv.email}?`)) return;
    setBusyId(inv.id);
    try {
      await revokeInv({ data: { id: inv.id } });
      toast.success("Invitación revocada");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo revocar");
    } finally {
      setBusyId(null);
    }
  }

  async function saveMember(m: Member, patch: Partial<Pick<Member, "role" | "permissions">>) {
    setBusyId(m.id);
    const nextRole = patch.role ?? m.role;
    const nextPerms = patch.permissions ?? m.permissions ?? defaultsForRole(nextRole);
    // Optimistic update
    setMembers((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, role: nextRole, permissions: nextPerms } : x)),
    );
    try {
      await update({ data: { id: m.id, role: nextRole, permissions: nextPerms } });
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(m: Member, name: string) {
    const next = name.trim();
    if (!next || next === (m.displayName ?? "")) return;
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, displayName: next } : x)));
    try {
      await renameMember({ data: { userId: m.userId, displayName: next } });
      toast.success("Nombre actualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar el nombre");
      await load();
    }
  }

  async function handleRemove(m: Member) {
    if (!confirm(`¿Quitar a ${m.displayName || m.email} del viaje?`)) return;
    setBusyId(m.id);
    try {
      await remove({ data: { id: m.id } });
      toast.success("Miembro eliminado");
      await load();
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  }

  const pendingInvites = invitations.filter((i) => i.status === "pending");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
        onKeyDown={createDialogShortcuts({
          onSubmit: () => { if (!adding && newEmail.trim()) handleInvite(); },
          onCancel: () => onOpenChange(false),
          canSubmit: !adding && !!newEmail.trim(),
        })}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Miembros del viaje
          </DialogTitle>
          <DialogDescription>
            Invitá por email. El link es válido por 7 días y se copia automáticamente al portapapeles.
          </DialogDescription>
        </DialogHeader>

        {/* Formulario de invitación */}
        <div className="rounded-lg border bg-secondary/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="h-4 w-4" /> Invitar por email
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="colaboradora@ejemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rol base</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="organizadora">Organizadora</SelectItem>
                  <SelectItem value="tour_leader">Tour leader</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <PermsChecklist value={newPerms} onChange={setNewPerms} />
          <div className="flex justify-end">
            <Button onClick={handleInvite} disabled={adding || !newEmail.trim()}>
              {adding ? "Creando…" : (<><Plus className="h-4 w-4 mr-1" /> Crear invitación</>)}
            </Button>
          </div>
        </div>

        {/* Invitaciones pendientes */}
        {pendingInvites.length > 0 && (
          <div className="space-y-2 mt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Invitaciones pendientes ({pendingInvites.length})
            </p>
            {pendingInvites.map((inv) => {
              const expired = new Date(inv.expiresAt).getTime() < Date.now();
              return (
                <div
                  key={inv.id}
                  className="rounded-lg border p-3 flex items-center justify-between gap-3 bg-background"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{inv.email}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {inv.role === "organizadora" ? "Organizadora" : "Tour leader"}
                      </Badge>
                      <span className={`text-[10px] flex items-center gap-1 ${expired ? "text-destructive" : "text-muted-foreground"}`}>
                        <Clock className="h-3 w-3" /> {relativeDays(inv.expiresAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
                      title="Revocar invitación"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}


        {/* Lista */}
        <div className="space-y-3 mt-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Cargando miembros…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Todavía no hay miembros asignados a este viaje.
            </p>
          ) : (
            members.map((m) => {
              const effective = normalize(m.permissions, m.role);
              const isCustom = m.permissions !== null;
              return (
                <div key={m.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <MemberNameEditor
                        value={m.displayName}
                        fallback={m.email || m.userId}
                        onSave={(name) => handleRename(m, name)}
                      />
                      {m.email && m.displayName && (
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {m.role === "organizadora" ? "Organizadora" : "Tour leader"}
                        </Badge>
                        {isCustom && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <ShieldCheck className="h-3 w-3" /> Permisos personalizados
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={m.role}
                        onValueChange={(v) => saveMember(m, { role: v as any, permissions: defaultsForRole(v as any) })}
                        disabled={busyId === m.id}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="organizadora">Organizadora</SelectItem>
                          <SelectItem value="tour_leader">Tour leader</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(m)}
                        disabled={busyId === m.id}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <PermsChecklist
                    value={effective}
                    onChange={(next) => saveMember(m, { permissions: next })}
                  />
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberNameEditor({
  value,
  fallback,
  onSave,
}: {
  value: string | null;
  fallback: string;
  onSave: (name: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  const commit = async () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== (value ?? "")) await onSave(draft);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={draft}
          maxLength={60}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setDraft(value ?? "");
              setEditing(false);
            }
          }}
          className="h-7 text-sm"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void commit()}>
          <Check className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1.5 text-left"
      title="Editar nombre"
    >
      <span className="font-medium truncate">{value || fallback}</span>
      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
    </button>
  );
}

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

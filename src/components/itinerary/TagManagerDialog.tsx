import { useState, useMemo } from "react";
import { Trash2, Plus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  TAG_COLOR_CLASSES,
  TAG_COLOR_KEYS,
  isDuplicateTagLabel,
  normalizeTagLabel,
  type TagColorKey,
  type TripTag,
} from "@/lib/tags";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tags: TripTag[];
  usageCounts: Map<string, number>;
  onAdd: (label: string, colorKey: TagColorKey) => TripTag | null;
  onUpdate: (
    tagId: string,
    patch: Partial<Pick<TripTag, "label" | "colorKey">>,
  ) => boolean;
  onRemove: (
    tagId: string,
    mode: { kind: "toText" } | { kind: "replace"; withTagId: string },
  ) => void;
}

export function TagManagerDialog({
  open,
  onOpenChange,
  tags,
  usageCounts,
  onAdd,
  onUpdate,
  onRemove,
}: Props) {
  const [search, setSearch] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<TagColorKey>("terracotta");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TripTag | null>(null);
  const [replaceWith, setReplaceWith] = useState<string>("");

  const filtered = useMemo(() => {
    const q = normalizeTagLabel(search);
    if (!q) return tags;
    return tags.filter((t) => normalizeTagLabel(t.label).includes(q));
  }, [search, tags]);

  function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    if (isDuplicateTagLabel(tags, label)) {
      toast.error("Ese tag ya existe");
      return;
    }
    const created = onAdd(label, newColor);
    if (!created) {
      toast.error("No se pudo crear el tag");
      return;
    }
    setNewLabel("");
    toast.success(`Tag "${created.label}" creado`);
  }

  function handleSaveEdit(tag: TripTag) {
    const label = editDraft.trim();
    if (!label) return;
    if (normalizeTagLabel(label) === normalizeTagLabel(tag.label)) {
      setEditingId(null);
      return;
    }
    const ok = onUpdate(tag.id, { label });
    if (!ok) {
      toast.error("Ese tag ya existe o el nombre es inválido");
      return;
    }
    setEditingId(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const usage = usageCounts.get(deleteTarget.id) ?? 0;
    if (usage > 0 && replaceWith && replaceWith !== "__toText__") {
      onRemove(deleteTarget.id, { kind: "replace", withTagId: replaceWith });
    } else {
      onRemove(deleteTarget.id, { kind: "toText" });
    }
    toast.success(`Tag "${deleteTarget.label}" eliminado`);
    setDeleteTarget(null);
    setReplaceWith("");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gestionar tags</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tags…"
              className="pl-8"
            />
          </div>

          <div className="rounded-md border border-border/60 p-3 space-y-2">
            <Label className="text-xs">Nuevo tag</Label>
            <div className="flex gap-2">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="Nombre del tag"
                className="flex-1"
              />
              <ColorPicker value={newColor} onChange={setNewColor} />
              <Button type="button" size="sm" onClick={handleAdd}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Crear
              </Button>
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto -mx-2 px-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No hay tags que coincidan.
              </p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((t) => {
                  const colors = TAG_COLOR_CLASSES[t.colorKey];
                  const usage = usageCounts.get(t.id) ?? 0;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-secondary/40"
                    >
                      <ColorPicker
                        value={t.colorKey}
                        onChange={(c) => onUpdate(t.id, { colorKey: c })}
                        compact
                      />
                      {editingId === t.id ? (
                        <Input
                          autoFocus
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          onBlur={() => handleSaveEdit(t)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveEdit(t);
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                          className="h-7 flex-1 text-sm"
                        />
                      ) : (
                        <button
                          type="button"
                          className={cn(
                            "flex-1 text-left rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
                            colors.bg,
                            colors.text,
                          )}
                          onClick={() => {
                            setEditingId(t.id);
                            setEditDraft(t.label);
                          }}
                          title="Editar nombre"
                        >
                          {t.label}
                        </button>
                      )}
                      <span className="text-[11px] text-muted-foreground min-w-[80px] text-right">
                        {usage === 0
                          ? "sin uso"
                          : usage === 1
                            ? "1 fila"
                            : `${usage} filas`}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setDeleteTarget(t);
                          setReplaceWith("__toText__");
                        }}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar tag "{deleteTarget?.label}"</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const usage = deleteTarget ? usageCounts.get(deleteTarget.id) ?? 0 : 0;
                if (usage === 0) return "Este tag no está siendo usado en ninguna fila.";
                return `Este tag está en uso en ${usage} ${usage === 1 ? "fila" : "filas"}. Elegí qué hacer con las apariciones existentes:`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (usageCounts.get(deleteTarget.id) ?? 0) > 0 && (
            <div className="space-y-2 py-2">
              <Label className="text-xs">Al eliminar…</Label>
              <Select value={replaceWith} onValueChange={setReplaceWith}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__toText__">
                    Convertir a texto plano (mantiene "{deleteTarget.label}")
                  </SelectItem>
                  {tags
                    .filter((t) => t.id !== deleteTarget.id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        Reemplazar por {t.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ColorPicker({
  value,
  onChange,
  compact,
}: {
  value: TagColorKey;
  onChange: (c: TagColorKey) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-1", compact && "shrink-0")}>
      {TAG_COLOR_KEYS.map((k) => {
        const active = k === value;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={cn(
              "h-4 w-4 rounded-full transition-all",
              TAG_COLOR_CLASSES[k].swatch,
              active ? "ring-2 ring-offset-1 ring-foreground/60 scale-110" : "opacity-70 hover:opacity-100",
            )}
            title={k}
            aria-label={`Color ${k}`}
          />
        );
      })}
    </div>
  );
}

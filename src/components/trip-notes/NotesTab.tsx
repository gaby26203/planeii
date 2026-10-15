import { useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Pencil,
  BookOpen,
  Trash2,
  ListChecks,
  StickyNote,
  FileText,
  Link as LinkIcon,
  Download,
  ExternalLink,
  Copy,
  SlidersHorizontal,
  ChevronDown,
  User,
  Calendar,
  CheckCircle2,
  CheckSquare,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  listTripNotes,
  upsertTodo,
  upsertNote,
  upsertDocument,
  deleteTodo,
  reorderTodos,
  reorderNotes,
  deleteNote,
  deleteDocument,
  togglePin,
  getSignedDocumentUrl,
  type TripTodo,
  type TripNote,
  type TripDocument,
} from "@/lib/trip-notes.functions";
import { EditItemDialog } from "./EditItemDialog";
import { AddLinkDialog } from "./AddLinkDialog";
import { UploadDocumentDialog } from "./UploadDocumentDialog";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { InlineEditableTitle } from "./InlineEditableTitle";
import { InlineEditableDescription } from "./InlineEditableDescription";
import { AssigneeSelect } from "./AssigneeSelect";
import { TodoDatesCell } from "./TodoDatesCell";

import { cn } from "@/lib/utils";

interface NotesTabProps {
  tripId: string;
}

type Filters = {
  q: string;
  type: "all" | "todo" | "note" | "document";
  status: "all" | "pendiente" | "completado";
  author: string;
  pinned: "all" | "pinned";
  sort: "recent" | "oldest";
};

const defaultFilters: Filters = {
  q: "",
  type: "all",
  status: "all",
  author: "all",
  pinned: "all",
  sort: "recent",
};

export function NotesTab({ tripId }: NotesTabProps) {
  const qc = useQueryClient();
  const list = useServerFn(listTripNotes);
  const queryKey = ["trip-notes", tripId] as const;

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => list({ data: { tripId } }),
  });

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);


  const upTodo = useServerFn(upsertTodo);
  const upNote = useServerFn(upsertNote);
  const upDoc = useServerFn(upsertDocument);
  const delTodo = useServerFn(deleteTodo);
  const delNote = useServerFn(deleteNote);
  const delDoc = useServerFn(deleteDocument);
  const pin = useServerFn(togglePin);
  const signedUrl = useServerFn(getSignedDocumentUrl);
  const navigate = useNavigate();

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const createTodo = useMutation({
    mutationFn: () => upTodo({ data: { trip_id: tripId, title: "Nuevo TO-DO" } }),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo crear."),
  });
  const createNote = useMutation({
    mutationFn: () => upNote({ data: { trip_id: tripId, title: "Nueva nota" } }),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo crear."),
  });

  const rawTodos = data?.todos ?? [];
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const reorder = useServerFn(reorderTodos);
  const todos = useMemo(() => {
    const idx = new Map<string, number>();
    (orderOverride ?? []).forEach((id, i) => idx.set(id, i));
    return [...rawTodos].sort((a, b) => {
      const ai = idx.has(a.id) ? idx.get(a.id)! : (a.sort_order ?? 0);
      const bi = idx.has(b.id) ? idx.get(b.id)! : (b.sort_order ?? 0);
      if (ai !== bi) return ai - bi;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [rawTodos, orderOverride]);

  const handleReorderTodos = async (groupIds: string[], activeId: string, overId: string) => {
    const from = groupIds.indexOf(activeId);
    const to = groupIds.indexOf(overId);
    if (from < 0 || to < 0 || from === to) return;
    const newGroup = [...groupIds];
    newGroup.splice(to, 0, newGroup.splice(from, 1)[0]!);
    const fullIds = todos.map((t) => t.id);
    const slots = fullIds.reduce<number[]>((acc, id, i) => (groupIds.includes(id) ? [...acc, i] : acc), []);
    slots.forEach((slot, i) => { fullIds[slot] = newGroup[i]!; });
    setOrderOverride(fullIds);
    try {
      await reorder({ data: { trip_id: tripId, ids: fullIds } });
      await invalidate();
    } catch (e: any) {
      setOrderOverride(null);
      toast.error(e?.message ?? "No se pudo reordenar.");
    }
  };

  const rawNotes = data?.notes ?? [];
  const [notesOrderOverride, setNotesOrderOverride] = useState<string[] | null>(null);
  const reorderNotesFn = useServerFn(reorderNotes);
  const notes = useMemo(() => {
    const idx = new Map<string, number>();
    (notesOrderOverride ?? []).forEach((id, i) => idx.set(id, i));
    return [...rawNotes].sort((a, b) => {
      const ai = idx.has(a.id) ? idx.get(a.id)! : (a.sort_order ?? 0);
      const bi = idx.has(b.id) ? idx.get(b.id)! : (b.sort_order ?? 0);
      if (ai !== bi) return ai - bi;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [rawNotes, notesOrderOverride]);

  const handleReorderNotes = async (groupIds: string[], activeId: string, overId: string) => {
    const from = groupIds.indexOf(activeId);
    const to = groupIds.indexOf(overId);
    if (from < 0 || to < 0 || from === to) return;
    const newGroup = [...groupIds];
    newGroup.splice(to, 0, newGroup.splice(from, 1)[0]!);
    const fullIds = notes.map((n) => n.id);
    const slots = fullIds.reduce<number[]>((acc, id, i) => (groupIds.includes(id) ? [...acc, i] : acc), []);
    slots.forEach((slot, i) => { fullIds[slot] = newGroup[i]!; });
    setNotesOrderOverride(fullIds);
    try {
      await reorderNotesFn({ data: { trip_id: tripId, ids: fullIds } });
      await invalidate();
    } catch (e: any) {
      setNotesOrderOverride(null);
      toast.error(e?.message ?? "No se pudo reordenar.");
    }
  };

  const documents = data?.documents ?? [];

  const authorsMap = useMemo(() => {
    const m = new Map<string, string>();
    [...todos, ...notes, ...documents].forEach((r) => {
      if (r.created_by && r.author_name) m.set(r.created_by, r.author_name);
    });
    return m;
  }, [todos, notes, documents]);

  const passesCommon = (r: {
    title: string; short_description: string | null; is_pinned: boolean;
    created_by: string; created_at: string;
  }) => {
    if (filters.q) {
      const q = filters.q.toLowerCase();
      if (!(r.title.toLowerCase().includes(q) || (r.short_description ?? "").toLowerCase().includes(q))) return false;
    }
    if (filters.author !== "all" && r.created_by !== filters.author) return false;
    if (filters.pinned === "pinned" && !r.is_pinned) return false;
    return true;
  };
  const passesStatus = (s: "pendiente" | "completado") =>
    filters.status === "all" || filters.status === s;
  const sortItems = <T extends { created_at: string; is_pinned: boolean }>(arr: T[]) =>
    [...arr].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      const t = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return filters.sort === "recent" ? t : -t;
    });

  const shownTodos = todos.filter(
    (t) => (filters.type === "all" || filters.type === "todo") && passesCommon(t) && passesStatus(t.status),
  );
  const pendingTodos = shownTodos.filter((t) => t.status !== "completado");
  const completedTodos = shownTodos.filter((t) => t.status === "completado");

  // Orden manual (drag & drop) tiene prioridad sobre fecha
  const shownNotes = notes.filter(
    (n) => (filters.type === "all" || filters.type === "note") && passesCommon(n) && passesStatus(n.status),
  );
  const shownDocs = sortItems(
    documents.filter((d) => (filters.type === "all" || filters.type === "document") && passesCommon(d) && filters.status === "all"),
  );






  const handleToggleTodoStatus = async (t: TripTodo) => {
    try {
      await upTodo({
        data: {
          id: t.id, trip_id: tripId, title: t.title,
          short_description: t.short_description,
          status: t.status === "pendiente" ? "completado" : "pendiente",
        },
      });
      await invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar.");
    }
  };

  const handleTogglePin = async (
    table: "trip_todos" | "trip_notes" | "trip_documents", id: string, isPinned: boolean,
  ) => {
    try {
      await pin({ data: { table, id, is_pinned: !isPinned } });
      await invalidate();
    } catch (e: any) { toast.error(e?.message ?? "Error"); }
  };

  const handleOpenDoc = async (d: TripDocument) => {
    try {
      if (d.kind === "link" && d.url) { window.open(d.url, "_blank", "noopener"); return; }
      const res = await signedUrl({ data: { id: d.id } });
      window.open(res.url, "_blank", "noopener");
    } catch (e: any) { toast.error(e?.message ?? "No se pudo abrir."); }
  };

  const handleCopyLink = async (url: string | null) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch { toast.error("No se pudo copiar"); }
  };

  return (
    <div className="mt-6 grid gap-6">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="w-full sm:flex-1 sm:min-w-[220px]">
            <h2 className="font-display text-2xl sm:text-3xl leading-tight">Notas</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pendientes, notas y docs (cotizaciones, acuerdos, imágenes) del viaje
            </p>
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                placeholder="Buscar notas..."
                className="pl-9 h-10 w-full sm:w-[220px] rounded-lg"
              />
            </div>
            <FiltersMenu filters={filters} setFilters={setFilters} authors={authorsMap} />
          </div>
        </div>

        {/* TO-DO's */}
        <SectionShell
          icon={<ListChecks className="h-4 w-4" />}
          title="TO-DO's"
          count={pendingTodos.length}
          isLoading={isLoading}
          empty={todos.length === 0 ? "Todavía no hay TO-DO's para este viaje." : "Ningún TO-DO coincide con los filtros."}
          onEmptyAction={todos.length === 0 ? () => createTodo.mutate() : undefined}
          emptyActionLabel="Crear primer TO-DO"
          footer={<AddRowButton label="Agregar TO-DO" onClick={() => createTodo.mutate()} />}
        >
          {pendingTodos.length > 0 ? (
            <TodoTable
              rows={pendingTodos}
              tripId={tripId}
              onReorder={handleReorderTodos}
              onToggleStatus={(t) => handleToggleTodoStatus(t)}
              onTogglePin={(t) => handleTogglePin("trip_todos", t.id, t.is_pinned)}
              onSaved={invalidate}
              onDelete={async (t) => { await delTodo({ data: { id: t.id } }); await invalidate(); toast.success("TO-DO eliminado"); }}
            />
          ) : null}
        </SectionShell>

        {/* Completadas */}
        {completedTodos.length > 0 && (
          <Collapsible
            open={completedOpen}
            onOpenChange={setCompletedOpen}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/40 transition-colors">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="font-display text-sm font-medium">Completadas</span>
                <Badge variant="secondary" className="h-5 px-2 text-[11px] rounded-full">{completedTodos.length}</Badge>
                <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform", completedOpen && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border">
                <TodoTable
                  rows={completedTodos}
                  tripId={tripId}
                  onReorder={handleReorderTodos}
                  onToggleStatus={(t) => handleToggleTodoStatus(t)}
                  onTogglePin={(t) => handleTogglePin("trip_todos", t.id, t.is_pinned)}
                  onSaved={invalidate}
                  onDelete={async (t) => { await delTodo({ data: { id: t.id } }); await invalidate(); toast.success("TO-DO eliminado"); }}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Notes */}
        <SectionShell
          icon={<StickyNote className="h-4 w-4" />}
          title="Notas"
          count={shownNotes.length}
          isLoading={isLoading}
          empty={notes.length === 0 ? "Todavía no has creado ninguna nota." : "Ninguna nota coincide con los filtros."}
          onEmptyAction={notes.length === 0 ? () => createNote.mutate() : undefined}
          emptyActionLabel="Crear primera nota"
          footer={<AddRowButton label="Agregar nota" onClick={() => createNote.mutate()} />}
        >
          <SortableNotesList
            rows={shownNotes}
            onReorder={handleReorderNotes}
            renderRow={(n, idx) => (
              <NoteRow
                key={n.id} note={n} tripId={tripId} isLast={idx === shownNotes.length - 1}
                onTogglePin={() => handleTogglePin("trip_notes", n.id, n.is_pinned)}
                onSaved={invalidate}
                onDelete={async () => { await delNote({ data: { id: n.id } }); await invalidate(); toast.success("Nota eliminada"); }}
              />
            )}
          />
        </SectionShell>

        {/* Docs (archivos, imágenes, videos y enlaces) */}
        <SectionShell
          icon={<FileText className="h-4 w-4" />}
          title="Docs"
          count={shownDocs.length}
          isLoading={isLoading}
          empty={documents.length === 0
            ? "Todavía no hay docs. Guarda aquí cotizaciones, acuerdos, imágenes o videos."
            : "Ningún doc coincide con los filtros."}
          onEmptyAction={documents.length === 0 ? () => setUploadDialogOpen(true) : undefined}
          emptyActionLabel="Subir archivo"
          footer={
            <div className="flex items-center gap-4">
              <AddRowButton label="Subir archivo" onClick={() => setUploadDialogOpen(true)} />
              <AddRowButton label="Agregar enlace" onClick={() => setLinkDialogOpen(true)} />
            </div>
          }
        >
          {shownDocs.map((d, idx) =>
            d.kind === "link" ? (
              <LinkRow
                key={d.id} doc={d} isLast={idx === shownDocs.length - 1}
                onOpen={() => handleOpenDoc(d)}
                onCopy={() => handleCopyLink(d.url)}
                onTogglePin={() => handleTogglePin("trip_documents", d.id, d.is_pinned)}
                onSaved={invalidate}
                onDelete={async () => { await delDoc({ data: { id: d.id } }); await invalidate(); toast.success("Eliminado"); }}
              />
            ) : (
              <DocumentRow
                key={d.id} doc={d} isLast={idx === shownDocs.length - 1}
                onOpen={() => handleOpenDoc(d)}
                onTogglePin={() => handleTogglePin("trip_documents", d.id, d.is_pinned)}
                onSaved={invalidate}
                onDelete={async () => { await delDoc({ data: { id: d.id } }); await invalidate(); toast.success("Eliminado"); }}
              />
            ),
          )}
        </SectionShell>


      </div>

      {/* Las notas fijadas se muestran en el header (Resumen de notas) */}


      <AddLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        onSubmit={async (v) => {
          await upDoc({ data: { trip_id: tripId, kind: "link", ...v } });
          await invalidate();
          toast.success("Enlace agregado");
        }}
      />
      <UploadDocumentDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        tripId={tripId}
        onUploaded={async (v) => {
          await upDoc({ data: { trip_id: tripId, kind: "file", ...v } });
          await invalidate();
          toast.success("Documento subido");
        }}
      />
    </div>
  );
}

/* ---------- Section shell (collapsible card) ---------- */

function SectionShell({
  icon, title, count, isLoading, empty, onEmptyAction, emptyActionLabel, footer, children,
}: {
  icon: React.ReactNode; title: string; count: number; isLoading: boolean;
  empty: string; onEmptyAction?: () => void; emptyActionLabel?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div>
      <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/40 transition-colors">
            <span className="text-primary">{icon}</span>
            <span className="font-display text-sm font-medium">{title}</span>
            <Badge variant="secondary" className="h-5 px-2 text-[11px] rounded-full">{count}</Badge>
            <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-14 rounded-md bg-secondary/30 animate-pulse" />
                ))}
              </div>
            ) : !hasChildren ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">{empty}</p>
                {onEmptyAction && emptyActionLabel && (
                  <Button size="sm" variant="outline" className="mt-3" onClick={onEmptyAction}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> {emptyActionLabel}
                  </Button>
                )}
              </div>
            ) : (
              <div>{children}</div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

/* ---------- Botón para agregar debajo de cada tabla ---------- */

function AddRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-1 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}


/* ---------- Row action buttons ---------- */

function RowActions({
  pinned, onPin, onOpen, onDelete,
}: { pinned: boolean; onPin: () => void; onOpen: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Button
        variant="ghost" size="icon" className="h-8 w-8"
        onClick={onPin}
        aria-label={pinned ? "Desfijar" : "Fijar"}
      >
        {pinned
          ? <Pin className="h-4 w-4 text-primary fill-primary" />
          : <Pin className="h-4 w-4 text-muted-foreground rotate-45" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onOpen} aria-label="Abrir para escribir">
        <BookOpen className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete} aria-label="Eliminar">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ---------- Filters ---------- */

function FiltersMenu({
  filters, setFilters, authors,
}: { filters: Filters; setFilters: (fn: (f: Filters) => Filters) => void; authors: Map<string, string> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-10 rounded-lg gap-1.5">
          <SlidersHorizontal className="h-4 w-4" /> Filtros
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-3 space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select value={filters.type} onValueChange={(v: any) => setFilters((f) => ({ ...f, type: v }))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="todo">TO-DO's</SelectItem>
              <SelectItem value="note">Notas</SelectItem>
              <SelectItem value="document">Docs</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Estado</label>
          <Select value={filters.status} onValueChange={(v: any) => setFilters((f) => ({ ...f, status: v }))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="completado">Completado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Autor</label>
          <Select value={filters.author} onValueChange={(v) => setFilters((f) => ({ ...f, author: v }))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {[...authors.entries()].map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Fijados</label>
          <Select value={filters.pinned} onValueChange={(v: any) => setFilters((f) => ({ ...f, pinned: v }))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pinned">Solo fijados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Ordenar por fecha</label>
          <Select value={filters.sort} onValueChange={(v: any) => setFilters((f) => ({ ...f, sort: v }))}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Más recientes</SelectItem>
              <SelectItem value="oldest">Más antiguas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------- Rows ---------- */

function MetaLine({
  status, author, date,
}: { status?: "pendiente" | "completado"; author?: string | null; date: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {status && (
        <span className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", status === "completado" ? "bg-emerald-500" : "bg-primary")} />
          <span className={cn(status === "completado" ? "text-emerald-600 dark:text-emerald-500" : "text-primary", "font-medium")}>
            {status === "completado" ? "Completado" : "Pendiente"}
          </span>
        </span>
      )}
      {author !== undefined && (
        <span className="flex items-center gap-1"><User className="h-3 w-3" /> {author ?? "—"}</span>
      )}
      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(date), "dd MMM", { locale: es })}</span>
    </div>
  );
}

function TypeTag({ kind }: { kind: "note" | "todo" | "link" | "file" }) {
  const map = {
    note: { label: "Nota", cls: "bg-[oklch(0.92_0.03_75)] text-[oklch(0.35_0.06_50)]" },
    todo: { label: "TO-DO", cls: "bg-primary/15 text-primary" },
    link: { label: "Link", cls: "bg-secondary text-secondary-foreground" },
    file: { label: "Doc", cls: "bg-secondary text-secondary-foreground" },
  } as const;
  const c = map[kind];
  return (
    <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium", c.cls)}>
      {c.label}
    </span>
  );
}

function TodoTable({
  rows, tripId, onToggleStatus, onTogglePin, onSaved, onDelete, onReorder,
}: {
  rows: TripTodo[]; tripId: string;
  onToggleStatus: (t: TripTodo) => void;
  onTogglePin: (t: TripTodo) => void;
  onSaved: () => void;
  onDelete: (t: TripTodo) => Promise<void>;
  onReorder?: (groupIds: string[], activeId: string, overId: string) => void | Promise<void>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = rows.map((r) => r.id);
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    onReorder?.(ids, String(active.id), String(over.id));
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] table-fixed text-sm">
        <colgroup>
          <col style={{ width: "4%" }} />
          <col style={{ width: "8%" }} />
          <col style={{ width: "36%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "20%" }} />
          <col style={{ width: "12%" }} />
        </colgroup>
        <thead>
          <tr className="bg-secondary/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-1 py-2 font-semibold" aria-label="Orden" />
            <th className="px-3 py-2 font-semibold">
              <span className="inline-flex items-center gap-1"><CheckSquare className="h-3.5 w-3.5" /> Status</span>
            </th>
            <th className="px-3 py-2 font-semibold">TO-DO</th>
            <th className="px-3 py-2 font-semibold">Responsable</th>
            <th className="px-3 py-2 font-semibold">Fechas</th>
            <th className="px-3 py-2 font-semibold text-right">Acciones</th>
          </tr>
        </thead>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <tbody>
              {rows.map((t, idx) => (
                <TodoTableRow
                  key={t.id} todo={t} tripId={tripId} isLast={idx === rows.length - 1}
                  onToggleStatus={() => onToggleStatus(t)}
                  onTogglePin={() => onTogglePin(t)}
                  onSaved={onSaved}
                  onDelete={() => onDelete(t)}
                />
              ))}
            </tbody>
          </SortableContext>
        </DndContext>
      </table>
    </div>
  );
}

function TodoTableRow({
  todo, tripId, isLast, onToggleStatus, onTogglePin, onSaved, onDelete,
}: {
  todo: TripTodo; tripId: string; isLast: boolean;
  onToggleStatus: () => void; onTogglePin: () => void;
  onSaved: () => void; onDelete: () => Promise<void>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const navigate = useNavigate();
  const up = useServerFn(upsertTodo);
  const done = todo.status === "completado";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id });

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "align-top",
        !isLast && "border-b border-border",
        todo.is_pinned && "bg-primary/5",
        isDragging && "relative z-10 bg-card shadow-md",
      )}
    >
      <td className="px-1 py-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Arrastrar para reordenar"
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </td>
      <td className="px-3 py-3">
        <Checkbox
          checked={done}
          onCheckedChange={onToggleStatus}
          aria-label="Marcar como completado"
        />
      </td>
      <td className="px-3 py-3 min-w-0">
        <InlineEditableTitle
          value={todo.title}
          ariaLabel="Editar título del TO-DO"
          editOnClick
          onSave={async (nextTitle) => {
            await up({ data: { id: todo.id, trip_id: tripId, title: nextTitle, short_description: todo.short_description } });
            onSaved();
          }}
          display={
            <span
              className={cn(
                "font-medium break-words cursor-text",
                done && "line-through text-muted-foreground",
              )}
            >
              {todo.title}
            </span>
          }

        />
        <div className={cn("mt-0.5", done && "line-through")}>
          <InlineEditableDescription
            value={todo.short_description}
            onSave={async (next) => {
              await up({ data: { id: todo.id, trip_id: tripId, title: todo.title, short_description: next } });
              onSaved();
            }}
          />
        </div>
      </td>
      <td className="px-3 py-3">
        <AssigneeSelect
          tripId={tripId}
          value={todo.assigned_to ?? null}
          valueName={todo.assignee_name ?? null}
          onChange={async (userId) => {
            await up({ data: { id: todo.id, trip_id: tripId, title: todo.title, short_description: todo.short_description, assigned_to: userId } });
            onSaved();
          }}
        />
      </td>
      <td className="px-3 py-3">
        <TodoDatesCell
          startDate={todo.start_date}
          dueDate={todo.due_date}
          onChange={async (dates) => {
            await up({ data: { id: todo.id, trip_id: tripId, title: todo.title, short_description: todo.short_description, ...dates } });
            onSaved();
          }}
        />
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end">
          <RowActions pinned={todo.is_pinned} onPin={onTogglePin} onOpen={() => navigate({ to: "/viajes/$tripId/todos/$todoId", params: { tripId, todoId: todo.id } })} onDelete={() => setConfirmDel(true)} />
        </div>
        <EditItemDialog
          open={editOpen} onOpenChange={setEditOpen}
          title="Editar TO-DO"
          initial={{ title: todo.title, short_description: todo.short_description }}
          onSubmit={async (v) => {
            await up({ data: { id: todo.id, trip_id: tripId, ...v } });
            onSaved();
          }}
        />
        <ConfirmDeleteDialog open={confirmDel} onOpenChange={setConfirmDel} itemLabel={`el TO-DO "${todo.title}"`} onConfirm={onDelete} />
      </td>
    </tr>
  );
}

function SortableNotesList({
  rows, onReorder, renderRow,
}: {
  rows: TripNote[];
  onReorder: (groupIds: string[], activeId: string, overId: string) => void | Promise<void>;
  renderRow: (note: TripNote, idx: number) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = rows.map((r) => r.id);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        onReorder(ids, String(active.id), String(over.id));
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div>{rows.map((n, idx) => renderRow(n, idx))}</div>
      </SortableContext>
    </DndContext>
  );
}

function NoteRow({
  note, tripId, isLast, onTogglePin, onSaved, onDelete,
}: {
  note: TripNote; tripId: string; isLast: boolean;
  onTogglePin: () => void; onSaved: () => void; onDelete: () => Promise<void>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const navigate = useNavigate();
  const up = useServerFn(upsertNote);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-start gap-3 px-4 py-3 bg-card",
        !isLast && "border-b border-border",
        isDragging && "relative z-10 shadow-md",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastrar para reordenar"
        className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <TypeTag kind="note" />
      <div className="flex-1 min-w-0">
        <InlineEditableTitle
          value={note.title}
          ariaLabel="Editar título de la nota"
          editOnClick
          onSave={async (nextTitle) => {
            await up({ data: { id: note.id, trip_id: tripId, title: nextTitle, short_description: note.short_description } });
            onSaved();
          }}
          display={
            <span className="font-medium line-clamp-1 cursor-text">
              {note.title}
            </span>
          }

        />
        <div className="mt-0.5">
          <InlineEditableDescription
            value={note.short_description}
            onSave={async (next) => {
              await up({ data: { id: note.id, trip_id: tripId, title: note.title, short_description: next } });
              onSaved();
            }}
          />
        </div>
        <div className="mt-1.5">
          <MetaLine author={note.author_name} date={note.created_at} />
        </div>
      </div>
      <RowActions pinned={note.is_pinned} onPin={onTogglePin} onOpen={() => navigate({ to: "/viajes/$tripId/notas/$noteId", params: { tripId, noteId: note.id } })} onDelete={() => setConfirmDel(true)} />

      <EditItemDialog
        open={editOpen} onOpenChange={setEditOpen}
        title="Editar nota"
        initial={{ title: note.title, short_description: note.short_description }}
        onSubmit={async (v) => {
          await up({ data: { id: note.id, trip_id: tripId, ...v } });
          onSaved();
        }}
      />
      <ConfirmDeleteDialog open={confirmDel} onOpenChange={setConfirmDel} itemLabel={`la nota "${note.title}"`} onConfirm={onDelete} />
    </div>
  );
}

function LinkRow({
  doc, isLast, onOpen, onCopy, onTogglePin, onSaved, onDelete,
}: {
  doc: TripDocument; isLast: boolean;
  onOpen: () => void; onCopy: () => void; onTogglePin: () => void;
  onSaved: () => void; onDelete: () => Promise<void>;
}) {
  const [editLinkOpen, setEditLinkOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const up = useServerFn(upsertDocument);
  return (
    <div className={cn("flex items-start gap-3 px-4 py-3", !isLast && "border-b border-border")}>
      <TypeTag kind="link" />
      <div className="flex-1 min-w-0">
        <button onClick={onOpen} className="text-left font-medium hover:underline underline-offset-2 line-clamp-1">
          {doc.title}
        </button>
        {doc.url && (
          <div className="flex items-center gap-1 mt-0.5">
            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground truncate hover:text-foreground max-w-full">
              {doc.url}
            </a>
            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
          </div>
        )}
        {doc.short_description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{doc.short_description}</p>
        )}
        <div className="mt-1.5">
          <MetaLine author={doc.author_name} date={doc.created_at} />
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={onOpen}>
          Abrir <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={onCopy}>
          Copiar link <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onTogglePin} aria-label={doc.is_pinned ? "Desfijar" : "Fijar"}>
          {doc.is_pinned ? <Pin className="h-4 w-4 text-primary fill-primary" /> : <Pin className="h-4 w-4 rotate-45" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDel(true)} aria-label="Eliminar">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <AddLinkDialog
        open={editLinkOpen} onOpenChange={setEditLinkOpen}
        initial={{ title: doc.title, url: doc.url ?? "", short_description: doc.short_description }}
        onSubmit={async (v) => {
          await up({ data: { id: doc.id, trip_id: doc.trip_id, kind: "link", ...v } });
          onSaved();
        }}
      />
      <ConfirmDeleteDialog open={confirmDel} onOpenChange={setConfirmDel} itemLabel={`"${doc.title}"`} onConfirm={onDelete} />
    </div>
  );
}

function DocumentRow({
  doc, isLast, onOpen, onTogglePin, onSaved, onDelete,
}: {
  doc: TripDocument; isLast: boolean;
  onOpen: () => void; onTogglePin: () => void; onSaved: () => void; onDelete: () => Promise<void>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const up = useServerFn(upsertDocument);
  return (
    <div className={cn("flex items-start gap-3 px-4 py-3", !isLast && "border-b border-border")}>
      <TypeTag kind="file" />
      <div className="flex-1 min-w-0">
        <button onClick={onOpen} className="text-left font-medium hover:underline underline-offset-2 line-clamp-1">
          {doc.title}
        </button>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {doc.file_name}{doc.size_bytes ? ` · ${(doc.size_bytes / 1024).toFixed(1)} KB` : ""}
        </div>
        {doc.short_description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{doc.short_description}</p>
        )}
        <div className="mt-1.5">
          <MetaLine author={doc.author_name} date={doc.created_at} />
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={onOpen}>
          Descargar <Download className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onTogglePin} aria-label={doc.is_pinned ? "Desfijar" : "Fijar"}>
          {doc.is_pinned ? <Pin className="h-4 w-4 text-primary fill-primary" /> : <Pin className="h-4 w-4 rotate-45" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setEditOpen(true)} aria-label="Editar">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDel(true)} aria-label="Eliminar">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <EditItemDialog
        open={editOpen} onOpenChange={setEditOpen}
        title="Editar documento"
        initial={{ title: doc.title, short_description: doc.short_description }}
        onSubmit={async (v) => {
          await up({ data: {
            id: doc.id, trip_id: doc.trip_id, kind: doc.kind,
            title: v.title, short_description: v.short_description,
            url: doc.url, storage_path: doc.storage_path, file_name: doc.file_name,
            mime_type: doc.mime_type, size_bytes: doc.size_bytes,
          } });
          onSaved();
        }}
      />
      <ConfirmDeleteDialog open={confirmDel} onOpenChange={setConfirmDel} itemLabel={`"${doc.title}"`} onConfirm={onDelete} />
    </div>
  );
}


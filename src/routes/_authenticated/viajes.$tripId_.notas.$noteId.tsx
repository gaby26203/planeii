import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Pin, PinOff, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getNote, upsertNote, deleteNote, togglePin,
} from "@/lib/trip-notes.functions";
import { RichEditor } from "@/components/trip-notes/RichEditor";
import { EditItemDialog } from "@/components/trip-notes/EditItemDialog";
import { ConfirmDeleteDialog } from "@/components/trip-notes/ConfirmDeleteDialog";
import { SaveIndicator, type SaveStatus } from "@/components/trip-notes/SaveIndicator";
import { InlineEditableTitle } from "@/components/trip-notes/InlineEditableTitle";
import { InlineEditableDescription } from "@/components/trip-notes/InlineEditableDescription";

export const Route = createFileRoute("/_authenticated/viajes/$tripId_/notas/$noteId")({
  component: NoteDetailPage,
});

function NoteDetailPage() {
  const { tripId, noteId } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getNote);
  const up = useServerFn(upsertNote);
  const del = useServerFn(deleteNote);
  const pin = useServerFn(togglePin);

  const { data: note, isLoading, refetch } = useQuery({
    queryKey: ["trip-note", noteId],
    queryFn: () => get({ data: { id: noteId } }),
  });

  const [content, setContent] = useState<unknown>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<unknown>(null);

  useEffect(() => { if (note && content === null) setContent(note.content ?? {}); }, [note, content]);

  const performSave = async (newContent: unknown) => {
    if (!note) return;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await up({ data: {
        id: note.id, trip_id: note.trip_id, title: note.title,
        short_description: note.short_description, content: newContent as any,
      } });
      setLastSavedAt(new Date());
      setSaveStatus("saved");
    } catch (e: any) {
      const msg = e?.message ?? "No se pudo guardar";
      setSaveError(msg);
      setSaveStatus("error");
      toast.error(msg);
    }
  };

  const scheduleSave = (newContent: unknown) => {
    setContent(newContent);
    if (!note) return;
    pendingContentRef.current = newContent;
    setSaveStatus("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => performSave(newContent), 800);
  };

  const retrySave = () => {
    if (pendingContentRef.current !== null) performSave(pendingContentRef.current);
  };

  if (isLoading || !note || content === null) {
    return (
      <div className="p-6 md:p-8 max-w-4xl">
        <div className="h-8 w-32 bg-secondary/40 animate-pulse rounded mb-4" />
        <div className="h-64 bg-secondary/40 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl space-y-6">
      <Link to="/viajes/$tripId" params={{ tripId }} search={{ tab: "notas" } as any} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a Notas
      </Link>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <InlineEditableTitle
              value={note.title}
              ariaLabel="Editar título de la nota"
              editOnClick
              inputClassName="h-10 text-2xl font-display"
              onSave={async (nextTitle) => {
                await up({ data: { id: note.id, trip_id: note.trip_id, title: nextTitle, short_description: note.short_description } });
                refetch();
              }}
              display={<h1 className="font-display text-3xl leading-tight">{note.title}</h1>}
            />
            <div className="mt-1 text-sm text-muted-foreground">
              <InlineEditableDescription
                value={note.short_description}
                onSave={async (next) => {
                  await up({ data: { id: note.id, trip_id: note.trip_id, title: note.title, short_description: next } });
                  refetch();
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Select
                value={note.status}
                onValueChange={async (v) => {
                  await up({ data: { id: note.id, trip_id: note.trip_id, title: note.title, short_description: note.short_description, status: v as any } });
                  refetch();
                }}
              >
                <SelectTrigger className="h-6 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                </SelectContent>
              </Select>
              {note.is_pinned && <Badge variant="outline" className="gap-1"><Pin className="h-3 w-3" /> Fijada</Badge>}
              <span>{note.author_name ?? "—"}</span>
              <span>·</span>
              <span>{format(new Date(note.created_at), "dd MMM yyyy", { locale: es })}</span>
              <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} error={saveError} onRetry={retrySave} />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="outline" size="sm" onClick={async () => {
              await pin({ data: { table: "trip_notes", id: note.id, is_pinned: !note.is_pinned } });
              refetch();
            }}>
              {note.is_pinned ? <><PinOff className="mr-1.5 h-3.5 w-3.5" /> Desfijar</> : <><Pin className="mr-1.5 h-3.5 w-3.5" /> Fijar</>}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
            </Button>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDel(true)}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Eliminar
            </Button>
          </div>
        </div>
      </header>

      <RichEditor value={content ?? {}} onChange={scheduleSave} minHeight="400px" />

      <EditItemDialog
        open={editOpen} onOpenChange={setEditOpen}
        title="Editar nota"
        initial={{ title: note.title, short_description: note.short_description }}
        onSubmit={async (v) => {
          await up({ data: { id: note.id, trip_id: note.trip_id, ...v } });
          refetch();
        }}
      />
      <ConfirmDeleteDialog
        open={confirmDel} onOpenChange={setConfirmDel}
        itemLabel={`la nota "${note.title}"`}
        onConfirm={async () => {
          await del({ data: { id: note.id } });
          toast.success("Nota eliminada");
          navigate({ to: "/viajes/$tripId", params: { tripId }, search: { tab: "notas" } as any });
        }}
      />
    </div>
  );
}

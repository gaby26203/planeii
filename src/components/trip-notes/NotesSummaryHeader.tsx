// Resumen de notas mostrado en el header del viaje cuando la sección activa es Notas.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CheckSquare, FileText, Link as LinkIcon, CheckCircle2, Layers, Pin } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { listTripNotes } from "@/lib/trip-notes.functions";

type PinnedItem = {
  kind: "todo" | "note" | "link" | "file";
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

const KIND_LABEL: Record<PinnedItem["kind"], string> = {
  todo: "To-do",
  note: "Nota",
  link: "Enlace",
  file: "Doc",
};

export function NotesSummaryHeader({ tripId }: { tripId: string }) {
  const list = useServerFn(listTripNotes);
  const { data } = useQuery({
    queryKey: ["trip-notes", tripId] as const,
    queryFn: () => list({ data: { tripId } }),
  });

  const todos = data?.todos ?? [];
  const notes = data?.notes ?? [];
  const documents = data?.documents ?? [];
  const docsCount = documents.length;

  const stats = [
    { icon: CheckSquare, label: "To-dos pendientes", value: todos.filter((t) => t.status === "pendiente").length },
    { icon: FileText, label: "Notas", value: notes.length },
    { icon: LinkIcon, label: "Docs", value: docsCount },
    { icon: CheckCircle2, label: "Completados", value: todos.filter((t) => t.status === "completado").length },
    { icon: Layers, label: "Total de elementos", value: todos.length + notes.length + documents.length },
  ];

  const pinned: PinnedItem[] = [
    ...todos.filter((t) => t.is_pinned).map((t) => ({ kind: "todo" as const, id: t.id, title: t.title, created_at: t.created_at, updated_at: t.updated_at })),
    ...notes.filter((n) => n.is_pinned).map((n) => ({ kind: "note" as const, id: n.id, title: n.title, created_at: n.created_at, updated_at: n.updated_at })),
    ...documents.filter((d) => d.is_pinned).map((d) => ({ kind: d.kind === "link" ? ("link" as const) : ("file" as const), id: d.id, title: d.title, created_at: d.created_at, updated_at: d.updated_at })),
  ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-3 py-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-medium text-muted-foreground/80">
              <Icon className="h-3.5 w-3.5 text-terracotta shrink-0" strokeWidth={2} />
              <span className="truncate">{label}</span>
            </div>
            <div className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card px-3 py-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-medium text-muted-foreground/80">
          <Pin className="h-3.5 w-3.5 text-primary fill-primary shrink-0" />
          <span>Notas fijadas</span>
        </div>
        {pinned.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Nada fijado todavía.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {pinned.map((it) => {
              const inner = (
                <>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                    {KIND_LABEL[it.kind]}
                  </span>
                  <span className="min-w-0 truncate text-xs font-medium text-foreground">{it.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(it.created_at), "dd MMM", { locale: es })}
                  </span>
                </>
              );
              const cls =
                "flex max-w-[260px] items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 hover:bg-secondary/60 transition-colors";
              if (it.kind === "todo") {
                return (
                  <Link key={`${it.kind}-${it.id}`} to="/viajes/$tripId/todos/$todoId" params={{ tripId, todoId: it.id }} className={cls}>
                    {inner}
                  </Link>
                );
              }
              if (it.kind === "note") {
                return (
                  <Link key={`${it.kind}-${it.id}`} to="/viajes/$tripId/notas/$noteId" params={{ tripId, noteId: it.id }} className={cls}>
                    {inner}
                  </Link>
                );
              }
              return (
                <div key={`${it.kind}-${it.id}`} className={cls}>
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

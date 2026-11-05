import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SaveIndicator, type SaveStatus } from "./SaveIndicator";
import { toast } from "sonner";

interface InlineEditableDescriptionProps {
  value: string | null;
  onSave: (next: string | null) => Promise<void> | void;
  className?: string;
  textClassName?: string;
  placeholder?: string;
  emptyLabel?: string;
  ariaLabel?: string;
}

/**
 * Inline editor for a short description. Displays the text with a pencil icon
 * on hover; clicking (or double-clicking the text) switches to a textarea.
 * Enter saves, Shift+Enter inserts a line break, Esc cancels. Shows
 * saving/saved/error status with retry.
 */
export function InlineEditableDescription({
  value,
  onSave,
  className,
  textClassName,
  placeholder = "Añadir descripción…",
  emptyLabel = "Añadir descripción",
  ariaLabel = "Editar descripción",
}: InlineEditableDescriptionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastAttemptRef = useRef<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        areaRef.current?.focus();
        const len = areaRef.current?.value.length ?? 0;
        areaRef.current?.setSelectionRange(len, len);
      });
    }
  }, [editing]);

  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  const performSave = async (raw: string) => {
    const trimmed = raw.trim();
    const next: string | null = trimmed === "" ? null : trimmed;
    lastAttemptRef.current = trimmed;
    setStatus("saving");
    setError(null);
    try {
      await onSave(next);
      setStatus("saved");
      setLastSavedAt(new Date());
      setEditing(false);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        setStatus((s) => (s === "saved" ? "idle" : s));
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la descripción";
      setError(message);
      setStatus("error");
      toast.error("No se pudo guardar la descripción", { description: message });
    }
  };

  const commit = async () => {
    const current = draft;
    if ((current.trim() || null) === (value ?? null)) {
      setEditing(false);
      setDraft(value ?? "");
      return;
    }
    await performSave(current);
  };

  const retry = () => {
    const target = lastAttemptRef.current ?? draft;
    void performSave(target);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void commit(); }
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };

  const saving = status === "saving";

  if (editing) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <Textarea
          ref={areaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => void commit()}
          disabled={saving}
          placeholder={placeholder}
          rows={2}
          className="min-h-[56px] text-sm"
        />
        <div className="flex items-center gap-1.5">
          <Button
            type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void commit()}
            disabled={saving}
            aria-label="Guardar descripción"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancel}
            disabled={saving}
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </Button>
          {status !== "idle" && (
            <SaveIndicator status={status} lastSavedAt={lastSavedAt} error={error} onRetry={retry} />
          )}
        </div>
      </div>
    );
  }

  const hasValue = !!(value && value.trim());

  return (
    <div className={cn("group/inline-desc flex flex-col gap-0.5 min-w-0", className)}>
      <div className="flex items-start gap-1.5 min-w-0">
        <button
          type="button"
          onClick={() => setEditing(true)}
          onDoubleClick={() => setEditing(true)}
          className={cn(
            "min-w-0 flex-1 text-left text-xs rounded hover:bg-secondary/40 -mx-1 px-1 py-0.5 transition-colors",
            !hasValue && "text-muted-foreground italic",
            textClassName,
          )}
          aria-label={ariaLabel}
        >
          {hasValue ? value : emptyLabel}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={ariaLabel}
          className="opacity-0 group-hover/inline-desc:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      {(status === "saving" || status === "saved" || status === "error") && (
        <SaveIndicator status={status} lastSavedAt={lastSavedAt} error={error} onRetry={retry} />
      )}
    </div>
  );
}

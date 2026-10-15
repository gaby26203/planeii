import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SaveIndicator, type SaveStatus } from "./SaveIndicator";
import { toast } from "sonner";

interface InlineEditableTitleProps {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  /** Rendered when not editing. Should include the title text (e.g. a Link). */
  display: React.ReactNode;
  /** Optional wrapper className for the group container. */
  className?: string;
  /** Input styling when editing. */
  inputClassName?: string;
  ariaLabel?: string;
  /** When true, a single click on the title starts inline editing. */
  editOnClick?: boolean;
}

/**
 * Shows a title as clickable content with a pencil icon that appears on hover.
 * Clicking the pencil (or double-clicking the title area) switches to an inline
 * input; Enter/blur saves, Esc cancels. Displays saving/saved/error status with
 * a retry action when the save fails.
 */
export function InlineEditableTitle({
  value,
  onSave,
  display,
  className,
  inputClassName,
  ariaLabel = "Editar título",
  editOnClick = false,
}: InlineEditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastAttemptRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]);

  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  const performSave = async (trimmed: string) => {
    lastAttemptRef.current = trimmed;
    setStatus("saving");
    setError(null);
    try {
      await onSave(trimmed);
      setStatus("saved");
      setLastSavedAt(new Date());
      setEditing(false);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        setStatus((s) => (s === "saved" ? "idle" : s));
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el título";
      setError(message);
      setStatus("error");
      toast.error("No se pudo guardar el título", { description: message });
    }
  };

  const commit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) {
      setEditing(false);
      setDraft(value);
      return;
    }
    await performSave(trimmed);
  };

  const retry = () => {
    const target = lastAttemptRef.current ?? draft.trim();
    if (target) void performSave(target);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); void commit(); }
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };

  const saving = status === "saving";

  if (editing) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <div className="flex items-center gap-1.5">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={() => void commit()}
            disabled={saving}
            className={cn("h-8", inputClassName)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void commit()}
            disabled={saving}
            aria-label="Guardar título"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancel}
            disabled={saving}
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {status !== "idle" && (
          <SaveIndicator status={status} lastSavedAt={lastSavedAt} error={error} onRetry={retry} />
        )}
      </div>
    );
  }

  return (
    <div className={cn("group/inline-title flex flex-col gap-0.5 min-w-0", className)}>
      <div className="flex items-center gap-1.5 min-w-0">
        <div
          className={cn("min-w-0 flex-1", editOnClick && "cursor-text")}
          onDoubleClick={() => setEditing(true)}
          onClick={
            editOnClick
              ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditing(true);
                }
              : undefined
          }
        >
          {display}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={ariaLabel}
          className="opacity-0 group-hover/inline-title:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
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

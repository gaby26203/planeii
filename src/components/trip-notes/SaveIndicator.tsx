import { Check, Loader2, CircleAlert, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSavedAt?: Date | null;
  error?: string | null;
  onRetry?: () => void;
}

export function SaveIndicator({ status, lastSavedAt, error, onRetry }: SaveIndicatorProps) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
      </span>
    );
  }
  if (status === "dirty") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleDashed className="h-3 w-3" /> Cambios sin guardar
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <CircleAlert className="h-3 w-3" />
        <span className="max-w-[240px] truncate" title={error ?? undefined}>
          Error al guardar
        </span>
        {onRetry && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs text-destructive underline"
            onClick={onRetry}
          >
            Reintentar
          </Button>
        )}
      </span>
    );
  }
  if (status === "saved" && lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-500">
        <Check className="h-3 w-3" />
        Guardado · {format(lastSavedAt, "HH:mm:ss", { locale: es })}
      </span>
    );
  }
  return null;
}

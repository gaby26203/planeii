import { X } from "lucide-react";
import { TAG_COLOR_CLASSES, type TripTag } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  tags: TripTag[];
  counts: Map<string, number>;
  activeIds: Set<string>;
  onToggle: (tagId: string) => void;
  onClear: () => void;
}

/**
 * Chips clickeables con conteo por tag (solo tags usados en el viaje).
 */
export function TagFilterBar({ tags, counts, activeIds, onToggle, onClear }: Props) {
  const used = tags.filter((t) => (counts.get(t.id) ?? 0) > 0);
  if (used.length === 0) return null;
  used.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Tags:</span>
      {used.map((t) => {
        const colors = TAG_COLOR_CLASSES[t.colorKey];
        const active = activeIds.has(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onToggle(t.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
              colors.bg,
              colors.text,
              active ? "border-foreground/40 ring-2 ring-foreground/20" : colors.border,
            )}
          >
            {t.label}
            <span className="opacity-70">· {counts.get(t.id) ?? 0}</span>
          </button>
        );
      })}
      {activeIds.size > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-muted-foreground"
          onClick={onClear}
        >
          <X className="h-3 w-3 mr-1" />
          Limpiar tags
        </Button>
      )}
    </div>
  );
}

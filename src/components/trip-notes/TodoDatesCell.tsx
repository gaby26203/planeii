// Selector de fechas de un TO-DO: una sola fecha o rango (inicio → culminación).
import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const toISO = (d: Date) => format(d, "yyyy-MM-dd");
const fromISO = (s: string | null | undefined) => (s ? parseISO(s) : undefined);

export function TodoDatesCell({
  startDate,
  dueDate,
  onChange,
  className,
}: {
  startDate: string | null | undefined;
  dueDate: string | null | undefined;
  onChange: (next: { start_date: string | null; due_date: string | null }) => Promise<void> | void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const from = fromISO(startDate);
  const to = fromISO(dueDate);

  const label = (() => {
    if (from && to && toISO(from) !== toISO(to)) {
      return `${format(from, "d MMM", { locale: es })} – ${format(to, "d MMM", { locale: es })}`;
    }
    const single = from ?? to;
    if (single) return format(single, "d MMM yyyy", { locale: es });
    return "Sin fecha";
  })();

  const commit = async (next: { start_date: string | null; due_date: string | null }) => {
    setSaving(true);
    try {
      await onChange(next);
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      void commit({ start_date: null, due_date: null });
      return;
    }
    void commit({
      start_date: toISO(range.from),
      due_date: range.to ? toISO(range.to) : toISO(range.from),
    });
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={saving}
            aria-label="Elegir fechas del TO-DO"
            className={cn(
              "inline-flex min-w-[112px] items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
              from || to
                ? "border-border bg-secondary/60 text-foreground"
                : "border-dashed border-border text-muted-foreground hover:bg-secondary/50",
            )}
          >
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="range"
            locale={es}
            defaultMonth={from ?? to}
            selected={from || to ? { from, to } : undefined}
            onSelect={handleSelect}
            className={cn("p-3 pointer-events-auto")}
          />
          <div className="flex items-center justify-between gap-2 border-t border-border p-2">
            <span className="text-[11px] text-muted-foreground">
              Elegí una fecha o un rango
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setOpen(false);
                void commit({ start_date: null, due_date: null });
              }}
            >
              Quitar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {(from || to) && (
        <button
          type="button"
          aria-label="Quitar fechas"
          className="text-muted-foreground/70 hover:text-destructive"
          onClick={() => void commit({ start_date: null, due_date: null })}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

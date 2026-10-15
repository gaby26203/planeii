// Selector de responsable ("owner") de un TO-DO: organizadoras / tour leaders del viaje.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { listTripAssignees } from "@/lib/trip-notes.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABELS: Record<string, string> = {
  owner: "Dueña del viaje",
  organizadora: "Organizadora",
  tour_leader: "Tour leader",
};

// Paleta estable por responsable: mismo usuario ⇒ mismo color siempre.
const ASSIGNEE_COLORS = [
  "bg-[oklch(0.93_0.06_35)] text-[oklch(0.38_0.12_35)] border-[oklch(0.82_0.09_35)]",
  "bg-[oklch(0.93_0.05_220)] text-[oklch(0.38_0.1_220)] border-[oklch(0.82_0.07_220)]",
  "bg-[oklch(0.93_0.05_250)] text-[oklch(0.38_0.1_250)] border-[oklch(0.82_0.07_250)]",
  "bg-[oklch(0.93_0.06_85)] text-[oklch(0.37_0.09_85)] border-[oklch(0.82_0.08_85)]",
  "bg-[oklch(0.93_0.05_310)] text-[oklch(0.38_0.1_310)] border-[oklch(0.82_0.07_310)]",
  "bg-[oklch(0.93_0.05_195)] text-[oklch(0.36_0.08_195)] border-[oklch(0.82_0.06_195)]",
  "bg-[oklch(0.93_0.06_10)] text-[oklch(0.38_0.12_10)] border-[oklch(0.82_0.09_10)]",
  "bg-[oklch(0.93_0.05_120)] text-[oklch(0.36_0.09_120)] border-[oklch(0.82_0.07_120)]",
  "bg-[oklch(0.93_0.05_275)] text-[oklch(0.38_0.1_275)] border-[oklch(0.82_0.07_275)]",
  "bg-[oklch(0.93_0.06_60)] text-[oklch(0.37_0.1_60)] border-[oklch(0.82_0.08_60)]",
] as const;

const DOT_COLORS = [
  "bg-[oklch(0.62_0.16_35)]",
  "bg-[oklch(0.58_0.14_220)]",
  "bg-[oklch(0.58_0.14_250)]",
  "bg-[oklch(0.62_0.13_85)]",
  "bg-[oklch(0.6_0.14_310)]",
  "bg-[oklch(0.58_0.11_195)]",
  "bg-[oklch(0.6_0.16_10)]",
  "bg-[oklch(0.58_0.13_120)]",
  "bg-[oklch(0.58_0.14_275)]",
  "bg-[oklch(0.62_0.14_60)]",
] as const;

function hashIndex(userId: string, len: number) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) % 100000;
  return hash % len;
}

// Índice de color: posición del miembro en la lista del viaje (colores únicos
// mientras haya ≤ 10 miembros); si aún no se cargó la lista, hash estable.
function colorIndex(userId: string, order?: string[]) {
  const pos = order?.indexOf(userId) ?? -1;
  if (pos >= 0) return pos % ASSIGNEE_COLORS.length;
  return hashIndex(userId, ASSIGNEE_COLORS.length);
}

export function assigneeColorClasses(userId: string | null | undefined, order?: string[]) {
  if (!userId) return "";
  return ASSIGNEE_COLORS[colorIndex(userId, order)];
}

export function assigneeDotClass(userId: string | null | undefined, order?: string[]) {
  if (!userId) return "bg-muted-foreground/40";
  return DOT_COLORS[colorIndex(userId, order)];
}

export function AssigneeSelect({
  tripId,
  value,
  valueName,
  onChange,
  className,
}: {
  tripId: string;
  value: string | null | undefined;
  valueName: string | null | undefined;
  onChange: (userId: string | null) => Promise<void> | void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const listFn = useServerFn(listTripAssignees);
  const { data: people } = useQuery({
    queryKey: ["trip-assignees", tripId],
    queryFn: () => listFn({ data: { tripId } }),
    staleTime: 5 * 60_000,
  });
  const order = (people ?? []).map((p) => p.userId);


  const label = value ? valueName ?? "Responsable" : "Sin responsable";

  const pick = async (userId: string | null) => {
    setOpen(false);
    setSaving(true);
    try {
      await onChange(userId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={saving}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
            value
              ? assigneeColorClasses(value, order)
              : "border-border text-muted-foreground hover:bg-secondary/60",
            className,
          )}
          aria-label="Elegir responsable del TO-DO"
        >
          {value ? (
            <span className={cn("h-2 w-2 shrink-0 rounded-full", assigneeDotClass(value, order))} />
          ) : (
            <UserRound className="h-3 w-3" />
          )}
          <span className="max-w-[140px] truncate">{label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Responsable</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => pick(null)}>Sin responsable</DropdownMenuItem>
        {(people ?? []).map((p) => (
          <DropdownMenuItem
            key={p.userId}
            onClick={() => pick(p.userId)}
            className={cn("gap-2", p.userId === value && "bg-secondary/60")}
          >
            <span className={cn("h-2 w-2 shrink-0 rounded-full", assigneeDotClass(p.userId, order))} />
            <span className="truncate">{p.name}</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {ROLE_LABELS[p.role] ?? p.role}
            </span>
          </DropdownMenuItem>
        ))}

      </DropdownMenuContent>
    </DropdownMenu>
  );
}

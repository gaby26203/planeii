// Tarjeta para que cada usuaria elija cómo quiere aparecer (solo el nombre).
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyDisplayName, updateMyDisplayName } from "@/lib/profile-name.functions";

export function DisplayNameCard() {
  const getName = useServerFn(getMyDisplayName);
  const saveName = useServerFn(updateMyDisplayName);
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-display-name"],
    queryFn: () => getName(),
  });

  useEffect(() => {
    if (data) setValue(data.displayName ?? "");
  }, [data]);

  const dirty = value.trim() !== (data?.displayName ?? "").trim();

  async function handleSave() {
    if (!value.trim() || !dirty) return;
    setSaving(true);
    try {
      await saveName({ data: { displayName: value.trim() } });
      await queryClient.invalidateQueries({ queryKey: ["my-display-name"] });
      await queryClient.invalidateQueries({ queryKey: ["my-access-audit"] });
      toast.success("Nombre actualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar el nombre");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <UserRound className="h-4 w-4 text-primary" />
        <h2 className="font-medium">Cómo quiero aparecer</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Este nombre es el que ven las demás en los viajes, TO-DOs y actividad en vivo.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 space-y-1">
          <Label className="text-xs">Nombre</Label>
          <Input
            value={value}
            placeholder={isLoading ? "Cargando…" : "Ej. Ana"}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
              if (e.key === "Escape") setValue(data?.displayName ?? "");
            }}
            maxLength={60}
          />
        </div>
        <Button onClick={handleSave} disabled={saving || !dirty || !value.trim()} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}

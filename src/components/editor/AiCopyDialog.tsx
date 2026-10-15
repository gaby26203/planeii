import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { TripData } from "@/data/trip";
import { generateSalesCopy, type SalesCopy } from "@/lib/sales-copy.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function applySalesCopy(trip: TripData, copy: SalesCopy): TripData {
  const fallbackImage = trip.highlights[0]?.image ?? trip.heroImage;
  return {
    ...trip,
    title: copy.title || trip.title,
    subtitle: copy.subtitle || trip.subtitle,
    story: {
      ...trip.story,
      heading: copy.storyHeading.length ? copy.storyHeading : trip.story.heading,
      paragraphs: copy.storyParagraphs.length ? copy.storyParagraphs : trip.story.paragraphs,
    },
    highlights: copy.highlights.length
      ? copy.highlights.map((h, i) => ({ ...h, image: trip.highlights[i]?.image ?? fallbackImage }))
      : trip.highlights,
    faq: copy.faq.length ? copy.faq : trip.faq,
    finalCta: {
      heading: copy.finalHeading || trip.finalCta.heading,
      button: copy.finalButton || trip.finalCta.button,
      note: copy.finalNote || trip.finalCta.note,
    },
  };
}

export function AiCopyDialog({ open, onOpenChange, trip, onApply }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: TripData;
  onApply: (trip: TripData) => void;
}) {
  const generate = useServerFn(generateSalesCopy);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    destination: [trip.destination, trip.country].filter(Boolean).join(", "),
    dates: trip.dates,
    duration: trip.duration,
    audience: "",
    highlights: "",
    tone: "Cálido, inspirador y cercano",
    extra: "",
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    if (!form.destination.trim()) { setError("Indicá el destino."); return; }
    setLoading(true); setError(null);
    try {
      const res = await generate({ data: form });
      if (!res.ok) { setError(res.error); return; }
      onApply(applySalesCopy(trip, res.copy));
      toast.success("Textos generados y aplicados a la página");
      onOpenChange(false);
    } catch {
      setError("No se pudieron generar los textos. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Generar textos con IA</DialogTitle>
          <DialogDescription>Contá los detalles del viaje y la IA escribirá el título, la historia, los destacados, preguntas frecuentes y el cierre. Las fotos se mantienen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Destino</Label><Input value={form.destination} onChange={set("destination")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Fechas</Label><Input value={form.dates} onChange={set("dates")} /></div>
            <div className="space-y-1"><Label>Duración</Label><Input value={form.duration} onChange={set("duration")} /></div>
          </div>
          <div className="space-y-1"><Label>¿Para quién es?</Label><Input value={form.audience} onChange={set("audience")} placeholder="Mujeres de 30 a 55 que buscan viajar con calma" /></div>
          <div className="space-y-1"><Label>Experiencias destacadas</Label><Textarea rows={3} value={form.highlights} onChange={set("highlights")} placeholder="Clase de cocina, templos al amanecer, masajes tradicionales…" /></div>
          <div className="space-y-1"><Label>Tono</Label><Input value={form.tone} onChange={set("tone")} /></div>
          <div className="space-y-1"><Label>Otros detalles</Label><Textarea rows={2} value={form.extra} onChange={set("extra")} placeholder="Alojamiento, nivel físico, qué la hace única…" /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">Esto reemplaza los textos actuales de esas secciones. Podés deshacer restaurando o editándolos después.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Sparkles />} {loading ? "Generando…" : "Generar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

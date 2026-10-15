import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Smartphone, XCircle } from "lucide-react";
import type { TripData } from "@/data/trip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const isValidUrl = (value: string) => {
  try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:"; } catch { return false; }
};
const isPlaceholder = (value: string) => /\[.*\]/.test(value);

type AutoCheck = { label: string; ok: boolean; detail?: string };

function autoChecks(trip: TripData, ctaIssues: string[] = []): AutoCheck[] {
  const faqs = trip.faq.filter((f) => f.q.trim() || f.a.trim());
  const faqOk = faqs.length > 0 && faqs.every((f) => f.q.trim() && f.a.trim());
  const contactOk = [trip.contact.email, trip.contact.instagram].some((v) => v?.trim() && !isPlaceholder(v));
  return [
    { label: "Todos los botones llevan a un destino válido", ok: ctaIssues.length === 0, detail: ctaIssues.length ? ctaIssues.join(" · ") : undefined },
    { label: "Los textos de los botones de reserva están completos", ok: !!trip.copy.bookingButton.trim() && !!trip.copy.stickyBook.trim() && !!trip.finalCta.button.trim() },
    { label: "Cada pregunta frecuente tiene pregunta y respuesta", ok: faqOk, detail: faqOk ? undefined : "Completá o eliminá las preguntas vacías." },
    { label: "Hay al menos un dato de contacto real", ok: contactOk },
  ];
}

const MANUAL = [
  "Abrí el menú en la vista móvil y cada enlace lleva a su sección",
  "Las preguntas frecuentes se abren y cierran al tocarlas",
  "El botón de reserva (y el fijo de abajo) abre la página correcta",
];

export function PrePublishChecklist({ open, onOpenChange, trip, ctaIssues, onOpenMobile, onContinue }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: TripData;
  ctaIssues?: string[];
  onOpenMobile: () => void;
  onContinue: () => void;
}) {
  const checks = useMemo(() => autoChecks(trip, ctaIssues), [trip, ctaIssues?.join("|")]);
  const [manual, setManual] = useState<boolean[]>(MANUAL.map(() => false));
  useEffect(() => { if (open) setManual(MANUAL.map(() => false)); }, [open]);
  const ready = checks.every((c) => c.ok) && manual.every(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Antes de publicar</DialogTitle>
          <DialogDescription>Revisá que todo funcione en el teléfono antes de compartir la página.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <p className="mb-1 text-sm font-semibold">{checks.every((c) => c.ok) ? "Todo listo" : `${checks.filter((c) => !c.ok).length} detalle(s) para mejorar`}</p>
            <p className="mb-2 text-xs text-muted-foreground">Son sugerencias: podés publicar igual y corregirlas después. Las casillas de abajo son opcionales.</p>
            <ul className="space-y-2">
              {checks.map((c) => (
                <li key={c.label} className="flex gap-2 text-sm">
                  {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                  <span>{c.label}{c.detail && <span className="block text-xs text-muted-foreground">{c.detail}</span>}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Prueba en la vista móvil</p>
              <Button type="button" size="sm" variant="outline" onClick={onOpenMobile}><Smartphone /> Abrir vista móvil</Button>
            </div>
            <ul className="space-y-2">
              {MANUAL.map((label, i) => (
                <li key={label}>
                  <label className="flex cursor-pointer gap-2 text-sm">
                    <Checkbox checked={manual[i]} onCheckedChange={(v) => setManual((m) => m.map((x, j) => (j === i ? v === true : x)))} className="mt-0.5" />
                    <span>{label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Volver</Button>
          <Button onClick={onContinue}>{ready ? "Continuar a publicar" : "Publicar igual"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CTA_WARNING_TEXT, effectiveCtaLink, resolveCtaLink, type CtaLink } from "@/lib/cta-links";
import { SECTION_LABELS, type EditorDocument, type SectionKey } from "@/lib/trip-editor";

/** Controles de destino de un CTA. Los mismos para cualquier botón de la landing. */
export function CtaDestinationControls({ document, ctaId, label, slug, highlighted, allowStyle, onChange }: {
  document: EditorDocument;
  ctaId: string;
  label: string;
  slug: string | null;
  highlighted?: boolean;
  /** Muestra controles de color/estilo propios del botón (independientes de la sección). */
  allowStyle?: boolean;
  onChange: (link: CtaLink) => void;
}) {
  const link = effectiveCtaLink(document, ctaId);
  const { warning } = resolveCtaLink(document, ctaId, { slug: slug ?? "pendiente" });
  const noSlug = link.target === "form" && !slug && document.bookingForm?.mode === "internal";
  const set = (patch: Partial<CtaLink>) => onChange({ ...document.ctaLinks?.[ctaId], ...link, ...patch });
  return (
    <div id={`cta-controls-${ctaId}`} className={`mt-2 space-y-2 border p-2 ${highlighted ? "ring-2 ring-primary" : ""}`}>
      <p className="text-[10px] font-semibold">{label}</p>
      <label className="block text-[10px]">Destino del botón
        <Select value={link.target} onValueChange={(target) => set({ target: target as CtaLink["target"] })}>
          <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="form">Formulario interno</SelectItem>
            <SelectItem value="url">URL</SelectItem>
            <SelectItem value="section">Sección de la landing</SelectItem>
          </SelectContent>
        </Select>
      </label>
      {link.target === "form" && (
        <p className="text-[10px] text-muted-foreground">Lleva a {slug ? <span className="font-medium">/v/{slug}/reservar</span> : "/v/[dirección]/reservar (se crea al publicar)"}.</p>
      )}
      {link.target === "url" && (
        <>
          <label className="block text-[10px]">URL del botón
            <Input value={link.url ?? ""} placeholder="https://…" onChange={(e) => set({ url: e.target.value })} className="mt-1 h-8 text-xs" />
          </label>
          <label className="flex items-center justify-between text-[10px]">Abrir en nueva pestaña
            <Switch checked={Boolean(link.newTab)} onCheckedChange={(newTab) => set({ newTab })} />
          </label>
        </>
      )}
      {link.target === "section" && (
        <label className="block text-[10px]">Sección
          <Select value={link.sectionId ?? ""} onValueChange={(sectionId) => set({ sectionId })}>
            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Elegí una sección" /></SelectTrigger>
            <SelectContent>
              {document.sectionOrder.map((key) => (
                <SelectItem key={key} value={key}>{SECTION_LABELS[key as SectionKey] ?? key}{document.hiddenSections.includes(key) ? " (oculta)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      )}
      {warning && !noSlug && (
        <p className="flex items-start gap-1 text-[10px] text-destructive"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{CTA_WARNING_TEXT[warning]} Mientras tanto lleva al destino de reserva general.</p>
      )}
      {allowStyle && (
        <div className="border-t pt-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Estilo de este botón</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px]">Color del botón
              <input type="color" value={link.style?.background ?? "#b5532f"} onChange={(e) => set({ style: { ...link.style, background: e.target.value } })} className="mt-1 h-8 w-full border bg-transparent p-1" />
            </label>
            <label className="text-[10px]">Color del texto
              <input type="color" value={link.style?.text ?? "#ffffff"} onChange={(e) => set({ style: { ...link.style, text: e.target.value } })} className="mt-1 h-8 w-full border bg-transparent p-1" />
            </label>
            <Select value={link.style?.variant ?? "solid"} onValueChange={(variant) => set({ style: { ...link.style, variant: variant as "solid" | "outline" | "text" } })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Relleno</SelectItem>
                <SelectItem value="outline">Solo borde</SelectItem>
                <SelectItem value="text">Texto subrayado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={link.style?.shape ?? "square"} onValueChange={(shape) => set({ style: { ...link.style, shape: shape as "square" | "rounded" | "pill" } })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Esquinas rectas</SelectItem>
                <SelectItem value="rounded">Redondeado</SelectItem>
                <SelectItem value="pill">Píldora</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {link.style && (
            <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={() => set({ style: undefined })}>Usar el estilo de la sección</Button>
          )}
        </div>
      )}
    </div>
  );
}

import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FIELD_TYPES, FORM_COLOR_FIELDS, isQuestion, newBlockId, type BookingForm, type FormBlock, type FormBlockType } from "@/lib/booking-form";

export function BookingFormEditor({ form, onChange, publicUrl }: { form: BookingForm; onChange: (fn: (form: BookingForm) => BookingForm) => void; publicUrl?: string }) {
  const setBlocks = (fn: (blocks: FormBlock[]) => FormBlock[]) => onChange((f) => ({ ...f, blocks: fn(f.blocks) }));
  const patchBlock = (id: string, patch: Partial<FormBlock>) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (index: number, dir: -1 | 1) => setBlocks((bs) => {
    const next = [...bs]; const j = index + dir;
    if (j < 0 || j >= next.length) return bs;
    [next[index], next[j]] = [next[j], next[index]];
    return next;
  });
  const add = (type: FormBlockType) => setBlocks((bs) => [...bs, {
    id: newBlockId(), type,
    label: type === "heading" ? "Nuevo título" : type === "info" ? "Texto informativo" : "Nueva pregunta",
    options: type === "single" || type === "multi" ? ["Opción 1", "Opción 2"] : undefined,
  }]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-semibold">Botón Reservar</p>
        <Select value={form.mode} onValueChange={(mode) => onChange((f) => ({ ...f, mode: mode as BookingForm["mode"] }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="internal">Formulario de Planeii</SelectItem>
            <SelectItem value="external">Enlace externo (Google Form, etc.)</SelectItem>
          </SelectContent>
        </Select>
        {form.mode === "external" ? (
          <div className="space-y-1"><Label htmlFor="bf-external">URL externa</Label><Input id="bf-external" value={form.externalUrl ?? ""} placeholder="https://forms.gle/…" onChange={(e) => onChange((f) => ({ ...f, externalUrl: e.target.value }))} /></div>
        ) : (
          <p className="text-xs text-muted-foreground">Al publicar, los botones Reservar abren {publicUrl ? <span className="font-medium">{publicUrl}</span> : "la página /reservar del viaje"}. Las respuestas llegan a Solicitudes.</p>
        )}
      </div>

      {form.mode === "internal" && (
        <>
          <div className="space-y-3 border-t pt-5">
            <p className="text-sm font-semibold">Encabezado</p>
            <div className="flex items-center justify-between">
              <Label htmlFor="bf-trip-header" className="text-xs">Mostrar datos del viaje (destino, fechas, precio, cupos)</Label>
              <Switch id="bf-trip-header" checked={form.showTripHeader !== false} onCheckedChange={(showTripHeader) => onChange((f) => ({ ...f, showTripHeader }))} />
            </div>

          </div>

          <div className="space-y-3 border-t pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Colores</p>
              {form.colors && Object.values(form.colors).some(Boolean) && (
                <Button size="sm" variant="ghost" onClick={() => onChange((f) => ({ ...f, colors: {} }))}>Usar los de la landing</Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Sin elegir, se usan los colores de la landing.</p>
            {FORM_COLOR_FIELDS.map((c) => {
              const value = form.colors?.[c.key] ?? "";
              return (
                <div key={c.key} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`bf-color-${c.key}`} className="text-xs">{c.label}</Label>
                  <div className="flex items-center gap-2">
                    <input id={`bf-color-${c.key}`} type="color" className="h-8 w-10 cursor-pointer border bg-transparent" value={value || "#888888"} onChange={(e) => onChange((f) => ({ ...f, colors: { ...f.colors, [c.key]: e.target.value } }))} />
                    {value && <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => onChange((f) => ({ ...f, colors: { ...f.colors, [c.key]: "" } }))}>Quitar</Button>}
                  </div>
                </div>
              );
            })}
          </div>


          <div className="space-y-3 border-t pt-5">
            <p className="text-sm font-semibold">Preguntas</p>
            <p className="text-xs text-muted-foreground">Nombre y apellido, WhatsApp con código de país y correo siempre se piden.</p>
            {form.blocks.map((b, i) => (
              <div key={b.id} className={`space-y-2 border p-3 ${b.hidden ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-1">
                  <span className="mr-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{FIELD_TYPES.find((t) => t.type === b.type)?.label}{b.hidden ? " · oculta" : ""}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Subir" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Bajar" onClick={() => move(i, 1)} disabled={i === form.blocks.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={b.hidden ? "Mostrar" : "Ocultar"} title={b.hidden ? "Mostrar" : "Ocultar sin borrar"} onClick={() => patchBlock(b.id, { hidden: !b.hidden })}>{b.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Duplicar" title="Duplicar" onClick={() => setBlocks((bs) => [...bs.slice(0, i + 1), { ...structuredClone(b), id: newBlockId() }, ...bs.slice(i + 1)])}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Eliminar" title="Eliminar" onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <p className="text-sm font-medium">{b.label}</p>
                {b.type !== "info" && !b.help && <Button type="button" variant="ghost" size="sm" onClick={() => patchBlock(b.id, { help: "Texto de ayuda" })}>Agregar ayuda</Button>}
                {(b.type === "single" || b.type === "multi") && <div className="space-y-1">
                  {(b.options ?? []).map((option, optionIndex) => <div key={optionIndex} className="flex items-center gap-2"><span className="min-w-0 flex-1 text-xs">{option}</span><Button type="button" size="icon" variant="ghost" aria-label="Eliminar opción" onClick={() => patchBlock(b.id, { options: b.options?.filter((_, j) => j !== optionIndex) })}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}
                  <Button type="button" size="sm" variant="outline" onClick={() => patchBlock(b.id, { options: [...(b.options ?? []), "Nueva opción"] })}><Plus /> Agregar opción</Button>
                </div>}
                {isQuestion(b.type) && (
                  <div className="flex items-center justify-between"><Label htmlFor={`req-${b.id}`} className="text-xs">Obligatoria</Label><Switch id={`req-${b.id}`} checked={!!b.required} onCheckedChange={(required) => patchBlock(b.id, { required })} /></div>
                )}
              </div>
            ))}
            <Select value="" onValueChange={(t) => add(t as FormBlockType)}>
              <SelectTrigger><span className="flex items-center gap-2 text-sm"><Plus className="h-4 w-4" /> Agregar bloque</span></SelectTrigger>
              <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-3 border-t pt-5">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">Privacidad</p><Switch checked={form.consent.enabled} onCheckedChange={(enabled) => onChange((f) => ({ ...f, consent: { ...f.consent, enabled } }))} aria-label="Pedir aceptación" /></div>
            {form.consent.enabled && <>
              <div className="grid grid-cols-2 gap-2">
                <Input value={form.consent.linkUrl} placeholder="https://… política" onChange={(e) => onChange((f) => ({ ...f, consent: { ...f.consent, linkUrl: e.target.value } }))} />
              </div>
            </>}
          </div>

          <div className="space-y-3 border-t pt-5">
            <p className="text-sm font-semibold">Pantalla de gracias</p>
            {form.thanks.steps.map((step, index) => <div key={index} className="flex items-center gap-2"><span className="min-w-0 flex-1 text-xs">{step || "Paso vacío"}</span><Button type="button" size="icon" variant="ghost" aria-label="Eliminar paso" onClick={() => onChange((f) => ({ ...f, thanks: { ...f.thanks, steps: f.thanks.steps.filter((_, j) => j !== index) } }))}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}
            <Button type="button" size="sm" variant="outline" onClick={() => onChange((f) => ({ ...f, thanks: { ...f.thanks, steps: [...f.thanks.steps, "Nuevo paso"] } }))}><Plus /> Agregar paso</Button>
            <div className="flex items-center justify-between"><Label className="text-xs">Botón adicional</Label><Switch checked={!!form.thanks.ctaLabel} onCheckedChange={(enabled) => onChange((f) => ({ ...f, thanks: { ...f.thanks, ctaLabel: enabled ? "Continuar" : "" } }))} /></div>
            {form.thanks.ctaLabel && <Input value={form.thanks.ctaUrl} aria-label="Enlace del botón de gracias" placeholder="https://wa.me/…" onChange={(e) => onChange((f) => ({ ...f, thanks: { ...f.thanks, ctaUrl: e.target.value } }))} />}

          </div>

          <div className="space-y-2 border-t pt-5">
            <p className="text-sm font-semibold">Mensaje inicial de WhatsApp</p>
            <p className="text-xs text-muted-foreground">Se usa en Solicitudes al tocar "Escribir por WhatsApp". Variables: [Nombre] y [Viaje].</p>
            <Textarea value={form.whatsappTemplate} onChange={(e) => onChange((f) => ({ ...f, whatsappTemplate: e.target.value }))} aria-label="Mensaje inicial de WhatsApp" />
          </div>
          <p className="text-xs text-muted-foreground">Los cambios del formulario se aplican al publicar la página.</p>
        </>
      )}
    </div>
  );
}

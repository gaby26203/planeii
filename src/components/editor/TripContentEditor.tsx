import { ChevronDown, ChevronUp, GripVertical, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { HostData, Img, LandingCopy, TripData } from "@/data/trip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copyFieldLabel, getTripByPath, setTripByPath } from "@/lib/trip-editor";
import { tripMetaItems, metaLabelPath, metaValuePath, newMetaItem } from "@/lib/trip-meta";
import { itineraryGroupPlan, itineraryGroupRanges, setItineraryGroupSize, setItineraryGroupAlt, addItineraryGroup, removeItineraryGroup, canAddItineraryGroup } from "@/lib/trip-itinerary";

function Field({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  const id = `landing-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{multiline ? <Textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} /> : <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />}</div>;
}

function RowActions({ index, length, onMove, onRemove }: { index: number; length: number; onMove: (from: number, to: number) => void; onRemove: () => void }) {
  return <div className="flex justify-end gap-1">
    <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label="Subir"><ChevronUp /></Button>
    <Button type="button" size="icon" variant="ghost" disabled={index === length - 1} onClick={() => onMove(index, index + 1)} aria-label="Bajar"><ChevronDown /></Button>
    <Button type="button" size="icon" variant="ghost" onClick={onRemove} aria-label="Eliminar"><Trash2 /></Button>
  </div>;
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : undefined }} className="relative border p-3 pt-7">
      <button
        type="button"
        className="absolute left-1 top-1.5 cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Arrastrar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

function useDragSort<T>(items: T[], onSorted: (items: T[]) => void) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((_, i) => `sort-${i}` === active.id);
    const to = items.findIndex((_, i) => `sort-${i}` === over.id);
    if (from < 0 || to < 0) return;
    onSorted(arrayMove(items, from, to));
  };
  return { sensors, onDragEnd, ids: items.map((_, i) => `sort-${i}`) };
}

function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
  const move = (from: number, to: number) => { const next = [...items]; const [item] = next.splice(from, 1); if (item === undefined) return; next.splice(to, 0, item); onChange(next); };
  const { sensors, onDragEnd, ids } = useDragSort(items, onChange);
  return <div className="space-y-3">
    <Label>{label}</Label>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableRow key={index} id={`sort-${index}`}>
            <Textarea rows={2} value={item} onChange={(e) => onChange(items.map((x, i) => i === index ? e.target.value : x))} />
            <RowActions index={index} length={items.length} onMove={move} onRemove={() => onChange(items.filter((_, i) => i !== index))} />
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
    <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, "Nuevo texto"])}><Plus /> Agregar</Button>
  </div>;
}

function RepeatEditor<T>({ items, onChange, create, children, addLabel }: { items: T[]; onChange: (items: T[]) => void; create: () => T; children: (item: T, update: (item: T) => void, index: number) => ReactNode; addLabel: string }) {
  const move = (from: number, to: number) => { const next = [...items]; const [item] = next.splice(from, 1); if (item === undefined) return; next.splice(to, 0, item); onChange(next); };
  const { sensors, onDragEnd, ids } = useDragSort(items, onChange);
  return <div className="space-y-4">
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableRow key={index} id={`sort-${index}`}>
            {children(item, (next) => onChange(items.map((x, i) => i === index ? next : x)), index)}
            <RowActions index={index} length={items.length} onMove={move} onRemove={() => onChange(items.filter((_, i) => i !== index))} />
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
    <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, create()])}><Plus /> {addLabel}</Button>
  </div>;
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled?: boolean; onChange: (value: number) => void }) {
  const id = useId();
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min={1} step={1} inputMode="numeric" value={value} disabled={disabled} onChange={(e) => onChange(e.currentTarget.valueAsNumber)} /></div>;
}

function ItineraryGroupsEditor({ trip, onChange, onChooseImage }: { trip: TripData; onChange: (trip: TripData) => void; onChooseImage: (key: string) => void }) {
  const plan = itineraryGroupPlan(trip);
  const ranges = itineraryGroupRanges(trip);
  return <div className="space-y-3 border-t pt-4">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
      <Label>Bloques del itinerario</Label>
      <span className="text-xs text-muted-foreground">{plan.map((group) => group.size).join(" + ")} = {trip.itinerary.length} días</span>
    </div>
    <p className="text-xs text-muted-foreground">Cada bloque se muestra con su foto a un lado y sus días al otro, alternando. Cambiar el tamaño de un bloque le quita o le devuelve días al vecino.</p>
    <div className="space-y-3">
      {plan.map((group, index) => <div key={group.id} className="space-y-3 border p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <NumberField label={`Días del bloque ${index + 1} · días ${ranges[index]}`} value={group.size} disabled={plan.length === 1} onChange={(size) => onChange(setItineraryGroupSize(trip, group.id, size))} />
          <Button type="button" size="icon" variant="ghost" disabled={plan.length <= 1} onClick={() => onChange(removeItineraryGroup(trip, group.id))} aria-label={`Eliminar bloque ${index + 1}`}><Trash2 /></Button>
        </div>
        <Field label={`Texto alternativo ${index + 1}`} value={group.image.alt} onChange={(alt) => onChange(setItineraryGroupAlt(trip, index, alt))} />
        <Button type="button" variant="outline" onClick={() => onChooseImage(`itinerary-group-${index}`)}><ImagePlus /> {group.image.src ? "Cambiar foto" : "Agregar foto"}</Button>
      </div>)}
    </div>
    <Button type="button" variant="outline" size="sm" disabled={!canAddItineraryGroup(trip)} onClick={() => onChange(addItineraryGroup(trip))}><Plus /> Agregar bloque</Button>
  </div>;
}

const blankImage = (): Img => ({ src: "", alt: "Nueva imagen" });

export function TripContentEditor({ trip, onChange, onChooseImage, openSections, onOpenSections, focusField }: {
  trip: TripData;
  onChange: (trip: TripData) => void;
  onChooseImage: (key: string) => void;
  openSections?: string[];
  onOpenSections?: (sections: string[]) => void;
  focusField?: string | null;
}) {
  const set = <K extends keyof TripData>(key: K, value: TripData[K]) => onChange({ ...trip, [key]: value });
  const copy = (key: keyof LandingCopy, value: string) => set("copy", { ...trip.copy, [key]: value });

  useEffect(() => {
    if (!focusField) return;
    document.getElementById(focusField)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusField]);

  return <Accordion type="multiple" value={openSections} onValueChange={onOpenSections} className="space-y-1">
    <AccordionItem value="cover"><AccordionTrigger>Portada y reserva</AccordionTrigger><AccordionContent className="space-y-4">
      <Field label="Marca" value={trip.brand} onChange={(v) => set("brand", v)} /><Field label="Destino" value={trip.destination} onChange={(v) => set("destination", v)} /><Field label="País" value={trip.country} onChange={(v) => set("country", v)} />
      <Field label="Título principal" value={trip.title} multiline onChange={(v) => set("title", v)} /><Field label="Texto introductorio" value={trip.subtitle} multiline onChange={(v) => set("subtitle", v)} />
      <div className="grid grid-cols-2 gap-3"><Field label="Precio" value={trip.price} onChange={(v) => set("price", v)} /><Field label="Moneda" value={trip.currency} onChange={(v) => set("currency", v)} /><Field label="Cupos" value={trip.spots} onChange={(v) => set("spots", v)} /><Field label="Duración" value={trip.duration} onChange={(v) => set("duration", v)} /><Field label="Grupo" value={trip.groupSize} onChange={(v) => set("groupSize", v)} /><Field label="Nivel" value={trip.level} onChange={(v) => set("level", v)} /></div>
      <Field label="Fechas" value={trip.dates} onChange={(v) => set("dates", v)} /><Field label="Fechas cortas" value={trip.datesShort} onChange={(v) => set("datesShort", v)} />
      <Field label="Disponibilidad" value={trip.copy.heroAvailability} onChange={(v) => copy("heroAvailability", v)} /><Field label="Botón de reserva" value={trip.copy.heroBook} onChange={(v) => copy("heroBook", v)} /><Field label="Botón itinerario" value={trip.copy.heroItinerary} onChange={(v) => copy("heroItinerary", v)} />
    </AccordionContent></AccordionItem>

    <AccordionItem value="meta"><AccordionTrigger>Datos debajo de la portada</AccordionTrigger><AccordionContent className="space-y-4">
      <RepeatEditor items={tripMetaItems(trip)} onChange={(items) => set("metaItems", items)} create={newMetaItem} addLabel="Agregar etiqueta">{(item, _update, index) => {
        const labelPath = metaLabelPath(item, index);
        const valuePath = metaValuePath(item, index);
        const edit = (path: string, value: string) => onChange(setTripByPath({ ...trip, metaItems: tripMetaItems(trip) }, path, value));
        return <><Field label={`Etiqueta ${index + 1}`} value={getTripByPath(trip, labelPath)} onChange={(value) => edit(labelPath, value)} /><Field label={`Valor ${index + 1}`} value={getTripByPath(trip, valuePath)} onChange={(value) => edit(valuePath, value)} /></>;
      }}</RepeatEditor>
    </AccordionContent></AccordionItem>

    <AccordionItem value="story"><AccordionTrigger>Historia del viaje</AccordionTrigger><AccordionContent className="space-y-4">
      <Field label="Etiqueta historia" value={trip.copy.storyEyebrow} onChange={(v) => copy("storyEyebrow", v)} /><ListEditor label="Título (líneas)" items={trip.story.heading} onChange={(heading) => set("story", { ...trip.story, heading })} /><ListEditor label="Párrafos" items={trip.story.paragraphs} onChange={(paragraphs) => set("story", { ...trip.story, paragraphs })} /><Field label="Enlace de historia" value={trip.copy.storyLink} onChange={(v) => copy("storyLink", v)} /><Field label="Pie de foto" value={trip.copy.storyCaption} onChange={(v) => copy("storyCaption", v)} /><Field label="Texto alternativo" value={trip.story.image.alt} onChange={(alt) => set("story", { ...trip.story, image: { ...trip.story.image, alt } })} /><Button type="button" variant="outline" onClick={() => onChooseImage("story")}>Cambiar foto</Button>
    </AccordionContent></AccordionItem>

    <AccordionItem value="highlights"><AccordionTrigger>Experiencias</AccordionTrigger><AccordionContent className="space-y-4"><Field label="Etiqueta experiencias" value={trip.copy.highlightsEyebrow} onChange={(v) => copy("highlightsEyebrow", v)} /><Field label="Título experiencias" value={trip.copy.highlightsTitle} onChange={(v) => copy("highlightsTitle", v)} /><RepeatEditor items={trip.highlights} onChange={(v) => set("highlights", v)} create={() => ({ title: "Nueva experiencia", description: "Descripción", image: blankImage() })} addLabel="Agregar experiencia">{(item, update, index) => <><Field label={`Experiencia ${index + 1}`} value={item.title} onChange={(title) => update({ ...item, title })} /><Field label="Descripción" value={item.description} multiline onChange={(description) => update({ ...item, description })} /><Field label="Texto alternativo" value={item.image.alt} onChange={(alt) => update({ ...item, image: { ...item.image, alt } })} /><Button type="button" variant="outline" onClick={() => onChooseImage(`highlight-${index}`)}>Cambiar foto</Button></>}</RepeatEditor></AccordionContent></AccordionItem>

    <AccordionItem value="included"><AccordionTrigger>Incluye y no incluye</AccordionTrigger><AccordionContent className="space-y-4"><Field label="Etiqueta sección" value={trip.copy.includedEyebrow} onChange={(v) => copy("includedEyebrow", v)} /><Field label="Título sección" value={trip.copy.includedTitle} onChange={(v) => copy("includedTitle", v)} /><Field label="Etiqueta incluye" value={trip.copy.includedLabel} onChange={(v) => copy("includedLabel", v)} /><ListEditor label="Incluye" items={trip.included} onChange={(v) => set("included", v)} /><Field label="Etiqueta no incluye" value={trip.copy.notIncludedLabel} onChange={(v) => copy("notIncludedLabel", v)} /><ListEditor label="No incluye" items={trip.notIncluded} onChange={(v) => set("notIncluded", v)} /></AccordionContent></AccordionItem>

    <AccordionItem value="itinerary"><AccordionTrigger>Itinerario</AccordionTrigger><AccordionContent className="space-y-4"><Field label="Etiqueta itinerario" value={trip.copy.itineraryEyebrow} onChange={(v) => copy("itineraryEyebrow", v)} /><Field label="Título itinerario" value={trip.copy.itineraryTitle} onChange={(v) => copy("itineraryTitle", v)} /><Field label="Prefijo del día" value={trip.copy.itineraryDay} onChange={(v) => copy("itineraryDay", v)} /><RepeatEditor items={trip.itinerary} onChange={(v) => set("itinerary", v.map((x, i) => ({ ...x, day: i + 1 })))} create={() => ({ day: trip.itinerary.length + 1, title: "Nuevo día", description: "Descripción" })} addLabel="Agregar día">{(item, update, index) => <><Field label={`Día ${index + 1}`} value={item.title} onChange={(title) => update({ ...item, title })} /><Field label="Descripción" value={item.description} multiline onChange={(description) => update({ ...item, description })} /></>}</RepeatEditor><ItineraryGroupsEditor trip={trip} onChange={onChange} onChooseImage={onChooseImage} /></AccordionContent></AccordionItem>

    <AccordionItem value="accommodation"><AccordionTrigger>Alojamiento</AccordionTrigger><AccordionContent className="space-y-4"><Field label="Etiqueta alojamiento" value={trip.copy.accommodationEyebrow} onChange={(v) => copy("accommodationEyebrow", v)} /><Field label="Título alojamiento" value={trip.copy.accommodationTitle} onChange={(v) => copy("accommodationTitle", v)} /><RepeatEditor items={trip.accommodations} onChange={(v) => set("accommodations", v)} create={() => ({ name: "Nuevo alojamiento", location: "Ubicación", nights: "1 noche", description: "Descripción", features: [], image: blankImage() })} addLabel="Agregar alojamiento">{(item, update, index) => <><Field label="Nombre" value={item.name} onChange={(name) => update({ ...item, name })} /><Field label="Ubicación" value={item.location} onChange={(location) => update({ ...item, location })} /><Field label="Noches" value={item.nights} onChange={(nights) => update({ ...item, nights })} /><Field label="Descripción" value={item.description} multiline onChange={(description) => update({ ...item, description })} /><ListEditor label="Características" items={item.features} onChange={(features) => update({ ...item, features })} /><Field label="Texto alternativo" value={item.image.alt} onChange={(alt) => update({ ...item, image: { ...item.image, alt } })} /><Button type="button" variant="outline" onClick={() => onChooseImage(`accommodation-${index}`)}>Cambiar foto</Button></>}</RepeatEditor></AccordionContent></AccordionItem>

    <AccordionItem value="hosts"><AccordionTrigger>Anfitriones</AccordionTrigger><AccordionContent className="space-y-4"><Field label="Etiqueta anfitriones" value={trip.copy.hostEyebrow} onChange={(v) => copy("hostEyebrow", v)} /><RepeatEditor<HostData> items={trip.hosts} onChange={(hosts) => onChange({ ...trip, hosts, host: hosts[0] ?? trip.host })} create={() => ({ name: "Nuevo anfitrión", bio: "Biografía", image: blankImage() })} addLabel="Agregar anfitrión">{(item, update, index) => <><Field label="Nombre" value={item.name} onChange={(name) => update({ ...item, name })} /><Field label="Biografía" value={item.bio} multiline onChange={(bio) => update({ ...item, bio })} /><Field label="Texto alternativo" value={item.image.alt} onChange={(alt) => update({ ...item, image: { ...item.image, alt } })} /><Button type="button" variant="outline" onClick={() => onChooseImage(`host-${index}`)}>Cambiar foto</Button></>}</RepeatEditor></AccordionContent></AccordionItem>

    <AccordionItem value="traveler"><AccordionTrigger>Perfil de viajera</AccordionTrigger><AccordionContent className="space-y-4"><Field label="Etiqueta perfil" value={trip.copy.travelerEyebrow} onChange={(v) => copy("travelerEyebrow", v)} /><Field label="Título perfil" value={trip.copy.travelerTitle} onChange={(v) => copy("travelerTitle", v)} /><ListEditor label="Para ti" items={trip.travelerProfile.forYou} onChange={(forYou) => set("travelerProfile", { ...trip.travelerProfile, forYou })} /><Field label="Título no recomendado" value={trip.copy.travelerNotTitle} onChange={(v) => copy("travelerNotTitle", v)} /><ListEditor label="No es para ti" items={trip.travelerProfile.notForYou} onChange={(notForYou) => set("travelerProfile", { ...trip.travelerProfile, notForYou })} /><Field label="Nota final" value={trip.copy.travelerNote} multiline onChange={(v) => copy("travelerNote", v)} /></AccordionContent></AccordionItem>


    <AccordionItem value="testimonials"><AccordionTrigger>Testimonios</AccordionTrigger><AccordionContent className="space-y-4"><Field label="Etiqueta testimonios" value={trip.copy.testimonialsEyebrow} onChange={(v) => copy("testimonialsEyebrow", v)} /><Field label="Título testimonios" value={trip.copy.testimonialsTitle} onChange={(v) => copy("testimonialsTitle", v)} /><RepeatEditor items={trip.testimonials} onChange={(v) => set("testimonials", v)} create={() => ({ quote: "Testimonio", name: "Nombre", location: "Lugar" })} addLabel="Agregar testimonio">{(item, update) => <><Field label="Testimonio" value={item.quote} multiline onChange={(quote) => update({ ...item, quote })} /><Field label="Nombre" value={item.name} onChange={(name) => update({ ...item, name })} /><Field label="Lugar" value={item.location} onChange={(location) => update({ ...item, location })} /></>}</RepeatEditor></AccordionContent></AccordionItem>

    <AccordionItem value="faq"><AccordionTrigger>Preguntas frecuentes</AccordionTrigger><AccordionContent className="space-y-4"><Field label="Etiqueta preguntas" value={trip.copy.faqEyebrow} onChange={(v) => copy("faqEyebrow", v)} /><Field label="Título preguntas" value={trip.copy.faqTitle} onChange={(v) => copy("faqTitle", v)} /><RepeatEditor items={trip.faq} onChange={(v) => set("faq", v)} create={() => ({ q: "Nueva pregunta", a: "Respuesta" })} addLabel="Agregar pregunta">{(item, update) => <><Field label="Pregunta" value={item.q} onChange={(q) => update({ ...item, q })} /><Field label="Respuesta" value={item.a} multiline onChange={(a) => update({ ...item, a })} /></>}</RepeatEditor></AccordionContent></AccordionItem>

    <AccordionItem value="gallery"><AccordionTrigger>Galería</AccordionTrigger><AccordionContent className="space-y-4"><Field label="Etiqueta galería" value={trip.copy.galleryEyebrow} onChange={(v) => copy("galleryEyebrow", v)} /><RepeatEditor items={trip.gallery} onChange={(v) => set("gallery", v)} create={() => blankImage()} addLabel="Agregar foto">{(item, update, index) => <><Field label="Texto alternativo" value={item.alt} onChange={(alt) => update({ ...item, alt })} /><Field label="Pie de foto" value={item.caption ?? ""} onChange={(caption) => update({ ...item, caption })} /><Button type="button" variant="outline" onClick={() => onChooseImage(`gallery-${index}`)}>Cambiar foto</Button></>}</RepeatEditor><Field label="Botón ver más" value={trip.copy.galleryMore} onChange={(v) => copy("galleryMore", v)} /><Field label="Botón ver menos" value={trip.copy.galleryLess} onChange={(v) => copy("galleryLess", v)} /></AccordionContent></AccordionItem>

    <AccordionItem value="closing"><AccordionTrigger>Cierre, contacto y navegación</AccordionTrigger><AccordionContent className="space-y-4"><Field label="Título final" value={trip.finalCta.heading} onChange={(heading) => set("finalCta", { ...trip.finalCta, heading })} /><Field label="Botón final" value={trip.finalCta.button} onChange={(button) => set("finalCta", { ...trip.finalCta, button })} /><Field label="Nota final" value={trip.finalCta.note} multiline onChange={(note) => set("finalCta", { ...trip.finalCta, note })} /><Field label="Email" value={trip.contact.email} onChange={(email) => set("contact", { ...trip.contact, email })} /><Field label="Instagram" value={trip.contact.instagram} onChange={(instagram) => set("contact", { ...trip.contact, instagram })} /><Field label="WhatsApp" value={trip.contact.whatsapp ?? ""} onChange={(whatsapp) => set("contact", { ...trip.contact, whatsapp })} />
      {(Object.keys(trip.copy) as (keyof LandingCopy)[]).filter((key) => key.startsWith("nav") || key.startsWith("booking") || key.startsWith("footer") || key === "stickyBook").map((key) => <Field key={key} label={copyFieldLabel(key)} value={trip.copy[key]} onChange={(v) => copy(key, v)} />)}
    </AccordionContent></AccordionItem>
  </Accordion>;
}

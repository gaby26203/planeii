import { useState } from "react";
import type { TripData } from "@/data/trip";
import { BookLink, CtaText, EditableImage, EditableText, SectionHead, isPlaceholder, useEditorPreview } from "./shared";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { itinerarySlices } from "@/lib/trip-itinerary";
import { cn } from "@/lib/utils";

export function Included({ trip }: { trip: TripData }) {
 return (
 <section id="incluye" className="bg-card section-pad ">
 <div className="container-ed grid gap-16 @4xl:grid-cols-12">
 {/* En móvil esta envoltura desaparece (contents) y el botón pasa al final de la sección; en escritorio vuelve a su columna, bajo el título. */}
 <div className="contents @4xl:col-span-5 @4xl:block">
 <SectionHead
 eyebrow={<EditableText path="copy.includedEyebrow" value={trip.copy.includedEyebrow} />}
 title={<EditableText path="copy.includedTitle" value={trip.copy.includedTitle} />}
 />
 <BookLink ctaId="included" className="order-3 @4xl:order-none @4xl:mt-10"><CtaText ctaId="included" value={trip.copy.heroBook} /></BookLink>
 </div>
 <div className="order-2 @4xl:order-none @4xl:col-span-7 grid gap-12 sm:grid-cols-2">
 <IncludedList items={trip.included} label={trip.copy.includedLabel} labelPath="copy.includedLabel" />
 <NotIncluded items={trip.notIncluded} label={trip.copy.notIncludedLabel} labelPath="copy.notIncludedLabel" />
 </div>
 </div>
 </section>
 );
}

export function IncludedList({ items, label, labelPath }: { items: string[]; label?: string; labelPath?: string }) {
 return (
 <div>
 <h3 className="eyebrow text-secondary"><EditableText path={labelPath ?? "copy.includedLabel"} value={label ?? "Incluye"} /></h3>
 <ul className="mt-6">
 {items.map((it, i) => (
 <li key={i} className="flex gap-4 border-b py-4"><span aria-hidden>✓</span><EditableText path={`included.${i}`} value={it} /></li>
 ))}
 </ul>
 </div>
 );
}

export function NotIncluded({ items, label, labelPath }: { items: string[]; label?: string; labelPath?: string }) {
 return (
 <div>
 <h3 className="eyebrow text-muted-foreground"><EditableText path={labelPath ?? "copy.notIncludedLabel"} value={label ?? "No incluye"} /></h3>
 <ul className="mt-6 text-muted-foreground">
 {items.map((it, i) => (
 <li key={i} className="flex gap-4 border-b py-4"><span aria-hidden>✕</span><EditableText path={`notIncluded.${i}`} value={it} /></li>
 ))}
 </ul>
 </div>
 );
}

export function Itinerary({ trip }: { trip: TripData }) {
  const [open, setOpen] = useState<string>();
  const slices = itinerarySlices(trip);
  return (
    <section id="itinerario" className="container-ed section-pad ">
      <SectionHead
        eyebrow={<EditableText path="copy.itineraryEyebrow" value={trip.copy.itineraryEyebrow} />}
        title={<EditableText path="copy.itineraryTitle" value={trip.copy.itineraryTitle} />}
      />
      <div className="mt-16">
        {slices.map((slice, block) => {
          const hasImage = Boolean(slice.group.image.src) && !isPlaceholder(slice.group.image.src);
          const photo = hasImage ? (
            <figure className={cn("order-2 min-w-0 @4xl:col-span-5", block % 2 === 1 ? "@4xl:order-1" : "@4xl:order-2")}>
              <EditableImage
                image={slice.group.image}
                imageKey={`itinerary-group-${block}`}
                loading="lazy"
                className={cn("w-full object-cover", block % 2 === 0 ? "aspect-[4/5]" : "aspect-[4/3]")}
              />
            </figure>
          ) : null;
          const days = (
            <div className={cn("order-1 min-w-0", hasImage ? "@4xl:col-span-7" : "@4xl:col-span-12", block % 2 === 1 && hasImage ? "@4xl:order-2" : "@4xl:order-1")}>
              <Accordion type="single" collapsible value={open} onValueChange={setOpen}>
                {slice.days.map(({ day, index }) => (
                  <AccordionItem key={day.day} value={`day-${index}`}>
                    <AccordionTrigger className="gap-6 py-7 font-serif text-3xl font-normal leading-tight hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring md:py-9 md:text-4xl [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-current motion-reduce:transition-none [&>svg]:motion-reduce:transition-none">
                      <span className="min-w-0">{trip.copy.itineraryDay} {day.day}</span>
                    </AccordionTrigger>
                    <AccordionContent className="min-w-0 pb-8 text-base md:pb-10">
                      <h3 className="text-2xl md:text-3xl"><EditableText path={`itinerary.${index}.title`} value={day.title} /></h3>
                      <p className="accordion-body mt-4 max-w-2xl leading-relaxed text-muted-foreground"><EditableText path={`itinerary.${index}.description`} value={day.description} /></p>
                      {day.image?.src && <img src={day.image.src} alt={day.image.alt} loading="lazy" className="mt-6 h-auto w-full max-w-2xl" />}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          );
          return (
            <div key={slice.group.id} className="itinerary-block grid items-start gap-10 @4xl:grid-cols-12 @4xl:gap-14">
              {days}
              {photo}
            </div>
          );
        })}
      </div>
      <div className="mt-12"><BookLink ctaId="itinerary"><CtaText ctaId="itinerary" value={trip.copy.heroBook} /></BookLink></div>
    </section>
  );
}

export function Gallery({ trip }: { trip: TripData }) {
 const g = trip.gallery;
 const { enabled: editorPreview } = useEditorPreview();
 const [showMore, setShowMore] = useState(false);
 const extra = g.slice(6);
 const visiblePhotos = editorPreview || showMore ? g : g.slice(0, 6);
  const Fig = ({ i }: { i: number }) =>
 g[i] ? (
  <figure className="visual-story-figure">
  <EditableImage image={g[i]} imageKey={`gallery-${i}`} loading="lazy" className="visual-story-image" />
 {g[i].caption && <figcaption className="mt-2 text-xs text-muted-foreground"><EditableText path={`gallery.${i}.caption`} value={g[i].caption ?? ""} /></figcaption>}
 </figure>
 ) : null;
 return (
 <section aria-label="Galería" className="section-pad">
 <div className="container-ed">
 <p className="eyebrow text-primary"><EditableText path="copy.galleryEyebrow" value={trip.copy.galleryEyebrow} /></p>
  <div className="mt-10 grid grid-cols-2 items-start gap-4 @4xl:grid-cols-3 md:gap-6">
  {visiblePhotos.map((_, i) => <Fig key={i} i={i} />)}
 </div>
 {extra.length > 0 && (
 <>
  {!editorPreview && <div className="mt-10 flex justify-center">
 <button type="button" onClick={() => setShowMore((v) => !v)} className="btn-ghost">
 {showMore ? <EditableText path="copy.galleryLess" value={trip.copy.galleryLess} /> : <EditableText path="copy.galleryMore" value={trip.copy.galleryMore} />}
 </button>
  </div>}
 </>
 )}
 </div>
 </section>
 );
}

export function Accommodation({ trip }: { trip: TripData }) {
 return (
 <section className="bg-card section-pad ">
 <div className="container-ed">
 <SectionHead
 eyebrow={<EditableText path="copy.accommodationEyebrow" value={trip.copy.accommodationEyebrow} />}
 title={<EditableText path="copy.accommodationTitle" value={trip.copy.accommodationTitle} />}
 />
 {trip.accommodations.map((a, index) => (
 <article key={index} className="mt-16 grid gap-10 @4xl:grid-cols-12">
 <EditableImage image={a.image} imageKey={`accommodation-${index}`} loading="lazy" className="aspect-[4/3] w-full object-cover @4xl:col-span-7" />
 <div className="@4xl:col-span-5 @4xl:pt-6">
 <p className="eyebrow text-muted-foreground"><EditableText path={`accommodations.${index}.location`} value={a.location} /> · <EditableText path={`accommodations.${index}.nights`} value={a.nights} /></p>
 <h3 className="mt-4 text-4xl"><EditableText path={`accommodations.${index}.name`} value={a.name} /></h3>
 <p className="mt-6 text-lg leading-relaxed text-muted-foreground"><EditableText path={`accommodations.${index}.description`} value={a.description} /></p>
 <ul className="mt-8 border-t">
 {a.features.map((f, j) => <li key={j} className="border-b py-3 text-sm"><EditableText path={`accommodations.${index}.features.${j}`} value={f} /></li>)}
 </ul>
 </div>
 </article>
 ))}
 </div>
 </section>
 );
}

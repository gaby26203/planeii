import type { TripData } from "@/data/trip";
import { BookLink, CtaText, EditableImage, EditableText, useEditorPreview } from "./shared";
import type { CSSProperties } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTripByPath } from "@/lib/trip-editor";
import { tripMetaItems, metaLabelPath, metaValuePath } from "@/lib/trip-meta";

export function Hero({ trip }: { trip: TripData }) {
  const mobilePosition = trip.heroImage.mobilePosition;
  const heroStyle = mobilePosition ? {
    "--hero-mobile-position": `${mobilePosition.x}% ${mobilePosition.y}%`,
  } as CSSProperties : undefined;
  return (
    <section id="top" className="grid min-h-[100svh] overflow-hidden bg-ink text-cream">
      <EditableImage image={trip.heroImage} imageKey="heroImage" width={1920} height={1088} fetchPriority="high" className="hero-cover-image col-start-1 row-start-1 h-full w-full object-cover" style={heroStyle} />
      <div className="pointer-events-none col-start-1 row-start-1 overlay-hero" aria-hidden />
      <div className="container-ed relative col-start-1 row-start-1 self-end pb-14 pt-32 md:pb-20">
        <p className="eyebrow animate-rise text-accent"><EditableText path="copy.heroEyebrow" value={trip.copy.heroEyebrow} /></p>
        <h1 className="landing-display animate-rise mt-6 max-w-5xl leading-[0.98]" style={{ animationDelay: ".1s" }}>
          <EditableText path="title" value={trip.title} />
        </h1>
        <p className="animate-rise mt-8 max-w-xl text-base leading-relaxed opacity-85 md:text-lg" style={{ animationDelay: ".2s" }}><EditableText path="subtitle" value={trip.subtitle} /></p>
        <div className="animate-rise mt-8 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: ".25s" }}>
          <BookLink ctaId="hero"><CtaText ctaId="hero" value={trip.copy.heroBook} /></BookLink>
          <BookLink ctaId="heroItinerary" variant="ghost"><CtaText ctaId="heroItinerary" value={trip.copy.heroItinerary} /></BookLink>
        </div>
      </div>
    </section>
  );
}

export function TripMeta({ trip }: { trip: TripData }) {
  const items = tripMetaItems(trip);
  const { enabled } = useEditorPreview();
  const action = (type: string, id?: string) => window.parent.postMessage({ type, id }, window.location.origin);
  if (!items.length && !enabled) return null;
  return (
    <section aria-label="Resumen del viaje" className="trip-meta-section border-b bg-background">
      <div className="container-ed">
      <dl className="trip-meta-grid">
        {items.map((item, index) => {
          const labelPath = metaLabelPath(item, index);
          const valuePath = metaValuePath(item, index);
          const label = getTripByPath(trip, labelPath);
          return <div key={item.id} className="trip-meta-item relative pr-8">
            {enabled && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-7 w-7" title={`Eliminar etiqueta ${label}`} aria-label={`Eliminar etiqueta ${label}`} onClick={() => action("trip-editor-meta-remove", item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
            <dt className="eyebrow text-muted-foreground"><EditableText key={`${labelPath}:${label}`} path={labelPath} styleKey={`meta.${item.id}.label`} value={label} /></dt>
            <dd className="mt-2 font-serif text-xl md:text-2xl">{item.kind === "price" ? <><EditableText path="copy.bookingFrom" styleKey="meta.price.prefix" value={trip.copy.bookingFrom} /> <EditableText path="price" styleKey="meta.price.value" value={trip.price} /> <EditableText path="currency" styleKey="meta.price.currency" value={trip.currency} /></> : <EditableText key={`${valuePath}:${getTripByPath(trip, valuePath)}`} path={valuePath} styleKey={`meta.${item.id}.value`} value={getTripByPath(trip, valuePath)} />}</dd>
          </div>;
        })}
      </dl>
      {enabled && <div className="trip-meta-actions"><Button type="button" variant="outline" size="sm" onClick={() => action("trip-editor-meta-add")}><Plus /> Agregar etiqueta</Button></div>}
      </div>
    </section>
  );
}

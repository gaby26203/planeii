import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TripData } from "@/data/trip";
import { EditableImage, EditableText, SectionHead } from "./shared";

const AUTOPLAY_MS = 5000;

export function Highlights({ trip }: { trip: TripData }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);
  const count = trip.highlights.length;

  const step = () => {
    const track = trackRef.current;
    const card = track?.querySelector<HTMLElement>("[data-card]");
    if (!track || !card) return 0;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
    return card.offsetWidth + gap;
  };

  const go = useCallback((dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth - 2;
    if (dir === 1 && track.scrollLeft >= max) track.scrollTo({ left: 0, behavior: "smooth" });
    else if (dir === -1 && track.scrollLeft <= 2) track.scrollTo({ left: track.scrollWidth, behavior: "smooth" });
    else track.scrollBy({ left: dir * step(), behavior: "smooth" });
  }, []);

  const goTo = (i: number) => trackRef.current?.scrollTo({ left: i * step(), behavior: "smooth" });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => {
      const s = step();
      if (!s) return;
      const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
      setActive(atEnd ? count - 1 : Math.round(track.scrollLeft / s));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [count]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || count < 2) return;
    const id = window.setInterval(() => { if (!pausedRef.current && !document.hidden) go(1); }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, go]);

  const pause = () => { pausedRef.current = true; };
  const resume = () => { pausedRef.current = false; };

  return (
    <section id="experiencias" className="bg-ink section-pad text-ink-foreground">
      <div className="container-ed">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
          <SectionHead
            eyebrow={<EditableText path="copy.highlightsEyebrow" value={trip.copy.highlightsEyebrow} />}
            title={<EditableText path="copy.highlightsTitle" value={trip.copy.highlightsTitle} />}
          />
          {count > 1 && (
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => go(-1)} aria-label="Experiencia anterior" className="grid h-11 w-11 place-items-center rounded-full border border-current/30 transition hover:bg-current/10"><ChevronLeft className="h-5 w-5" /></button>
              <button type="button" onClick={() => go(1)} aria-label="Experiencia siguiente" className="grid h-11 w-11 place-items-center rounded-full border border-current/30 transition hover:bg-current/10"><ChevronRight className="h-5 w-5" /></button>
            </div>
          )}
        </div>
        <div
          ref={trackRef}
          onMouseEnter={pause}
          onMouseLeave={resume}
          onPointerDown={pause}
          onTouchStart={pause}
          onTouchEnd={resume}
          onFocus={pause}
          onBlur={resume}
          role="region"
          aria-roledescription="carrusel"
          aria-label="Experiencias del viaje"
          className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] md:mt-16 md:gap-8 [&::-webkit-scrollbar]:hidden"
        >
          {trip.highlights.map((h, i) => (
            <article key={i} data-card className="w-[85%] shrink-0 snap-start @2xl:w-[55%] @5xl:w-[41%]">
              <div className="aspect-[4/3] overflow-hidden">
                <EditableImage image={h.image} imageKey={`highlight-${i}`} loading="lazy" className="h-full w-full object-cover brightness-90 saturate-[.9]" />
              </div>
              <span className="mt-6 block font-serif text-4xl text-accent md:text-5xl">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 text-xl leading-tight md:text-2xl"><EditableText path={`highlights.${i}.title`} value={h.title} /></h3>
              <p className="mt-2 text-sm leading-relaxed opacity-60 md:text-[15px]"><EditableText path={`highlights.${i}.description`} value={h.description} /></p>
            </article>
          ))}
        </div>
        {count > 1 && (
          <div className="mt-8 flex justify-center gap-2" aria-label="Posición">
            {trip.highlights.map((_, i) => (
              <button key={i} type="button" onClick={() => goTo(i)} aria-label={`Ir a experiencia ${i + 1}`} aria-current={i === active} className={`h-1.5 rounded-full bg-current transition-all ${i === active ? "w-6 opacity-90" : "w-1.5 opacity-30"}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

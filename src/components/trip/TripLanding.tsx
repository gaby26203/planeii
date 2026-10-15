import type { TripData } from "@/data/trip";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useHeadingFit } from "./use-heading-fit";
import { trackTripEvent } from "@/lib/trip-analytics";
import { Navbar } from "./Navbar";
import { Hero, TripMeta } from "./Hero";
import { StorySection, Highlights } from "./Story";
import { Host } from "./Host";
import { Included, Itinerary, Gallery, Accommodation } from "./Details";
import { TravelerProfile, Testimonials, FAQ, BookingCTA, FinalCTA, Footer, StickyBar } from "./Closing";
import { DEFAULT_SECTION_ORDER, type EditorDocument, type SectionKey, type SectionStyle } from "@/lib/trip-editor";
import { CtaProvider, EditorPreviewProvider, sectionStyle, hasButtonStyle } from "./shared";
import { resolveCtaLink, sectionAnchorId } from "@/lib/cta-links";

const sections: Record<SectionKey, (trip: TripData) => React.ReactNode> = {
  story: (trip) => <StorySection trip={trip} />,
  highlights: (trip) => <Highlights trip={trip} />,
  testimonials: (trip) => <Testimonials trip={trip} />,
  included: (trip) => <Included trip={trip} />,
  itinerary: (trip) => <Itinerary trip={trip} />,
  accommodation: (trip) => <Accommodation trip={trip} />,
  host: (trip) => <Host trip={trip} />,
  traveler: (trip) => <TravelerProfile trip={trip} />,
  faq: (trip) => <FAQ trip={trip} />,
  booking: (trip) => <BookingCTA trip={trip} />,
  gallery: (trip) => <Gallery trip={trip} />,
};

export function TripLanding({
  trip,
  sectionOrder = DEFAULT_SECTION_ORDER,
  hiddenSections = [],
  editorPreview = false,
  sectionStyles = {},
  textStyles = {},
  announcement,
  trackingTripId,
  ctaDocument,
  slug,
  search = "",
}: {
  trip: TripData;
  sectionOrder?: SectionKey[];
  hiddenSections?: SectionKey[];
  editorPreview?: boolean;
  sectionStyles?: Partial<Record<SectionKey | "hero" | "meta" | "final" | "announcement", SectionStyle>>;
  textStyles?: EditorDocument["textStyles"];
  announcement: EditorDocument["announcement"];
  /** Solo la landing publicada lo recibe: registra visitas y clics reales. */
  trackingTripId?: string;
  /** Documento completo para resolver el destino de cada CTA. */
  ctaDocument?: EditorDocument;
  slug?: string | null;
  search?: string;
}) {
  const cta = ctaDocument ? {
    resolve: (ctaId: string) => resolveCtaLink(ctaDocument, ctaId, { slug, search }),
    label: (ctaId: string) => ctaDocument.ctaLinks?.[ctaId]?.label,
    style: (ctaId: string) => ctaDocument.ctaLinks?.[ctaId]?.style,
  } : null;
  const landingRef = useRef<HTMLDivElement | null>(null);
  const [announcementHeight, setAnnouncementHeight] = useState(0);
  useHeadingFit(landingRef, textStyles);

  useEffect(() => {
    if (!trackingTripId || editorPreview) return;
    trackTripEvent(trackingTripId, "view");
    const root = landingRef.current;
    if (!root) return;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.("a.btn-primary, a.btn-ghost");
      if (!link) return;
      const section = link.closest("[data-editor-section]")?.getAttribute("data-editor-section");
      trackTripEvent(trackingTripId, "click", section === "announcement" ? "announcement" : "booking");
    };
    root.addEventListener("click", onClick, true);
    return () => root.removeEventListener("click", onClick, true);
  }, [trackingTripId, editorPreview]);
  return (
    <EditorPreviewProvider enabled={editorPreview} textStyles={textStyles}>
    <CtaProvider value={cta}>
    <>
      <div data-editor-section="announcement" className={hasButtonStyle(sectionStyles.announcement) ? "section-buttons" : undefined} style={sectionStyle(sectionStyles.announcement)}>
        <StickyBar announcement={announcement} editorPreview={editorPreview} onHeightChange={setAnnouncementHeight} />
      </div>
      <div ref={landingRef} className={editorPreview ? "editor-preview @container relative" : "@container"} style={{ "--announcement-height": `${announcementHeight}px` } as CSSProperties}>
      <div className="announcement-reserve-space" aria-hidden />
      <Navbar trip={trip} />
      <main>
         <div data-editor-section="hero" data-section-align={sectionStyles.hero?.align} className={`${sectionStyles.hero ? "landing-section landing-immersive section-custom" : "landing-section landing-immersive"}${hasButtonStyle(sectionStyles.hero) || ctaDocument?.ctaLinks?.hero?.style || ctaDocument?.ctaLinks?.heroItinerary?.style ? " section-buttons" : ""}`} style={sectionStyle(sectionStyles.hero)}><Hero trip={trip} /></div>
        <div data-editor-section="meta" className={`${sectionStyles.meta ? "landing-section section-custom" : "landing-section"}${hasButtonStyle(sectionStyles.meta) ? " section-buttons" : ""}`} style={sectionStyle(sectionStyles.meta)}><TripMeta trip={trip} /></div>
        {sectionOrder.filter((key) => sections[key] && !hiddenSections.includes(key)).map((key) => (
           <div className={`${sectionStyles[key] ? "landing-section section-custom" : "landing-section"}${hasButtonStyle(sectionStyles[key]) ? " section-buttons" : ""}`} key={key} id={sectionAnchorId(key)} data-editor-section={key} data-section-align={sectionStyles[key]?.align} style={sectionStyle(sectionStyles[key])}>{sections[key](trip)}</div>
        ))}
         <div data-editor-section="final" data-section-align={sectionStyles.final?.align} className={`${sectionStyles.final ? "landing-section landing-immersive section-custom" : "landing-section landing-immersive"}${hasButtonStyle(sectionStyles.final) ? " section-buttons" : ""}`} style={sectionStyle(sectionStyles.final)}><FinalCTA trip={trip} /></div>
      </main>
      <Footer trip={trip} />
    </div>
    </>
    </CtaProvider>
    </EditorPreviewProvider>
  );
}
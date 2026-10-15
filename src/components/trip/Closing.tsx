import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { TripAnnouncement, TripData } from "@/data/trip";
import { BookLink, CtaText, EditableImage, EditableText, SectionHead, isPlaceholder } from "./shared";

export function TravelerProfile({ trip }: { trip: TripData }) {
 return (
 <section className="container-ed grid gap-16 section-pad @4xl:grid-cols-2">
 <div>
 <p className="eyebrow text-secondary"><EditableText path="copy.travelerEyebrow" value={trip.copy.travelerEyebrow} /></p>
 <h2 className="section-title-gap text-4xl md:text-5xl"><EditableText path="copy.travelerTitle" value={trip.copy.travelerTitle} /></h2>
 <ul className="mt-10">
 {trip.travelerProfile.forYou.map((t, i) => (
 <li key={i} className="flex gap-4 border-b py-4 text-lg"><span aria-hidden>✓</span><EditableText path={`travelerProfile.forYou.${i}`} value={t} /></li>
 ))}
 </ul>
 </div>
 <div>
 <h2 className="text-3xl text-muted-foreground md:text-4xl"><EditableText path="copy.travelerNotTitle" value={trip.copy.travelerNotTitle} /></h2>
 <ul className="mt-10 text-muted-foreground">
 {trip.travelerProfile.notForYou.map((t, i) => (
 <li key={i} className="flex gap-4 border-b py-4"><span aria-hidden>✕</span><EditableText path={`travelerProfile.notForYou.${i}`} value={t} /></li>
 ))}
 </ul>
 <p className="mt-6 text-sm text-muted-foreground"><EditableText path="copy.travelerNote" value={trip.copy.travelerNote} /></p>
 </div>
 </section>
 );
}

function Accordion({ items }: { items: { title: ReactNode; body: ReactNode }[] }) {
 return (
 <div className="border-t">
 {items.map((it, i) => (
 <details key={i} className="group border-b">
 <summary className="flex items-center justify-between gap-6 py-5 text-lg">
 <span>{it.title}</span>
 <span className="text-xl text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>+</span>
 </summary>
 <p className="accordion-body pb-6 pr-10 leading-relaxed text-muted-foreground">{it.body}</p>
 </details>
 ))}
 </div>
 );
}

export function PracticalInfo({ trip }: { trip: TripData }) {
 return (
 <section className="bg-card section-pad ">
 <div className="container-ed grid gap-12 @4xl:grid-cols-12">
 <div className="@4xl:col-span-4">
 <SectionHead
 eyebrow={<EditableText path="copy.practicalEyebrow" value={trip.copy.practicalEyebrow} />}
 title={<EditableText path="copy.practicalTitle" value={trip.copy.practicalTitle} />}
 />
 </div>
 <div className="@4xl:col-span-8">
 <Accordion items={trip.practicalInfo.map((p, i) => ({
 title: <EditableText path={`practicalInfo.${i}.label`} value={p.label} />,
 body: <EditableText path={`practicalInfo.${i}.value`} value={p.value} />,
 }))} />
 </div>
 </div>
 </section>
 );
}

export function Testimonials({ trip }: { trip: TripData }) {
 return (
 <section className="container-ed section-pad ">
 <SectionHead
 eyebrow={<EditableText path="copy.testimonialsEyebrow" value={trip.copy.testimonialsEyebrow} />}
 title={<EditableText path="copy.testimonialsTitle" value={trip.copy.testimonialsTitle} />}
 />
 <div className="mt-16 grid gap-12 @4xl:grid-cols-3">
 {trip.testimonials.map((t, i) => (
 <figure key={i} className="border-t pt-8">
 <blockquote className="font-serif text-2xl leading-snug">“<EditableText path={`testimonials.${i}.quote`} value={t.quote} />”</blockquote>
 <figcaption className="mt-6 text-sm"><EditableText path={`testimonials.${i}.name`} value={t.name} /> · <span className="text-muted-foreground"><EditableText path={`testimonials.${i}.location`} value={t.location} /></span></figcaption>
 </figure>
 ))}
 </div>
 </section>
 );
}

export function FAQ({ trip }: { trip: TripData }) {
 return (
 <section id="faq" className="container-ed grid gap-12 section-pad @4xl:grid-cols-12">
 <div className="@4xl:col-span-4">
 <SectionHead
 eyebrow={<EditableText path="copy.faqEyebrow" value={trip.copy.faqEyebrow} />}
 title={<EditableText path="copy.faqTitle" value={trip.copy.faqTitle} />}
 />
 </div>
 <div className="@4xl:col-span-8">
 <Accordion items={trip.faq.map((f, i) => ({
 title: <EditableText path={`faq.${i}.q`} value={f.q} />,
 body: <EditableText path={`faq.${i}.a`} value={f.a} />,
 }))} />
 </div>
 </section>
 );
}

export function BookingCTA({ trip }: { trip: TripData }) {
 return (
 <section id="reserva" className="bg-secondary section-pad text-secondary-foreground">
 <div className="container-ed grid items-start gap-14 @4xl:grid-cols-2">
 <div>
 <p className="eyebrow text-accent"><EditableText path="copy.bookingEyebrow" value={trip.copy.bookingEyebrow} /></p>
 <h2 className="mt-5 text-6xl uppercase md:text-8xl"><EditableText path="copy.bookingTitle" value={trip.copy.bookingTitle} /></h2>
 <p className="mt-4 eyebrow opacity-80"><EditableText path="datesShort" styleKey="booking.datesShort" value={trip.datesShort} /></p>
 <p className="mt-10 eyebrow opacity-70"><EditableText path="copy.bookingFrom" styleKey="booking.price.prefix" value={trip.copy.bookingFrom} /></p>
 <p className="font-serif text-5xl md:text-6xl"><EditableText path="price" styleKey="booking.price.value" value={trip.price} /> <EditableText as="span" className="text-2xl" path="currency" styleKey="booking.price.currency" value={trip.currency} /></p>
 </div>
 <div className="border-current/20 @4xl:border-l @4xl:pl-14">
 <p className="eyebrow opacity-70"><EditableText path="copy.bookingIncludes" value={trip.copy.bookingIncludes} /></p>
 <ul className="mt-5 space-y-2 text-lg">
 <li>— <EditableText path="duration" styleKey="booking.duration" value={trip.duration} /></li>
 {trip.included.slice(0, 5).map((x, index) => <li key={`${index}-${x}`}>— <EditableText path={`included.${index}`} styleKey={`booking.included.${index}`} value={x} /></li>)}
 </ul>
 <BookLink ctaId="booking" className="mt-10 w-full !py-5 !text-sm"><CtaText ctaId="booking" value={trip.copy.bookingButton} /></BookLink>
 <p className="mt-4 text-center text-sm opacity-80"><EditableText path="copy.bookingLimited" value={trip.copy.bookingLimited} /></p>
 <AskContact trip={trip} />
 </div>
 </div>
 </section>
 );
}

function AskContact({ trip }: { trip: TripData }) {
 const wa = trip.contact.whatsapp && !isPlaceholder(trip.contact.whatsapp) ? `https://wa.me/${trip.contact.whatsapp}` : null;
 const mail = !isPlaceholder(trip.contact.email) ? `mailto:${trip.contact.email}` : null;
 return (
 <p className="mt-3 text-center text-sm opacity-80">
 <EditableText path="copy.bookingQuestion" value={trip.copy.bookingQuestion} />{" "}
 {wa && <a href={wa} className="underline underline-offset-4 hover:opacity-100"><EditableText path="copy.contactWhatsapp" value={trip.copy.contactWhatsapp} /></a>}
 {wa && mail && " · "}
 {mail && <a href={mail} className="underline underline-offset-4 hover:opacity-100"><EditableText path="copy.contactEmail" value={trip.copy.contactEmail} /></a>}
 {!wa && !mail && <EditableText path="contact.email" value={trip.contact.email} />}
 </p>
 );
}

export function FinalCTA({ trip }: { trip: TripData }) {
 return (
 <section className="grid min-h-[85svh] overflow-hidden bg-ink text-center text-cream">
 <EditableImage image={trip.finalImage} imageKey="finalImage" loading="lazy" className="col-start-1 row-start-1 h-full w-full object-cover" />
 <div className="pointer-events-none col-start-1 row-start-1 overlay-hero" aria-hidden />
 <div className="container-ed relative col-start-1 row-start-1 self-center py-24">
 <h2 className="text-5xl md:text-8xl"><EditableText path="finalCta.heading" value={trip.finalCta.heading} /></h2>
 <BookLink ctaId="final" className="mt-12"><CtaText ctaId="final" value={trip.finalCta.button} /></BookLink>
 <p className="mt-5 text-sm opacity-80"><EditableText path="finalCta.note" value={trip.finalCta.note} /></p>
 </div>
 </section>
 );
}

export function Footer({ trip }: { trip: TripData }) {
 const links = [
 [trip.copy.footerInstagram, trip.contact.instagram, "copy.footerInstagram"],
 [trip.copy.footerEmail, `mailto:${trip.contact.email}`, "copy.footerEmail"],
 [trip.copy.footerTerms, "#", "copy.footerTerms"],
 [trip.copy.footerPrivacy, "#", "copy.footerPrivacy"],
 [trip.copy.footerCancellation, "#", "copy.footerCancellation"],
 [trip.copy.footerContact, `mailto:${trip.contact.email}`, "copy.footerContact"],
 ] as [string, string, string | null][];
 return (
 <footer className="bg-ink pb-28 pt-16 text-ink-foreground md:pb-16">
 <div className="container-ed flex flex-col justify-between gap-8 md:flex-row md:items-center">
 <p className="font-serif text-2xl"><EditableText path="brand" styleKey="footer.brand" value={trip.brand} /></p>
 <ul className="flex flex-wrap gap-x-8 gap-y-3">
 {links.map(([l, h, path]) => <li key={l}><a href={h} className="eyebrow opacity-70 hover:opacity-100">{path ? <EditableText path={path} value={l} /> : l}</a></li>)}
 </ul>
 </div>
 </footer>
 );
}

function announcementIsActive(announcement: TripAnnouncement, now: number) {
  if (!announcement.enabled) return false;
  const start = announcement.startsAt ? new Date(announcement.startsAt).getTime() : null;
  const end = announcement.endsAt ? new Date(announcement.endsAt).getTime() : null;
  return (start === null || Number.isNaN(start) || now >= start) && (end === null || Number.isNaN(end) || now < end);
}

function countdownLabel(endsAt: string | undefined, now: number) {
  if (!endsAt) return null;
  const remaining = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const days = Math.floor(remaining / 86_400_000);
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  return `Termina en ${days} ${plural(days, "Día", "Días")} ${hours} ${plural(hours, "Hora", "Horas")} ${minutes} Min ${seconds} Seg`;
}

export function StickyBar({ announcement, editorPreview = false, onHeightChange }: { announcement: TripAnnouncement; editorPreview?: boolean; onHeightChange?: (height: number) => void }) {
  const [now, setNow] = useState(() => Date.now());
  const barRef = useRef<HTMLDivElement | null>(null);
  const storageKey = useMemo(() => `trip-announcement-dismissed:${announcement.message}:${announcement.endsAt ?? "open"}`, [announcement.message, announcement.endsAt]);
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && window.sessionStorage.getItem(storageKey) === "1");
  const active = announcementIsActive(announcement, now);

  useEffect(() => {
    if (!announcement.showCountdown || !announcement.endsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [announcement.endsAt, announcement.showCountdown]);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar || !active || dismissed) {
      onHeightChange?.(0);
      return;
    }
    const updateHeight = () => {
      const height = Math.ceil(bar.getBoundingClientRect().height);
      onHeightChange?.(height);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(bar);
    return () => { observer.disconnect(); onHeightChange?.(0); };
  }, [active, dismissed, announcement.message, announcement.mobileMessage, announcement.buttonLabel, announcement.showCountdown, onHeightChange]);

  if (!active || !announcement.enabled || dismissed) return null;
  const countdown = announcement.showCountdown ? countdownLabel(announcement.endsAt, now) : null;

  return (
    <div ref={barRef} className={`announcement-bar @container fixed inset-x-0 top-0 z-40 border-b${editorPreview ? " editor-preview" : ""}`}>
      <div className="container-ed grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 py-2 @2xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] @2xl:gap-x-4 @2xl:py-3">
        <div className="min-w-0">
          <p className="announcement-message-mobile line-clamp-2 text-sm font-medium leading-snug @2xl:hidden"><EditableText path={announcement.mobileMessage ? "announcement.mobileMessage" : "announcement.message"} value={announcement.mobileMessage || announcement.message} /></p>
          <p className="hidden text-base font-medium leading-snug @2xl:block"><EditableText path="announcement.message" value={announcement.message} /></p>
        </div>
        {countdown && <p className="hidden shrink-0 text-xs font-semibold uppercase @2xl:block">{countdown}</p>}
        <BookLink ctaId="announcement" href={announcement.url} className="shrink-0 whitespace-nowrap !px-3 !py-2.5 !text-xs @2xl:!px-5 @2xl:!py-3"><EditableText path="announcement.buttonLabel" value={announcement.buttonLabel} /></BookLink>
        <button type="button" className="announcement-close shrink-0" onClick={() => { window.sessionStorage.setItem(storageKey, "1"); setDismissed(true); }} aria-label="Cerrar anuncio"><X aria-hidden /></button>
      </div>
    </div>
  );
}

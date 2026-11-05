import { useEffect, useState } from "react";
import type { TripData } from "@/data/trip";
import { BookLink, CtaText, EditableText } from "./shared";

export function Navbar({ trip }: { trip: TripData }) {
  const links = [
    { href: "#viaje", label: trip.copy.navTrip, path: "copy.navTrip" }, { href: "#experiencias", label: trip.copy.navExperiences, path: "copy.navExperiences" },
    { href: "#itinerario", label: trip.copy.navItinerary, path: "copy.navItinerary" }, { href: "#incluye", label: trip.copy.navIncluded, path: "copy.navIncluded" },
    { href: "#faq", label: trip.copy.navFaq, path: "copy.navFaq" },
  ];
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 80);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const solid = scrolled || open;
  return (
    <header className={`trip-navigation fixed inset-x-0 z-50 transition-colors duration-500 ${solid ? "bg-background/95 text-foreground backdrop-blur border-b" : "text-cream"}`}>
      <nav className="container-ed flex h-16 items-center justify-between md:h-20" aria-label="Principal">
        <a href="#top" className="font-serif text-lg tracking-tight"><EditableText path="brand" value={trip.brand} /></a>
        <ul className="hidden items-center gap-8 lg:flex">
          {links.map((l) => (
            <li key={l.href}><a href={l.href} className="eyebrow opacity-80 hover:opacity-100"><EditableText path={l.path} value={l.label} /></a></li>
          ))}
        </ul>
        <div className="flex items-center gap-4">
          <BookLink ctaId="nav" className="hidden !px-5 !py-3 md:inline-flex"><CtaText ctaId="nav" value={trip.copy.navBook} /></BookLink>
          <button
            className="lg:hidden eyebrow"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <EditableText path="copy.menuClose" value={trip.copy.menuClose} /> : <EditableText path="copy.menuOpen" value={trip.copy.menuOpen} />}
          </button>
        </div>
      </nav>
      {open && (
        <div id="mobile-menu" className="container-ed pb-8 lg:hidden">
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block border-b py-4 font-serif text-2xl"><EditableText path={l.path} value={l.label} /></a>
              </li>
            ))}
          </ul>
          <BookLink ctaId="nav" className="mt-6 w-full"><CtaText ctaId="nav" value={trip.copy.heroBook} /></BookLink>
        </div>
      )}
    </header>
  );
}

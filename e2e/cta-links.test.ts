import { describe, expect, test } from "bun:test";
import { applyToBookingCtas, ctaWarnings, newCtaId, resolveCtaLink } from "../src/lib/cta-links";

const doc = (extra: Record<string, unknown> = {}) => ({
  trip: { bookingUrl: "https://forms.gle/abc" },
  announcement: { url: "https://example.com/promo" },
  bookingForm: { mode: "internal" as const, externalUrl: "" },
  sectionOrder: ["itinerary", "included", "booking"],
  hiddenSections: [] as string[],
  ctaLinks: {},
  ...extra,
});

describe("CTA destinations", () => {
  test("internal form uses this landing's slug and forwards attribution", () => {
    const r = resolveCtaLink(doc({ ctaLinks: { hero: { target: "form" } } }), "hero", { slug: "caripe", search: "?utm_source=ig&gclid=1&foo=x" });
    expect(r.href).toBe("/v/caripe/reservar?utm_source=ig&gclid=1");
  });
  test("url opens in new tab when asked", () => {
    const r = resolveCtaLink(doc({ ctaLinks: { final: { target: "url", url: "https://wa.me/58", newTab: true } } }), "final", { slug: "x" });
    expect(r).toEqual({ href: "https://wa.me/58", newTab: true });
  });
  test("visible section scrolls to its stable anchor", () => {
    expect(resolveCtaLink(doc({ ctaLinks: { hero: { target: "section", sectionId: "itinerary" } } }), "hero", { slug: "x" }).href).toBe("#seccion-itinerary");
  });
  test("hidden section warns and falls back instead of breaking", () => {
    const d = doc({ hiddenSections: ["itinerary"], ctaLinks: { hero: { target: "section", sectionId: "itinerary" } } });
    const r = resolveCtaLink(d, "hero", { slug: "x" });
    expect(r.warning).toBe("section-hidden");
    expect(r.href).toBe("/v/x/reservar");
    expect(ctaWarnings(d, "x").map((w) => w.ctaId)).toContain("hero");
  });
  test("old documents without config keep the external link", () => {
    const r = resolveCtaLink(doc({ bookingForm: { mode: "external", externalUrl: "https://forms.gle/old" } }), "hero", { slug: "x" });
    expect(r.href).toBe("https://forms.gle/old");
  });
  test("internal form without form configured warns", () => {
    const r = resolveCtaLink(doc({ bookingForm: { mode: "external", externalUrl: "" }, ctaLinks: { hero: { target: "form" } } }), "hero", { slug: "x" });
    expect(r.warning).toBe("form-not-configured");
  });
  test("new ctaIds work with the same system", () => {
    const id = newCtaId();
    expect(resolveCtaLink(doc({ ctaLinks: { [id]: { target: "url", url: "https://planeii.app" } } }), id, { slug: "x" }).href).toBe("https://planeii.app");
  });
  test("unsafe url is rejected", () => {
    const r = resolveCtaLink(doc({ ctaLinks: { hero: { target: "url", url: "javascript:alert(1)" } } }), "hero", { slug: "x" });
    expect(r.warning).toBe("url-invalid");
  });
});

test("apply to all booking buttons keeps the secondary hero button", () => {
  const links = applyToBookingCtas({ heroItinerary: { target: "section", sectionId: "itinerary" }, hero: { label: "Reservá" } }, { target: "form" });
  expect(links.heroItinerary).toEqual({ target: "section", sectionId: "itinerary" });
  expect(links.hero).toEqual({ label: "Reservá", target: "form" });
  const d = doc({ ctaLinks: links });
  expect(ctaWarnings(d, "x")).toEqual([]);
});

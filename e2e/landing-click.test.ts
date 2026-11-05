import { describe, expect, test } from "bun:test";
import { classifyLandingClick } from "../src/lib/trip-analytics";

describe("classifyLandingClick", () => {
  test("la barra de anuncio se cuenta aparte, aunque lleve al formulario", () => {
    expect(classifyLandingClick({ inAnnouncement: true, ctaTarget: "form" })).toBe("announcement");
  });

  test("formulario y enlace externo son intención de reserva", () => {
    expect(classifyLandingClick({ inAnnouncement: false, ctaTarget: "form" })).toBe("booking");
    expect(classifyLandingClick({ inAnnouncement: false, ctaTarget: "url" })).toBe("booking");
  });

  test("bajar a una sección es navegación, no reserva", () => {
    expect(classifyLandingClick({ inAnnouncement: false, ctaTarget: "section" })).toBe("section");
  });

  test("un botón sin configuración de CTA cuenta como reserva, como antes", () => {
    expect(classifyLandingClick({ inAnnouncement: false })).toBe("booking");
  });
});

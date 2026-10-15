import { describe, expect, it } from "bun:test";
import { createEditorDocument, normalizeEditorDocument } from "@/lib/trip-editor";
import { NEUTRAL_TRIP_DATA, neutralTripFor } from "@/data/neutral-trip";
import { OAXACA_LEGACY_DATA } from "@/data/trip";

describe("textos independientes de portada y reserva", () => {
  it("documentos antiguos heredan el destino en ambos textos", () => {
    const trip = neutralTripFor({ destination: "Caripe", country: "Venezuela" });
    const doc = normalizeEditorDocument({ trip: { destination: "Caripe", country: "Venezuela" } }, trip);
    expect(doc.trip.copy.heroEyebrow).toBe("Caripe, Venezuela");
    expect(doc.trip.copy.bookingTitle).toBe("Caripe");
  });
  it("los textos editados no se pisan con el destino", () => {
    const trip = neutralTripFor({ destination: "Caripe", country: "Venezuela" });
    const doc = normalizeEditorDocument({
      trip: { destination: "Caripe", country: "Venezuela", copy: { heroEyebrow: "Una aventura única", bookingTitle: "Reservá tu lugar" } },
    }, trip);
    expect(doc.trip.copy.heroEyebrow).toBe("Una aventura única");
    expect(doc.trip.copy.bookingTitle).toBe("Reservá tu lugar");
    expect(doc.trip.destination).toBe("Caripe");
  });
  it("la plantilla neutra trae placeholders propios", () => {
    expect(NEUTRAL_TRIP_DATA.copy.heroEyebrow).toBe("Destino, país");
    expect(NEUTRAL_TRIP_DATA.copy.bookingTitle).toBe("[destino]");
  });
  it("una página nueva nace con formulario interno y sin contenido de Oaxaca", () => {
    const doc = createEditorDocument(neutralTripFor({ destination: "Caripe", country: "Venezuela", title: "Viaje a Caripe" }));
    expect(doc.contentBase).toBeUndefined();
    expect(doc.bookingForm?.mode).toBe("internal");
    expect(doc.trip.destination).toBe("Caripe");
    expect(doc.trip.title).toBe("Viaje a Caripe");
    expect(doc.trip.story.paragraphs).not.toEqual(OAXACA_LEGACY_DATA.story.paragraphs);
    expect(doc.trip.heroImage.src).not.toBe(OAXACA_LEGACY_DATA.heroImage.src);
  });
  it("normalizar conserva contenido y diseño mientras completa la estructura", () => {
    const trip = neutralTripFor({ destination: "Tailandia", title: "Del mar a la montaña" });
    const doc = normalizeEditorDocument({
      trip: { ...trip, subtitle: "Texto propio" },
      sectionStyles: { hero: { background: "#123456" } },
      textStyles: { title: { color: "#654321" } },
    }, trip);
    expect(doc.trip.subtitle).toBe("Texto propio");
    expect(doc.sectionStyles.hero?.background).toBe("#123456");
    expect(doc.textStyles.title?.color).toBe("#654321");
    expect(doc.bookingForm?.mode).toBe("external");
    expect(doc.trip.story.paragraphs).not.toEqual(OAXACA_LEGACY_DATA.story.paragraphs);
  });
});

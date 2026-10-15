import { describe, expect, it } from "bun:test";
import { applyTextStyleCommit, normalizeEditorDocument } from "@/lib/trip-editor";
import { neutralTripFor } from "@/data/neutral-trip";

describe("estilo por ubicación de textos compartidos", () => {
  it("formatear la lista de reserva no toca Qué incluye", () => {
    const trip = neutralTripFor({ destination: "Caripe", country: "Venezuela" });
    const base = normalizeEditorDocument({ trip, textStyles: { "included.0": { color: "#222222" } } }, trip);
    const text = "Desayunos diarios";
    const inline = { text, runs: [{ text: "Desayunos", bold: true }, { text: " diarios" }] };
    const next = applyTextStyleCommit(base, "booking.included.0", inline, text);
    expect(next.textStyles["included.0"]).toEqual({ color: "#222222" });
    expect(next.textStyles["booking.included.0"]?.inline?.text).toBe(text);
  });

  it("el título del formulario puede tener otro color sin cambiar el título del Hero", () => {
    const trip = neutralTripFor({ destination: "Caripe", country: "Venezuela" });
    const base = normalizeEditorDocument({ trip, textStyles: { title: { color: "#112233" } } }, trip);
    const next = applyTextStyleCommit(base, "form.tripTitle", undefined, trip.title);
    next.textStyles["form.tripTitle"] = { ...next.textStyles["form.tripTitle"], color: "#aabbcc" };

    expect(next.trip.title).toBe(base.trip.title);
    expect(next.textStyles.title?.color).toBe("#112233");
    expect(next.textStyles["form.tripTitle"]?.color).toBe("#aabbcc");
  });

  it("el precio compartido conserva su información y admite colores distintos por ubicación", () => {
    const trip = neutralTripFor({ destination: "Caripe", country: "Venezuela" });
    const base = normalizeEditorDocument({ trip }, trip);
    const meta = applyTextStyleCommit(base, "meta.price.value", undefined, trip.price);
    meta.textStyles["meta.price.value"] = { color: "#112233" };
    const booking = applyTextStyleCommit(meta, "booking.price.value", undefined, trip.price);
    booking.textStyles["booking.price.value"] = { color: "#aabbcc" };

    expect(booking.trip.price).toBe(trip.price);
    expect(booking.textStyles["meta.price.value"]?.color).toBe("#112233");
    expect(booking.textStyles["booking.price.value"]?.color).toBe("#aabbcc");
  });

  it("la marca compartida admite formato independiente en formulario y pie de página", () => {
    const trip = neutralTripFor({ destination: "Caripe", country: "Venezuela" });
    const base = normalizeEditorDocument({ trip }, trip);
    const form = applyTextStyleCommit(base, "form.navigation.brand", undefined, trip.brand);
    form.textStyles["form.navigation.brand"] = { color: "#334455" };
    const footer = applyTextStyleCommit(form, "footer.brand", undefined, trip.brand);
    footer.textStyles["footer.brand"] = { color: "#ddeeff" };

    expect(footer.trip.brand).toBe(trip.brand);
    expect(footer.textStyles["form.navigation.brand"]?.color).toBe("#334455");
    expect(footer.textStyles["footer.brand"]?.color).toBe("#ddeeff");
  });
});

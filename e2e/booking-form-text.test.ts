import { describe, expect, test } from "bun:test";
import { defaultBookingForm, normalizeBookingForm, setBookingFormTextByPath, validateAnswers } from "../src/lib/booking-form";

describe("form inline document updates", () => {
  test("each trip can edit and add questions independently from the base", () => {
    const first = defaultBookingForm("Caripe");
    const second = defaultBookingForm("Tailandia");
    first.blocks[0].required = false;
    first.blocks.push({ id: "custom", type: "short", label: "Pregunta propia" });
    expect(second.blocks).toHaveLength(5);
    expect(second.blocks[0].required).toBe(true);
    expect(normalizeBookingForm(first).blocks).toEqual(first.blocks);
    expect(first.thanks.title).toBe("Recibimos tu solicitud para Caripe");
    expect(second.thanks.title).toBe("Recibimos tu solicitud para Tailandia");
  });
  test("Catatumbo base requires age", () => {
    expect(validateAnswers(defaultBookingForm(), { b_58xx61ua: "Venezuela" })).toEqual({ error: "Falta responder: Edad" });
  });
  test("Catatumbo base requires residence", () => {
    expect(validateAnswers(defaultBookingForm(), { b_motivo: "35" })).toEqual({ error: "Falta responder: Pais de Residencia" });
  });
  test("the remaining Catatumbo questions stay optional", () => {
    const result = validateAnswers(defaultBookingForm(), { b_motivo: "35", b_58xx61ua: "Venezuela" });
    expect("answers" in result && result.answers.slice(2).every((answer) => answer.value === null)).toBe(true);
  });
  test("updates a question without altering its ID or required rule", () => {
    const form = defaultBookingForm("Catatumbo");
    form.blocks[0].required = true;
    const updated = setBookingFormTextByPath(form, "bookingForm.blocks.0.label", "¿Por qué querés viajar?");
    expect(updated.blocks[0].label).toBe("¿Por qué querés viajar?");
    expect(updated.blocks[0].id).toBe("b_motivo");
    expect(updated.blocks[0].required).toBe(true);
    expect(form.blocks[0].label).not.toBe(updated.blocks[0].label);
  });
  test("updates the original step index even with an empty preceding step", () => {
    const form = defaultBookingForm();
    form.thanks.steps = ["", "Te contactamos"];
    expect(setBookingFormTextByPath(form, "bookingForm.thanks.steps.1", "Agendamos tu llamada").thanks.steps).toEqual(["", "Agendamos tu llamada"]);
  });
  test("persists basic labels for older forms without copy", () => {
    const form = defaultBookingForm();
    expect(setBookingFormTextByPath(form, "bookingForm.copy.name", "Tu nombre completo").copy?.name).toBe("Tu nombre completo");
  });
  test("does not allow text messages to change mode or validation", () => {
    const form = defaultBookingForm();
    expect(setBookingFormTextByPath(form, "bookingForm.mode", "external")).toBe(form);
    expect(setBookingFormTextByPath(form, "bookingForm.blocks.0.required", "false")).toBe(form);
    expect(setBookingFormTextByPath(form, "bookingForm.blocks.99.label", "Inexistente")).toBe(form);
  });
  test("updates one option and keeps other options intact", () => {
    const form = defaultBookingForm();
    form.blocks = [{ id: "choice", type: "single", label: "Habitación", options: ["Simple", "Doble"] }];
    expect(setBookingFormTextByPath(form, "bookingForm.blocks.0.options.1", "Compartida").blocks[0].options).toEqual(["Simple", "Compartida"]);
  });
});
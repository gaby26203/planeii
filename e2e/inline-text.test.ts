import { describe, expect, test } from "bun:test";
import { contentToInline, inlineToContent, normalizeInlineText, safeTextLink } from "../src/lib/inline-text";

describe("selection-level formatting", () => {
  const text = "Queremos reunir mujeres que tengan una forma de viajar compatible.";
  test("preserves bold only on the selected fragment across serialization", () => {
    const runs = [{ text: "Queremos reunir mujeres que tengan una " }, { text: "forma de viajar compatible", bold: true }, { text: "." }];
    const inline = normalizeInlineText({ runs }, text);
    expect(contentToInline(inlineToContent(text, inline)).runs).toEqual(runs);
  });
  test("independent italic underline and links do not affect remaining words", () => {
    const runs = [{ text: "Queremos ", italic: true }, { text: "viajar", underline: true, href: "https://chamaviaja.com" }, { text: " juntas." }];
    expect(contentToInline(inlineToContent("Queremos viajar juntas.", { text: "Queremos viajar juntas.", runs })).runs).toEqual(runs);
  });
  test("rejects stale formatting after plain text is replaced", () => {
    expect(normalizeInlineText({ runs: [{ text, bold: true }] }, "Nuevo párrafo")).toBeUndefined();
  });
  test("rejects unsafe links and unsupported pasted marks", () => {
    expect(safeTextLink("javascript:alert(1)")).toBeUndefined();
    expect(safeTextLink("//evil.test")).toBeUndefined();
    expect(contentToInline({ type: "doc", content: [{ type: "text", text: "Hola", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }, { type: "color", attrs: { color: "red" } }] }] }).runs).toEqual([{ text: "Hola" }]);
  });
  test("normalizes duplicate marks and retains line breaks without extra blocks", () => {
    const inline = normalizeInlineText({ runs: [{ text: "Una ", bold: true }, { text: "frase", bold: true }, { text: "\nOtra línea" }] }, "Una frase\nOtra línea");
    expect(inline?.runs).toHaveLength(2);
    expect(contentToInline(inlineToContent("Una frase\nOtra línea", inline)).text).toBe("Una frase\nOtra línea");
  });
});
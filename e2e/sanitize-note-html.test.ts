import { describe, expect, test } from "bun:test";
import { safeHref, sanitizeNoteHtml } from "../src/lib/sanitize-note-html";

describe("sanitizeNoteHtml", () => {
  test("conserva el formato que produce el editor", () => {
    const html =
      '<p>Pagar <strong>50%</strong> al <a target="_blank" rel="noopener noreferrer nofollow" class="underline text-primary" href="https://hotel.com/reserva?a=1&amp;b=2">hotel</a><br>antes del viernes</p><ul><li><em>uno</em></li></ul>';
    expect(sanitizeNoteHtml(html)).toBe(
      '<p>Pagar <strong>50%</strong> al <a href="https://hotel.com/reserva?a=1&amp;b=2" target="_blank" rel="noopener noreferrer nofollow">hotel</a><br>antes del viernes</p><ul><li><em>uno</em></li></ul>',
    );
  });

  test("quita scripts y deja su contenido como texto inofensivo", () => {
    expect(sanitizeNoteHtml("<p>hola</p><script>alert(1)</script>")).toBe("<p>hola</p>alert(1)");
  });

  test("quita atributos de eventos y estilos", () => {
    expect(sanitizeNoteHtml('<p onclick="alert(1)" style="color:red">x</p>')).toBe("<p>x</p>");
    expect(sanitizeNoteHtml('<img src=x onerror="alert(1)">')).toBe("");
    expect(sanitizeNoteHtml("<svg onload=alert(1)><circle/></svg>")).toBe("");
  });

  test("escapa etiquetas sin cerrar en lugar de dejarlas pasar", () => {
    expect(sanitizeNoteHtml("<img src=x onerror=alert(1)//")).toBe(
      "&lt;img src=x onerror=alert(1)//",
    );
  });

  test("no se deja engañar por > dentro de un atributo", () => {
    expect(sanitizeNoteHtml('<a title="x>y" href="javascript:alert(1)">z</a>')).toBe("<a>z</a>");
  });

  test("solo permite enlaces http, https y mailto", () => {
    expect(sanitizeNoteHtml('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeNoteHtml('<a href=" JaVaScRiPt:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeNoteHtml('<a href="&#106;avascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeNoteHtml('<a href="java\tscript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitizeNoteHtml('<a href="data:text/html,<b>">x</a>')).toBe("<a>x</a>");
    expect(sanitizeNoteHtml("<a href='mailto:hola@chamaviaja.com'>x</a>")).toContain(
      'href="mailto:hola@chamaviaja.com"',
    );
  });

  test("escapa comillas en el href para no abrir atributos nuevos", () => {
    expect(sanitizeNoteHtml("<a href='https://x.com/\"onmouseover=alert(1)'>x</a>")).toBe(
      '<a href="https://x.com/&quot;onmouseover=alert(1)" target="_blank" rel="noopener noreferrer nofollow">x</a>',
    );
  });

  test("deja intacto el texto plano y los comentarios quedan como texto", () => {
    expect(sanitizeNoteHtml("Traslado 3 > 2 personas")).toBe("Traslado 3 &gt; 2 personas");
    expect(sanitizeNoteHtml("<!-- <script>x</script> -->")).toBe("&lt;!-- x --&gt;");
  });
});

describe("safeHref", () => {
  test("acepta URLs normales y rechaza esquemas peligrosos", () => {
    expect(safeHref("https://chamaviaja.com")).toBe("https://chamaviaja.com");
    expect(safeHref("vbscript:msgbox(1)")).toBeNull();
    expect(safeHref("/ruta/relativa")).toBeNull();
  });
});

// Saneado del HTML de las notas de costo antes de mostrarlo con innerHTML.
//
// El editor (Tiptap) solo produce párrafos, saltos, negrita, cursiva, tachado, código, listas y
// enlaces, pero el valor guardado puede llegar de cualquier escritura en `trips.data`. Esta
// función reconstruye cada etiqueta desde una lista permitida, sin atributos salvo `href` en los
// enlaces (solo http, https y mailto), y escapa todo lo demás como texto. No usa el DOM, así que
// funciona igual en el servidor y en el navegador.

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "code",
  "a",
  "ul",
  "ol",
  "li",
]);
const VOID_TAGS = new Set(["br"]);
const SAFE_HREF = /^(https?:|mailto:)/i;
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const HREF = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

function escapeText(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/gi, "&");
}

/** Devuelve el href si es seguro, o null. Ignora espacios y controles que el navegador también ignora. */
export function safeHref(raw: string): string | null {
  const decoded = decodeEntities(raw).trim();
  // eslint-disable-next-line no-control-regex
  const compact = decoded.replace(/[\u0000- ]/g, "");
  return SAFE_HREF.test(compact) ? decoded : null;
}

function rebuildTag(closing: boolean, name: string, attrs: string): string {
  const tag = name.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return "";
  if (closing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
  if (tag !== "a") return `<${tag}>`;
  const match = HREF.exec(attrs);
  const href = match ? safeHref(match[1] ?? match[2] ?? match[3] ?? "") : null;
  return href
    ? `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer nofollow">`
    : "<a>";
}

export function sanitizeNoteHtml(html: string): string {
  let out = "";
  let last = 0;
  for (const m of html.matchAll(TAG)) {
    out += escapeText(html.slice(last, m.index));
    out += rebuildTag(m[1] === "/", m[2], m[3]);
    last = m.index + m[0].length;
  }
  return out + escapeText(html.slice(last));
}

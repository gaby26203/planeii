import type { JSONContent } from "@tiptap/core";

export type InlineRun = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; href?: string };
export type InlineText = { text: string; runs: InlineRun[] };

export function safeTextLink(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const href = value.trim();
  return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href) && !/[\u0000-\u0020]/.test(href) ? href : undefined;
}

/** Only supported marks are persisted; merge adjacent identical runs. */
export function normalizeInlineText(value: unknown, text: string): InlineText | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as { runs?: unknown };
  if (!Array.isArray(raw.runs)) return undefined;
  const runs: InlineRun[] = [];
  for (const item of raw.runs) {
    if (!item || typeof item !== "object" || typeof item.text !== "string") return undefined;
    if (!item.text) continue;
    const run: InlineRun = { text: item.text };
    if (item.bold === true) run.bold = true;
    if (item.italic === true) run.italic = true;
    if (item.underline === true) run.underline = true;
    const href = safeTextLink(item.href);
    if (href) run.href = href;
    const last = runs.at(-1);
    if (last && last.bold === run.bold && last.italic === run.italic && last.underline === run.underline && last.href === run.href) last.text += run.text;
    else runs.push(run);
  }
  return runs.map((run) => run.text).join("") === text ? { text, runs } : undefined;
}

export function inlineToContent(text: string, inline?: InlineText, legacy?: { bold?: boolean; italic?: boolean; href?: string }): JSONContent {
  const runs = normalizeInlineText(inline, text)?.runs ?? [{ text, ...legacy }];
  return {
    type: "doc",
    content: runs.flatMap((run) => {
      const marks = [run.bold && { type: "bold" }, run.italic && { type: "italic" }, run.underline && { type: "underline" }, safeTextLink(run.href) && { type: "link", attrs: { href: safeTextLink(run.href) } }].filter((mark): mark is { type: string; attrs?: { href: string | undefined } } => Boolean(mark));
      return run.text.split("\n").flatMap((part, index) => [...(index ? [{ type: "hardBreak" }] : []), ...(part ? [{ type: "text", text: part, marks }] : [])]);
    }),
  };
}

export function contentToInline(content: JSONContent): InlineText {
  const runs: InlineRun[] = [];
  for (const node of content.content ?? []) {
    if (node.type === "hardBreak") { runs.push({ text: "\n" }); continue; }
    if (node.type !== "text" || !node.text) continue;
    const run: InlineRun = { text: node.text };
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") run.bold = true;
      if (mark.type === "italic") run.italic = true;
      if (mark.type === "underline") run.underline = true;
      if (mark.type === "link") run.href = safeTextLink(mark.attrs?.href);
    }
    runs.push(run);
  }
  const text = runs.map((run) => run.text).join("");
  return normalizeInlineText({ runs }, text) ?? { text, runs: [] };
}
import { createContext, createElement, useContext, useEffect, useMemo, useRef, type CSSProperties, type ElementType, type MouseEvent, type ReactNode } from "react";
import { createInlineEditor } from "./inline-editor";
import { contentToInline, inlineToContent, normalizeInlineText, safeTextLink } from "@/lib/inline-text";
import type { Editor } from "@tiptap/core";
import type { Img } from "@/data/trip";
import { editableFieldDefinition, type SectionStyle, type TextStyle } from "@/lib/trip-editor";
import type { CtaButtonStyle } from "@/lib/cta-links";

type EditorPreviewValue = { enabled: boolean; textStyles: Record<string, TextStyle> };
const EditorPreviewContext = createContext<EditorPreviewValue>({ enabled: false, textStyles: {} });

export function useEditorPreview() {
  return useContext(EditorPreviewContext);
}

export function EditorPreviewProvider({ enabled, textStyles = {}, children }: { enabled: boolean; textStyles?: Record<string, TextStyle>; children: ReactNode }) {
  const value = useMemo(() => ({ enabled, textStyles }), [enabled, textStyles]);
  return <EditorPreviewContext.Provider value={value}>{children}</EditorPreviewContext.Provider>;
}

function textStyle(style?: TextStyle): CSSProperties | undefined {
  if (!style) return undefined;
  return {
    color: style.color,
    fontWeight: style.bold ? 700 : undefined,
    fontStyle: style.italic ? "italic" : undefined,
    textAlign: style.align === "inherit" ? undefined : style.align,
    lineHeight: style.leading === "compact" ? 1.15 : style.leading === "relaxed" ? 1.75 : undefined,
  };
}

function textRoleClass(role?: TextStyle["role"]) {
  if (role === "label") return "editor-text-label";
  if (role === "body") return "editor-text-body";
  if (role === "subtitle") return "editor-text-subtitle";
  if (role === "sectionTitle") return "editor-text-section-title";
  if (role === "display") return "editor-text-display";
  return "";
}

/** Same inline marks in editor and visitor views; block layout is unchanged. */
export function EditableText({ path, value, as = "span", className, styleKey: styleKeyProp }: {
  path: string; value: string; as?: ElementType; className?: string;
  /** Where this placement's formatting is stored; defaults to the content path. */
  styleKey?: string;
}) {
  const styleKey = styleKeyProp ?? path;
  const { enabled: editorPreview, textStyles } = useContext(EditorPreviewContext);
  const appliedStyle = textStyles[styleKey];
  const inline = normalizeInlineText(appliedStyle?.inline, value);
  const elementRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const propsRef = useRef({ value, appliedStyle });
  propsRef.current = { value, appliedStyle };
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editorPreview || !elementRef.current) return;
    let original = inlineToContent(propsRef.current.value, propsRef.current.appliedStyle?.inline, propsRef.current.appliedStyle);
    let committed = JSON.stringify(original);
    let selection = { from: 0, to: 0 };
    const postSelection = (editor: Editor) => {
      selection = { from: editor.state.selection.from, to: editor.state.selection.to };
      window.parent.postMessage({ type: "trip-editor-text-select", path: styleKey, hasSelection: selection.from !== selection.to,
        marks: { bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"), href: editor.getAttributes("link").href ?? "" } }, window.location.origin);
    };
    const commit = (editor: Editor) => {
      const json = editor.getJSON();
      const next = contentToInline(json);
      if (editableFieldDefinition(path).required && !next.text.trim()) {
        editor.commands.setContent(original, { emitUpdate: false }); return;
      }
      if (JSON.stringify(json) === committed) return;
      committed = JSON.stringify(json);
      window.parent.postMessage({ type: "trip-editor-text-commit", path, styleKey, value: next.text, inline: next }, window.location.origin);
    };
    const editor = createInlineEditor({
      element: elementRef.current,
      content: original,
      editorProps: {
        attributes: { class: "inline-editor-root", role: "textbox", "aria-label": `Editar ${path}`, tabindex: "0" },
        handleKeyDown: (view, event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault(); editor.commands.setContent(original, { emitUpdate: false });
            committed = JSON.stringify(original); view.dom.blur(); return true;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey && editableFieldDefinition(path).multiline) editor.commands.setHardBreak();
            else view.dom.blur();
            return true;
          }
          return false;
        },
      },
      onFocus: ({ editor }) => { editingRef.current = true; original = editor.getJSON(); postSelection(editor); },
      onBlur: ({ editor }) => { editingRef.current = false; commit(editor); },
      onSelectionUpdate: ({ editor }) => postSelection(editor),
    });
    editorRef.current = editor;
    const format = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data.type !== "trip-editor-inline-format" || event.data.path !== styleKey || selection.from === selection.to) return;
      const chain = editor.chain().focus().setTextSelection(selection);
      const command = event.data.command;
      if (command === "bold") chain.toggleBold().run();
      else if (command === "italic") chain.toggleItalic().run();
      else if (command === "underline") chain.toggleUnderline().run();
      else if (command === "clear") chain.unsetAllMarks().run();
      else if (command === "link") {
        const href = safeTextLink(event.data.href);
        if (href) chain.setLink({ href }).run();
        else if (!event.data.href) chain.unsetLink().run();
        else return;
      } else return;
      commit(editor); postSelection(editor);
    };
    window.addEventListener("message", format);
    return () => { window.removeEventListener("message", format); editor.destroy(); editorRef.current = null; };
  }, [editorPreview, path, styleKey]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editingRef.current) return;
    const next = inlineToContent(value, appliedStyle?.inline, appliedStyle);
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(next)) editor.commands.setContent(next, { emitUpdate: false });
  }, [value, appliedStyle]);

  const commonProps = {
    className: `${className ?? ""} ${textRoleClass(appliedStyle?.role)} editor-text-safe`,
    style: textStyle(inline ? { ...appliedStyle, bold: false, italic: false } : appliedStyle),
  };
  if (editorPreview) return createElement(as, {
    ...commonProps, ref: elementRef,
    className: `${commonProps.className} editor-editable-text${isPlaceholder(value) ? " editor-placeholder" : ""}`,
    onClick: (event: MouseEvent<HTMLElement>) => { event.preventDefault(); event.stopPropagation(); },
  });
  const children = inline ? inline.runs.map((run, index) => {
    let node: ReactNode = run.text;
    if (run.bold) node = <strong>{node}</strong>;
    if (run.italic) node = <em>{node}</em>;
    if (run.underline) node = <u>{node}</u>;
    if (run.href) node = <a href={run.href}>{node}</a>;
    return <span key={index}>{node}</span>;
  }) : value;
  const node = createElement(as, commonProps, children);
  const href = !inline && safeTextLink(appliedStyle?.href);
  return href ? <a href={href}>{node}</a> : node;
}

export function EditableImage({ image, imageKey, className, ...props }: {
  image: Img;
  imageKey: string;
  className?: string;
  loading?: "eager" | "lazy";
  width?: number;
  height?: number;
  fetchPriority?: "high" | "low" | "auto";
  style?: CSSProperties;
}) {
  const { enabled: editorPreview } = useContext(EditorPreviewContext);
  const choose = () => {
    if (!editorPreview) return;
    window.parent.postMessage({ type: "trip-editor-image-click", imageKey }, window.location.origin);
  };
  return (
    <img
      src={image.src}
      alt={image.alt}
      className={`${className ?? ""} ${editorPreview ? "editor-editable-image cursor-pointer" : ""}`}
      onClick={choose}
      onKeyDown={(event) => { if (editorPreview && (event.key === "Enter" || event.key === " ")) choose(); }}
      role={editorPreview ? "button" : undefined}
      tabIndex={editorPreview ? 0 : undefined}
      title={editorPreview ? "Cambiar imagen" : undefined}
      {...props}
    />
  );
}

export function sectionStyle(style?: SectionStyle): CSSProperties | undefined {
  if (!style) return undefined;
  return {
    "--section-background": style.background,
    "--section-heading": style.heading,
    "--section-text": style.text,
    "--section-accent": style.accent,
    "--section-spacing": style.spacing === "compact" ? "4rem" : style.spacing === "spacious" ? "10rem" : undefined,
    "--section-align": style.align === "inherit" ? undefined : style.align,
    ...sectionButtonVars(style),
  } as unknown as CSSProperties;
}

export function hasButtonStyle(style?: SectionStyle) {
  return Boolean(style && (style.buttonBackground || style.buttonText || style.buttonVariant || style.buttonShape));
}

/** Botones por sección: variables CSS acotadas a la sección, nunca al tema de la app. */
function sectionButtonVars(style: SectionStyle) {
  if (!hasButtonStyle(style)) return {};
  return buttonVars({
    background: style.buttonBackground ?? "var(--button-color, var(--primary))",
    text: style.buttonText,
    variant: style.buttonVariant ?? "solid",
    shape: style.buttonShape,
  });
}

/** Variables CSS de un botón con estilo propio (se aplican inline al <a>, pisan las de la sección). */
export function buttonVars({ background, text, variant, shape }: { background: string; text?: string; variant: "solid" | "outline" | "text"; shape?: "square" | "rounded" | "pill" }) {
  const radius = shape === "pill" ? "999px" : shape === "rounded" ? "0.5rem" : "0";
  if (variant === "solid") return { "--sbtn-bg": background, "--sbtn-fg": text ?? "var(--primary-foreground)", "--sbtn-border": background, "--sbtn-radius": radius };
  if (variant === "outline") return { "--sbtn-bg": "transparent", "--sbtn-fg": text ?? background, "--sbtn-border": background, "--sbtn-radius": radius };
  return { "--sbtn-bg": "transparent", "--sbtn-fg": text ?? background, "--sbtn-border": "transparent", "--sbtn-radius": "0", "--sbtn-underline": text ?? background, "--sbtn-px": "0" };
}

/** Detecta placeholders [ASÍ]: los enlaces de reserva no deben apuntar a una URL vacía. */
export const isPlaceholder = (value: string) => /^\s*\[.*\]\s*$/.test(value);

/** Resalta discretamente los placeholders [ASÍ] para que sean fáciles de detectar. */
export function Txt({ children }: { children: string }) {
  const parts = children.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[") ? (
          <span key={i} className="placeholder-tag">{p}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function SectionHead({ eyebrow, title, intro, center }: { eyebrow: ReactNode; title: ReactNode; intro?: string; center?: boolean }) {
  return (
    <header className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow ? <p className="eyebrow text-primary">{eyebrow}</p> : null}
      <h2 className={`${eyebrow ? "section-title-gap" : ""} text-4xl leading-[1.05] md:text-6xl`}>{title}</h2>
      {intro && <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{intro}</p>}
    </header>
  );
}

export type CtaResolver = { resolve: (ctaId: string) => { href: string; newTab: boolean }; label: (ctaId: string) => string | undefined; style?: (ctaId: string) => CtaButtonStyle | undefined };
const CtaContext = createContext<CtaResolver | null>(null);
export function CtaProvider({ value, children }: { value: CtaResolver | null; children: ReactNode }) {
  return <CtaContext.Provider value={value}>{children}</CtaContext.Provider>;
}

/** Texto de un CTA: propio del botón si se editó, si no el texto original compartido. */
export function CtaText({ ctaId, value }: { ctaId: string; value: string }) {
  const cta = useContext(CtaContext);
  const own = cta?.label(ctaId);
  return <EditableText path={`ctaLinks.${ctaId}.label`} value={own ?? value} />;
}

export function BookLink({ href = "", ctaId, children, variant = "primary", className = "" }: { href?: string; ctaId?: string; children: ReactNode; variant?: "primary" | "ghost"; className?: string }) {
  const { enabled: editorPreview } = useEditorPreview();
  const cta = useContext(CtaContext);
  const resolved = ctaId && cta ? cta.resolve(ctaId) : { href: isPlaceholder(href) ? "#reserva" : href, newTab: false };
  const ownStyle = ctaId && cta?.style ? cta.style(ctaId) : undefined;
  const inlineVars = ownStyle && (ownStyle.background || ownStyle.text || ownStyle.variant)
    ? buttonVars({ background: ownStyle.background ?? "var(--button-color, var(--primary))", text: ownStyle.text, variant: ownStyle.variant ?? "solid", shape: ownStyle.shape })
    : undefined;
  // Con estilo propio el botón usa siempre btn-primary: las variables inline definen fondo, borde y forma.
  const look = inlineVars ? "primary" : variant;
  // En modo editor el clic lo intercepta TripPreview a nivel DOM (capture) para abrir la edición del botón sin navegar.
  return (
    <a
      href={resolved.href}
      data-cta-id={ctaId}
      target={resolved.newTab ? "_blank" : undefined}
      rel={resolved.newTab ? "noopener noreferrer" : undefined}
      className={`${look === "primary" ? "btn-primary" : "btn-ghost"} ${className}`}
      style={inlineVars as CSSProperties | undefined}
      title={editorPreview ? "Editar botón" : undefined}
    >
      {children}
    </a>
  );
}

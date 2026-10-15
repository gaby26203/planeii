import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Link from "@tiptap/extension-link";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Heading1, Heading2, Heading3, Pilcrow, Palette, Undo2, Redo2, Link2, Link2Off } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface RichEditorProps {
  value: unknown;
  onChange: (json: unknown) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const COLORS: { label: string; value: string; swatch: string }[] = [
  { label: "Predeterminado", value: "", swatch: "hsl(var(--foreground))" },
  { label: "Azul", value: "#2563eb", swatch: "#2563eb" },
  { label: "Rosado", value: "#ec4899", swatch: "#ec4899" },
  { label: "Naranja", value: "#f97316", swatch: "#f97316" },
  { label: "Verde", value: "#16a34a", swatch: "#16a34a" },
  { label: "Rojo", value: "#dc2626", swatch: "#dc2626" },
];

export function RichEditor({
  value,
  onChange,
  editable = true,
  className,
  minHeight = "300px",
}: RichEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
          class: "underline text-primary",
        },
      }),
    ],
    content: value && typeof value === "object" && Object.keys(value as object).length > 0
      ? (value as any)
      : { type: "doc", content: [{ type: "paragraph" }] },
    editable,
    editorProps: {
      attributes: {
        class: cn(
          "focus:outline-none font-body",
          "px-4 py-3",
        ),
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;

  const currentColor = editor.getAttributes("textStyle").color as string | undefined;

  const selectCurrentBlock = () => {
    const { from } = editor.state.selection;
    const $pos = editor.state.doc.resolve(from);
    const depth = $pos.depth;
    return { from: $pos.start(depth), to: $pos.end(depth) };
  };

  const openLinkPrompt = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    setLinkDraft(prev);
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkDraft.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href: withProtocol }).run();
    }
    setLinkOpen(false);
    setLinkDraft("");
  };

  const linkControls = (
    <>
      {linkOpen ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type="url"
            placeholder="https://…"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setLinkOpen(false);
                setLinkDraft("");
              }
            }}
            className="h-7 w-48 rounded border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={applyLink}>
            Aplicar
          </Button>
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0", editor.isActive("link") && "bg-accent")}
            onClick={openLinkPrompt}
            aria-label="Agregar enlace"
            title="Agregar enlace (selecciona el texto)"
          >
            <Link2 className="h-4 w-4" />
          </Button>
          {editor.isActive("link") && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
              aria-label="Quitar enlace"
              title="Quitar enlace"
            >
              <Link2Off className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
    </>
  );

  const applyBlockColor = (color: string) => {
    const range = selectCurrentBlock();
    const chain = editor.chain().focus().setTextSelection(range);
    if (color) chain.setColor(color).run();
    else chain.unsetColor().run();
  };

  return (
    <div className={cn("rounded-lg border border-border bg-background", className)}>
      {editable && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border/60 p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
            aria-label="Deshacer (Ctrl/Cmd+Z)"
            title="Deshacer (Ctrl/Cmd+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
            aria-label="Rehacer (Ctrl/Cmd+Shift+Z)"
            title="Rehacer (Ctrl/Cmd+Shift+Z)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Toggle
            size="sm"
            pressed={editor.isActive("heading", { level: 1 })}
            onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            aria-label="Título"
            title="Título"
          >
            <Heading1 className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive("heading", { level: 2 })}
            onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            aria-label="Subtítulo"
            title="Subtítulo"
          >
            <Heading2 className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive("heading", { level: 3 })}
            onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            aria-label="Subtítulo pequeño"
            title="Subtítulo pequeño"
          >
            <Heading3 className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={editor.isActive("paragraph") && !editor.isActive("heading")}
            onPressedChange={() => editor.chain().focus().setParagraph().run()}
            aria-label="Texto"
            title="Texto"
          >
            <Pilcrow className="h-4 w-4" />
          </Toggle>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Toggle
            size="sm"
            pressed={editor.isActive("bold")}
            onPressedChange={() => editor.chain().focus().toggleBold().run()}
            aria-label="Negrita"
            title="Negrita"
          >
            <Bold className="h-4 w-4" />
          </Toggle>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2"
                aria-label="Color de texto"
                title="Color de texto"
              >
                <Palette className="h-4 w-4" />
                <span
                  className="h-3 w-3 rounded-full border border-border"
                  style={{ background: currentColor || "hsl(var(--foreground))" }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex items-center gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    onClick={() => applyBlockColor(c.value)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition",
                      (currentColor ?? "") === c.value
                        ? "border-foreground"
                        : "border-border hover:border-foreground/50",
                    )}
                    style={{ background: c.swatch }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Separator orientation="vertical" className="mx-1 h-6" />
          {linkControls}
        </div>
      )}
      {editable && (
        <BubbleMenu
          editor={editor}
          options={{ placement: "top" }}
          shouldShow={({ editor: ed, from, to }: { editor: { isEditable: boolean }; from: number; to: number }) => {
            if (from === to) return false;
            return ed.isEditable;
          }}
        >
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-md">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-accent")}
              onClick={() => editor.chain().focus().toggleBold().run()}
              aria-label="Negrita"
              title="Negrita"
            >
              <Bold className="h-4 w-4" />
            </Button>
            {linkControls}
          </div>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

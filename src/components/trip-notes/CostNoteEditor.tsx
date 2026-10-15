import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect, useState } from "react";
import { Bold as BoldIcon, Link2, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";

interface CostNoteEditorProps {
  value: string;
  onChange: (html: string) => void;
  onSaveShortcut?: () => void;
  onCancelShortcut?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Inline rich-text editor for the "notes" cell in the costs/itinerary table.
 * Supports Bold and Link via a bubble menu that appears on text selection.
 * Enter saves, Shift+Enter inserts a line break, Escape cancels.
 * Stored as HTML string (plain-text legacy values remain compatible).
 */
export function CostNoteEditor({
  value,
  onChange,
  onSaveShortcut,
  onCancelShortcut,
  autoFocus,
  placeholder = "—",
  className,
}: CostNoteEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
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
    content: value || "",
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        class: cn(
          "focus:outline-none text-sm min-h-[2rem] w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] py-1 px-2 pr-14",
          "prose prose-sm max-w-none",
        ),
        "data-placeholder": placeholder,
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          onSaveShortcut?.();
          return true;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancelShortcut?.();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // treat empty paragraphs as empty string
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const normalized = value || "";
    if (current !== normalized && !editor.isFocused) {
      editor.commands.setContent(normalized || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const openLinkPrompt = () => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    setLinkDraft(prev);
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkDraft.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href: withProtocol }).run();
    }
    setLinkOpen(false);
    setLinkDraft("");
  };

  return (
    <div className={cn("relative w-full", className)}>
      <BubbleMenu
        editor={editor}
        options={{ placement: "top" }}
        shouldShow={({ editor, from, to }: { editor: { isEditable: boolean }; from: number; to: number }) => {
          if (from === to) return false;
          return editor.isEditable;
        }}
      >
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-popover p-1 shadow-md">
          {linkOpen ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="url"
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setLinkOpen(false);
                  }
                }}
                placeholder="https://…"
                className="h-6 w-40 rounded border border-border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={applyLink}
                className="h-6 rounded px-1.5 text-xs font-medium text-primary hover:bg-secondary"
              >
                OK
              </button>
              {editor.isActive("link") && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setLinkOpen(false);
                  }}
                  className="h-6 rounded px-1 text-muted-foreground hover:bg-secondary"
                  title="Quitar enlace"
                >
                  <Link2Off className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded hover:bg-secondary",
                  editor.isActive("bold") && "bg-secondary text-foreground",
                )}
                title="Negrita"
                aria-label="Negrita"
              >
                <BoldIcon className="h-3.5 w-3.5" />
              </button>
              {editor.isActive("link") ? (
                <>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={openLinkPrompt}
                    className="flex h-6 items-center gap-1 rounded px-1.5 text-xs hover:bg-secondary"
                    title="Editar enlace"
                    aria-label="Editar enlace"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => editor.chain().focus().unsetLink().run()}
                    className="flex h-6 items-center gap-1 rounded px-1.5 text-xs text-muted-foreground hover:bg-secondary"
                    title="Quitar enlace"
                    aria-label="Quitar enlace"
                  >
                    <Link2Off className="h-3.5 w-3.5" />
                    Quitar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={openLinkPrompt}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-secondary"
                  title="Enlace"
                  aria-label="Enlace"
                >
                  <Link2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Read-only renderer for a cost note. Renders HTML (including bold/links)
 * if present, otherwise renders plain text (legacy values).
 */
export function CostNoteDisplay({
  value,
  className,
  onClick,
}: {
  value: string | undefined | null;
  className?: string;
  onClick?: () => void;
}) {
  const text = (value ?? "").trim();
  if (!text) {
    return (
      <div className={className} onClick={onClick}>
        —
      </div>
    );
  }
  const looksLikeHtml = /<[a-z][^>]*>/i.test(text);
  if (!looksLikeHtml) {
    return (
      <div className={className} onClick={onClick}>
        {value}
      </div>
    );
  }
  return (
    <div
      className={cn(className, "[&_a]:underline [&_a]:text-primary [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5")}
      onClick={(e) => {
        // Let clicks on links open normally; anything else triggers edit.
        const target = e.target as HTMLElement;
        if (target.closest("a")) return;
        onClick?.();
      }}
      dangerouslySetInnerHTML={{ __html: text }}
    />
  );
}

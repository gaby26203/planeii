import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, X, Plus } from "lucide-react";
import { TagNode } from "./TagNode";
import type { DescriptionNode, TripTag, TagColorKey } from "@/lib/tags";
import {
  TAG_COLOR_CLASSES,
  normalizeTagLabel,
  isDuplicateTagLabel,
  mergeAdjacentText,
} from "@/lib/tags";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCommitOnClickOutside } from "@/hooks/use-commit-on-click-outside";

interface Props {
  nodes: DescriptionNode[] | undefined;
  legacyText: string;
  tags: TripTag[];
  onSave: (nodes: DescriptionNode[], opts?: { silent?: boolean }) => void;
  /** Identificador del contenedor para el guardado al hacer click afuera. */
  inlineEditKey?: string;
  onCancel: () => void;
  onCreateTag: (label: string, colorKey: TagColorKey) => TripTag | null;
  autoFocus?: boolean;
  placeholder?: string;
}

/**
 * Editor inline con soporte para chips de tag y comando `/` para insertar.
 * Enter guarda, Esc cancela, Shift+Enter no aplica (descripción single-line).
 */
export function DescriptionEditor({
  nodes,
  legacyText,
  tags,
  onSave,
  inlineEditKey,
  onCancel,
  onCreateTag,
  autoFocus,
  placeholder = "Descripción",
}: Props) {
  const initialContent = useMemo(() => tiptapDocFromNodes(nodes, legacyText), []);
  const [menu, setMenu] = useState<{ open: boolean; query: string; from: number; to: number }>({
    open: false,
    query: "",
    from: 0,
    to: 0,
  });
  const [menuIndex, setMenuIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: false,
          orderedList: false,
          bulletList: false,
          listItem: false,
          blockquote: false,
          codeBlock: false,
          horizontalRule: false,
          hardBreak: false,
        }),
        TagNode,
      ],
      content: initialContent,
      autofocus: autoFocus ? "end" : false,
      editorProps: {
        attributes: {
          class: cn(
            "focus:outline-none text-sm min-h-[2rem] w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] py-1 px-2 pr-14 font-medium",
          ),
          "data-placeholder": placeholder,
        },
      },
    },
    [],
  );

  // Publicar tags en el storage del NodeView para render dinámico.
  useEffect(() => {
    if (!editor) return;
    (editor.storage as unknown as Record<string, unknown>).tag = { tags };
    editor.view.dispatch(editor.view.state.tr);
  }, [editor, tags]);

  // Detección del comando "/".
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const { state } = editor;
      const { from } = state.selection;
      // Buscar hacia atrás hasta hallar "/" o whitespace / inicio de línea.
      const $from = state.doc.resolve(from);
      const parent = $from.parent;
      const parentStart = $from.start();
      const offset = from - parentStart;
      const text = parent.textBetween(0, offset, "\n", "\ufffc");
      const match = /(^|\s)\/([\p{L}\p{N} ]{0,32})$/u.exec(text);
      if (!match) {
        setMenu((m) => (m.open ? { ...m, open: false } : m));
        return;
      }
      const slashIndex = match.index + (match[1] ? 1 : 0); // pos del "/"
      const slashPos = parentStart + slashIndex;
      const endPos = from;
      const query = match[2];
      setMenu({ open: true, query, from: slashPos, to: endPos });
      setMenuIndex(0);
    };
    editor.on("selectionUpdate", handler);
    editor.on("update", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("update", handler);
    };
  }, [editor]);

  const filteredTags = useMemo(() => {
    if (!menu.open) return [];
    const q = normalizeTagLabel(menu.query);
    if (!q) return tags.slice(0, 8);
    return tags
      .filter((t) => normalizeTagLabel(t.label).includes(q))
      .slice(0, 8);
  }, [menu.open, menu.query, tags]);

  const canCreate =
    menu.open &&
    menu.query.trim().length > 0 &&
    !isDuplicateTagLabel(tags, menu.query);

  function insertTagFromMenu(tag: TripTag) {
    if (!editor) return;
    const { from, to } = menu;
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from, to },
        [
          { type: "tag", attrs: { tagId: tag.id, fallbackLabel: tag.label } },
          { type: "text", text: " " },
        ],
      )
      .run();
    setMenu({ open: false, query: "", from: 0, to: 0 });
  }

  function handleCreate() {
    const label = menu.query.trim();
    if (!label) return;
    const created = onCreateTag(label, "gray");
    if (created) insertTagFromMenu(created);
  }

  function commit(opts?: { silent?: boolean }) {
    if (!editor) return;
    const result = nodesFromTiptapDoc(editor.getJSON());
    onSave(result, opts);
  }

  // Guardar cuando el usuario hace click afuera del editor.
  useCommitOnClickOutside(inlineEditKey ?? null, () => commit({ silent: true }));


  function handleKeyDown(e: React.KeyboardEvent) {
    if (menu.open && filteredTags.length + (canCreate ? 1 : 0) > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMenuIndex((i) => Math.min(i + 1, filteredTags.length + (canCreate ? 1 : 0) - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMenuIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (menuIndex < filteredTags.length) {
          insertTagFromMenu(filteredTags[menuIndex]);
        } else if (canCreate) {
          handleCreate();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu({ open: false, query: "", from: 0, to: 0 });
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div
      className="relative w-full"
      ref={containerRef}
      onKeyDown={handleKeyDown}
      data-inline-editing={inlineEditKey}
    >
      <EditorContent editor={editor} />
      <div className="absolute top-1 right-1 flex gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-primary hover:text-primary"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => commit()}
          title="Guardar (Enter)"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-muted-foreground"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCancel}
          title="Cancelar (Esc)"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {menu.open && (filteredTags.length > 0 || canCreate) && (
        <div className="absolute left-2 top-full mt-1 z-50 min-w-[220px] rounded-md border border-border bg-popover shadow-md p-1">
          <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
            Tags
          </div>
          {filteredTags.map((t, i) => {
            const colors = TAG_COLOR_CLASSES[t.colorKey];
            return (
              <button
                key={t.id}
                type="button"
                className={cn(
                  "w-full flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-secondary/60",
                  menuIndex === i && "bg-secondary/60",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertTagFromMenu(t);
                }}
                onMouseEnter={() => setMenuIndex(i)}
              >
                <span className={cn("h-2 w-2 rounded-full", colors.swatch)} />
                <span className="uppercase text-xs font-semibold">{t.label}</span>
              </button>
            );
          })}
          {canCreate && (
            <button
              type="button"
              className={cn(
                "w-full flex items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-secondary/60 border-t border-border/60 mt-1",
                menuIndex === filteredTags.length && "bg-secondary/60",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                handleCreate();
              }}
              onMouseEnter={() => setMenuIndex(filteredTags.length)}
            >
              <Plus className="h-3 w-3" />
              <span className="text-xs">
                Crear{" "}
                <span className="font-semibold uppercase">
                  {normalizeTagLabel(menu.query)}
                </span>
              </span>
            </button>
          )}
          {filteredTags.length === 0 && !canCreate && (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              No hay tags con ese nombre
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Serialización Tiptap ↔ DescriptionNode[] ─────────────────────────

function tiptapDocFromNodes(
  nodes: DescriptionNode[] | undefined,
  legacyText: string,
): JSONContent {
  const content: JSONContent[] = [];
  if (nodes && nodes.length > 0) {
    for (const n of nodes) {
      if (n.type === "text") {
        if (n.value) content.push({ type: "text", text: n.value });
      } else {
        content.push({
          type: "tag",
          attrs: { tagId: n.tagId, fallbackLabel: n.fallbackLabel },
        });
      }
    }
  } else if (legacyText) {
    content.push({ type: "text", text: legacyText });
  }
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content,
      },
    ],
  };
}

function nodesFromTiptapDoc(doc: {
  content?: Array<{ content?: Array<{ type: string; text?: string; attrs?: Record<string, unknown> }> }>;
}): DescriptionNode[] {
  const out: DescriptionNode[] = [];
  const paragraphs = doc.content ?? [];
  paragraphs.forEach((p, pi) => {
    const inner = p.content ?? [];
    for (const n of inner) {
      if (n.type === "text" && typeof n.text === "string") {
        out.push({ type: "text", value: n.text });
      } else if (n.type === "tag" && n.attrs) {
        out.push({
          type: "tag",
          tagId: String(n.attrs.tagId ?? ""),
          fallbackLabel: String(n.attrs.fallbackLabel ?? ""),
        });
      }
    }
    if (pi < paragraphs.length - 1) out.push({ type: "text", value: "\n" });
  });
  return mergeAdjacentText(out);
}

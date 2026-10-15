import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { TripTag } from "@/lib/tags";
import { TAG_COLOR_CLASSES } from "@/lib/tags";
import { cn } from "@/lib/utils";

export interface TagNodeStorage {
  tags: TripTag[];
}

export const TagNode = Node.create<Record<string, never>, TagNodeStorage>({
  name: "tag",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      tagId: { default: "" },
      fallbackLabel: { default: "" },
    };
  },

  addStorage() {
    return { tags: [] };
  },

  parseHTML() {
    return [{ tag: "span[data-inline-tag]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-inline-tag": "true",
        "data-tag-id": node.attrs.tagId,
        "data-fallback": node.attrs.fallbackLabel,
      }),
      `[${node.attrs.fallbackLabel}]`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TagChipView);
  },
});

function TagChipView(props: any) {
  const { node, editor } = props;
  const storage = (editor.storage as { tag?: TagNodeStorage }).tag;
  const tags = storage?.tags ?? [];
  const tagId = String(node.attrs.tagId ?? "");
  const fallbackLabel = String(node.attrs.fallbackLabel ?? "");
  const tag = tags.find((t) => t.id === tagId);
  const label = tag?.label ?? fallbackLabel;
  const colors = tag
    ? TAG_COLOR_CLASSES[tag.colorKey]
    : TAG_COLOR_CLASSES.gray;
  return (
    <NodeViewWrapper
      as="span"
      className={cn(
        "inline-flex items-center rounded px-1.5 py-[1px] mx-0.5 text-[10px] font-semibold uppercase tracking-wide align-baseline select-all",
        colors.bg,
        colors.text,
        !tag && "italic opacity-70",
      )}
      contentEditable={false}
      data-tag-id={node.attrs.tagId}
    >
      {label}
    </NodeViewWrapper>
  );
}

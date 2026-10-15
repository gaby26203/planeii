import type { DescriptionNode } from "@/lib/tags";
import { TAG_COLOR_CLASSES, type TripTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

interface Props {
  nodes: DescriptionNode[] | undefined;
  legacyText: string;
  tags: TripTag[];
  className?: string;
}

/**
 * Render de la descripción con chips visuales. Si no hay `nodes`, se muestra
 * `legacyText` como texto plano.
 */
export function DescriptionRender({ nodes, legacyText, tags, className }: Props) {
  if (!nodes || nodes.length === 0) {
    return <span className={cn("whitespace-pre-wrap", className)}>{legacyText}</span>;
  }
  const tagById = new Map(tags.map((t) => [t.id, t]));
  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {nodes.map((n, i) => {
        if (n.type === "text") {
          return <span key={i}>{n.value}</span>;
        }
        const tag = tagById.get(n.tagId);
        const label = tag?.label ?? n.fallbackLabel;
        const colors = tag
          ? TAG_COLOR_CLASSES[tag.colorKey]
          : TAG_COLOR_CLASSES.gray;
        return (
          <span
            key={i}
            className={cn(
              "inline-flex items-center rounded px-1.5 py-[1px] mx-0.5 text-[10px] font-semibold uppercase tracking-wide align-baseline",
              colors.bg,
              colors.text,
              !tag && "italic opacity-70",
            )}
            title={tag ? undefined : "Tag no encontrado"}
          >
            {label}
          </span>
        );
      })}
    </span>
  );
}

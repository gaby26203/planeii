import { Editor, Node } from "@tiptap/core";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Underline from "@tiptap/extension-underline";
import HardBreak from "@tiptap/extension-hard-break";
import Link from "@tiptap/extension-link";
import { safeTextLink } from "@/lib/inline-text";

/** One inline root keeps the original heading/span/paragraph in the layout. */
const InlineDocument = Node.create({ name: "doc", topNode: true, content: "inline*" });
export function createInlineEditor(options: ConstructorParameters<typeof Editor>[0]) {
  return new Editor({
    ...options,
    extensions: [InlineDocument, Text, Bold, Italic, Underline, HardBreak, Link.configure({ openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: (url) => Boolean(safeTextLink(url)) })],
  });
}
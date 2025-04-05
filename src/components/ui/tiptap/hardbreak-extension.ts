import { HardBreak } from "@tiptap/extension-hard-break";
import { Fragment, Node, Slice } from "@tiptap/pm/model";

export const CustomHardBreak = HardBreak.extend({
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.setHardBreak(),
    };
  },
});

export function clipboardTextParser(text, context, plain) {
  // Create a single paragraph with hard breaks instead of multiple paragraphs
  const lines = text.split(/(?:\r\n?|\n)/);
  const content = [];

  // Process lines into text nodes with hard breaks between them
  lines.forEach((line, index) => {
    if (line.length > 0) {
      content.push({ type: "text", text: line });
    }
    // Add hard break between lines (but not after the last line)
    if (index < lines.length - 1) {
      content.push({ type: "hardBreak" });
    }
  });

  // Create a single paragraph containing all content
  const nodeJson = {
    type: "paragraph",
    content: content.length > 0 ? content : undefined,
  };

  const node = Node.fromJSON(context.doc.type.schema, nodeJson);
  return Slice.maxOpen(Fragment.from(node));
}

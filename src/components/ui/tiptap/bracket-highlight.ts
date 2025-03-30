import { Extension } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Extension to highlight text between double brackets and quotes
export const BracketHighlight = Extension.create({
  name: "bracketHighlight",

  addProseMirrorPlugins() {
    const bracketRegex = /\{\{([^{}]+)\}\}/g;
    const quoteRegex = /"([^"]+)"/g;

    return [
      new Plugin({
        key: new PluginKey("bracketHighlight"),
        props: {
          decorations(state) {
            const { doc } = state;
            const decorations: Decoration[] = [];

            doc.descendants((node: ProseMirrorNode, pos: number) => {
              if (!node.isText) {
                return;
              }

              const text = node.text || "";

              // Process bracket matches
              let bracketMatch: RegExpExecArray | null = bracketRegex.exec(text);
              while (bracketMatch !== null) {
                const start = pos + bracketMatch.index;
                const end = start + bracketMatch[0].length;

                decorations.push(
                  Decoration.inline(start, end, {
                    class: "textarea-special-text",
                  }),
                );

                bracketMatch = bracketRegex.exec(text);
              }

              // Process quote matches
              let quoteMatch: RegExpExecArray | null = quoteRegex.exec(text);
              while (quoteMatch !== null) {
                const start = pos + quoteMatch.index;
                const end = start + quoteMatch[0].length;

                decorations.push(
                  Decoration.inline(start, end, {
                    class: "textarea-quoted-text",
                  }),
                );

                quoteMatch = quoteRegex.exec(text);
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

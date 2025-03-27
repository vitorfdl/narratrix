import { Extension } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Extension to highlight text between double brackets
export const BracketHighlight = Extension.create({
  name: "bracketHighlight",

  addProseMirrorPlugins() {
    const highlightRegex = /\{\{([^{}]+)\}\}/g;

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
              let match: RegExpExecArray | null = highlightRegex.exec(text);

              while (match !== null) {
                const start = pos + match.index;
                const end = start + match[0].length;

                // Create a decoration with a CSS class that will style the text
                decorations.push(
                  Decoration.inline(start, end, {
                    class: "textarea-special-text",
                  }),
                );

                match = highlightRegex.exec(text);
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

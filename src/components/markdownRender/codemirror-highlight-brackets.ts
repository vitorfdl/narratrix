import { Extension, RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

// Decoration for the highlighted text
const highlightMark = Decoration.mark({
  attributes: { class: "cm-highlightedBracket" },
});

// Theme to style the decoration, referencing theme variables
const highlightTheme = EditorView.baseTheme({
  ".cm-highlightedBracket": {
    // backgroundColor: "hsla(var(--primary) / 0.4)", // Adjusted opacity slightly
    borderRadius: "3px",
    color: "hsl(var(--primary))", // Use HSL format for consistency
  },
});

// Function to find and apply decorations
function findAndHighlightBrackets(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  // Regex to find {{ content }} patterns, allowing for whitespace
  // It uses a non-greedy match for the content inside
  const regex = /\{\{\s*([^}]+?)\s*\}\}/g;

  // Iterate through visible ranges for efficiency
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let match: RegExpExecArray | null;
    // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
    while ((match = regex.exec(text))) {
      // Calculate exact positions in the document
      const start = from + match.index;
      const end = start + match[0].length;
      // Add the decoration to the builder
      builder.add(start, end, highlightMark);
    }
  }
  return builder.finish();
}

// The ViewPlugin instance
const highlightBracketsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      // Initial decoration calculation
      this.decorations = findAndHighlightBrackets(view);
    }

    update(update: ViewUpdate) {
      // Recalculate decorations if document or viewport changes
      if (update.docChanged || update.viewportChanged) {
        this.decorations = findAndHighlightBrackets(update.view);
      }
    }
  },
  {
    // Provide the decorations to the editor
    decorations: (v) => v.decorations,
  },
);

// Export the combined extension
export function highlightBracketsExtension(): Extension {
  return [highlightTheme, highlightBracketsPlugin];
}

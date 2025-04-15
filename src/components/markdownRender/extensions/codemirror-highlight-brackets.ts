import { Extension, RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

// Decoration for the highlighted text
const highlightMark = Decoration.mark({
  attributes: { class: "cm-highlightedBracket" },
});

// Decoration for quoted words
const highlightQuoteMark = Decoration.mark({
  attributes: { class: "cm-highlightedQuote" },
});

// Theme to style the decorations, referencing theme variables
const highlightTheme = EditorView.baseTheme({
  ".cm-highlightedBracket": {
    // backgroundColor: "hsla(var(--primary) / 0.4)", // Adjusted opacity slightly
    borderRadius: "3px",
    color: "hsl(var(--primary))", // Use HSL format for consistency
  },
  ".cm-highlightedQuote": {
    backgroundColor: "hsla(var(--primary) / 0.15)",
    borderRadius: "3px",
    color: "hsl(var(--primary))",
    fontWeight: "bold",
  },
});

/**
 * Finds and applies decorations for both {{brackets}} and quoted words.
 * Highlights:
 *   - {{ ... }} blocks (existing)
 *   - Words between single or double quotes (e.g., 'word', "word")
 * @param view EditorView
 * @returns DecorationSet
 */
function findAndHighlightBracketsAndQuotes(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  // Regex to find {{ content }} patterns, allowing for whitespace
  const bracketRegex = /\{\{\s*([^}]+?)\s*\}\}/g;
  // Regex to find words between single or double quotes (not spanning lines)
  const quoteRegex = /(['"])(?:(?=(\\?))\2.)*?\1/g;

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let match: RegExpExecArray | null;
    // Highlight {{ ... }}
    // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
    while ((match = bracketRegex.exec(text))) {
      const start = from + match.index;
      const end = start + match[0].length;
      builder.add(start, end, highlightMark);
    }
    // Highlight quoted words
    // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
    while ((match = quoteRegex.exec(text))) {
      const start = from + match.index;
      const end = start + match[0].length;
      builder.add(start, end, highlightQuoteMark);
    }
  }
  return builder.finish();
}

// The ViewPlugin instance
const highlightBracketsAndQuotesPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      // Initial decoration calculation
      this.decorations = findAndHighlightBracketsAndQuotes(view);
    }

    update(update: ViewUpdate) {
      // Recalculate decorations if document or viewport changes
      if (update.docChanged || update.viewportChanged) {
        this.decorations = findAndHighlightBracketsAndQuotes(update.view);
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
  return [highlightTheme, highlightBracketsAndQuotesPlugin];
}

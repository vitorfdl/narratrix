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
    backgroundColor: "hsla(var(--primary) / 0.15)",
    borderRadius: "3px",
    color: "hsl(var(--primary))", // Use HSL format for consistency
  },
  ".cm-highlightedQuote": {
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
  // Regex to find words between double quotes (including escaped quotes)
  const quoteRegex = /"([^"\\]|\\.)*"/g;

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    // Collect all matches for both patterns
    const matches: { start: number; end: number; type: "bracket" | "quote" }[] = [];

    // Find all {{ ... }} matches
    for (const match of text.matchAll(bracketRegex)) {
      if (match.index !== undefined) {
        const start = from + match.index;
        const end = start + match[0].length;
        matches.push({ start, end, type: "bracket" });
      }
    }
    // Find all quoted string matches
    for (const match of text.matchAll(quoteRegex)) {
      if (match.index !== undefined) {
        const start = from + match.index;
        const end = start + match[0].length;
        matches.push({ start, end, type: "quote" });
      }
    }
    // Sort matches by start index to avoid overlap issues
    matches.sort((a, b) => a.start - b.start);
    // Apply decorations
    for (const match of matches) {
      if (match.type === "bracket") {
        builder.add(match.start, match.end, highlightMark);
      } else {
        builder.add(match.start, match.end, highlightQuoteMark);
      }
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

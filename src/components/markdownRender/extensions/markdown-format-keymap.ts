import { EditorSelection, Extension, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";

/**
 * Markdown formatting keymap extension for CodeMirror.
 * - Mod-b: Toggle bold (**text**)
 * - Mod-i: Toggle italic (*text*)
 *
 * This extension ensures the highest precedence for these shortcuts.
 */
export const markdownFormatKeymap: Extension = Prec.highest(
  keymap.of([
    {
      key: "Mod-b",
      preventDefault: true,
      run: (view) => {
        try {
          const { state } = view;
          const changes = state.changeByRange((range) => {
            const selected = state.doc.sliceString(range.from, range.to);
            // If already bold, remove bold
            if (/^\*\*.*\*\*$/.test(selected)) {
              return {
                changes: { from: range.from, to: range.to, insert: selected.slice(2, -2) },
                range: EditorSelection.range(range.from, range.to - 4),
              };
            }
            // Otherwise, add bold
            return {
              changes: { from: range.from, to: range.to, insert: `**${selected}**` },
              range: EditorSelection.range(range.from + 2, range.to + 2),
            };
          });
          view.dispatch(changes, { userEvent: "input" });
          return true;
        } catch (err) {
          // Log error for debugging
          // eslint-disable-next-line no-console
          console.error("Error applying bold formatting:", err);
          return false;
        }
      },
    },
    {
      key: "Mod-i",
      preventDefault: true,
      run: (view) => {
        try {
          const { state } = view;
          const changes = state.changeByRange((range) => {
            const selected = state.doc.sliceString(range.from, range.to);
            // If already italic, remove italic
            if (/^\*[^*].*\*$/.test(selected)) {
              return {
                changes: { from: range.from, to: range.to, insert: selected.slice(1, -1) },
                range: EditorSelection.range(range.from, range.to - 2),
              };
            }
            // Otherwise, add italic
            return {
              changes: { from: range.from, to: range.to, insert: `*${selected}*` },
              range: EditorSelection.range(range.from + 1, range.to + 1),
            };
          });
          view.dispatch(changes, { userEvent: "input" });
          return true;
        } catch (err) {
          // Log error for debugging
          // eslint-disable-next-line no-console
          console.error("Error applying italic formatting:", err);
          return false;
        }
      },
    },
  ]),
);

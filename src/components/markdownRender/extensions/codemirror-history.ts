import { Completion, CompletionContext, CompletionResult, startCompletion } from "@codemirror/autocomplete";
import { Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";

/**
 * Creates a completion source for browsing input history with up arrow
 * @param historyItems Array of history items to display
 * @returns A completion source function for CodeMirror
 */
export function createHistoryCompletionSource(historyItems: string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    // Only trigger when editor is empty or has at most 3 characters and is explicitly activated
    if (!context.explicit || context.state.doc.length > 3) {
      return null;
    }

    const currentInput = context.state.doc.sliceString(0);

    // Filter out empty history items and create completion options
    const options: Completion[] = historyItems
      .filter((item) => item.trim().length > 0)
      .filter((item) => {
        // If there's input text, only show items that start with that text
        return currentInput.length === 0 || item.trim().toLowerCase().startsWith(currentInput.toLowerCase());
      })
      .map((item, index) => ({
        label: item.trim().length > 300 ? `${item.trim().substring(0, 300)}...` : item.trim(),
        type: "text",
        section: "History",
        boost: Math.max(1, 100 - (historyItems.length - 1 - index) * 10), // Gradually decrease boost from newest to oldest
      }));

    if (options.length === 0) {
      return null;
    }

    return {
      from: 0,
      options,
      validFor: /^.{0,3}$/, // Only valid for up to 3 characters
    };
  };
}

/**
 * Creates a keymap that triggers history completion on up arrow key when editor is empty or has limited content
 * @returns A keymap extension for CodeMirror
 */
function createHistoryKeymap() {
  return keymap.of([
    {
      key: "ArrowUp",
      run: (view) => {
        // Only trigger when editor is empty or has at most 3 characters
        if (view.state.doc.length <= 3) {
          // Use the imported startCompletion function which is the proper way
          // to trigger completion programmatically
          startCompletion(view);
          return true;
        }
        return false;
      },
    },
  ]);
}

/**
 * Creates a CodeMirror extension that enables history navigation with up arrow key
 * @param historyItems Array of history items to display
 * @returns CodeMirror extension for keymap only
 */
export function historyExtension(historyItems: string[]): Extension {
  if (!historyItems || historyItems.length === 0) {
    return [];
  }

  // Return only the keymap extension
  return createHistoryKeymap();
}

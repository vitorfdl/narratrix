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
    // Only trigger when editor is empty and explicitly activated
    if (!context.explicit || context.state.doc.length > 0) {
      return null;
    }

    // Filter out empty history items and create completion options
    const options: Completion[] = historyItems
      .filter((item) => item.trim().length > 0)
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
      validFor: /^.*$/,
    };
  };
}

/**
 * Creates a keymap that triggers history completion on up arrow key when editor is empty
 * @returns A keymap extension for CodeMirror
 */
function createHistoryKeymap() {
  return keymap.of([
    {
      key: "ArrowUp",
      run: (view) => {
        // Only trigger when editor is empty
        if (view.state.doc.length === 0) {
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

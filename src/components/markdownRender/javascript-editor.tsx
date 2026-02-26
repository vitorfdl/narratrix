import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { type Diagnostic, linter, lintGutter } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { Linter } from "eslint-linter-browserify";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { narratrixCodeMirror } from "./styles/narratrix-codemirror-theme";

// ---------------------------------------------------------------------------
// Narratrix runtime autocomplete
// ---------------------------------------------------------------------------

const CHAT_COMPLETIONS: Completion[] = [
  { label: "fetchChatList", type: "function", detail: "(profileId: string) => Promise<Chat[]>" },
  { label: "fetchChatMessages", type: "function", detail: "(chatId?, chapterId?) => Promise<ChatMessage[]>" },
  { label: "addChatMessage", type: "function", detail: "({ content, role, ... }) => Promise<ChatMessage>" },
  { label: "deleteChatMessage", type: "function", detail: "(messageId: string) => Promise<void>" },
  { label: "updateChatMessage", type: "function", detail: "(messageId, message, forceUpdate?) => Promise<ChatMessage>" },
  { label: "updateSelectedChat", type: "function", detail: "(chat: Partial<Chat>) => Promise<Chat>" },
  { label: "setSelectedChatById", type: "function", detail: "(profileId, id) => Promise<void>" },
  { label: "createChat", type: "function", detail: "(chat, skipDefaultChapter?) => Promise<Chat>" },
  { label: "deleteChat", type: "function", detail: "(id: string) => Promise<void>" },
  { label: "addChatChapter", type: "function", detail: "(chapter) => Promise<ChatChapter>" },
  { label: "duplicateChatChapter", type: "function", detail: "(chapterId: string) => Promise<ChatChapter>" },
  { label: "deleteChatChapter", type: "function", detail: "(chapterId: string) => Promise<boolean>" },
  { label: "updateChatChapter", type: "function", detail: "(chapterId, chapter) => Promise<ChatChapter | null>" },
  { label: "fetchChatChapters", type: "function", detail: "(chatId: string) => Promise<ChatChapter[]>" },
  { label: "switchChatChapter", type: "function", detail: "(chapterId: string) => Promise<void>" },
  { label: "addChatMemory", type: "function", detail: "({ content, type }) => Promise<ChatMemory>" },
  { label: "deleteChatMemory", type: "function", detail: "(memoryId: string) => Promise<boolean>" },
  { label: "updateChatMemory", type: "function", detail: "(memoryId, memory) => Promise<ChatMemory | null>" },
  { label: "fetchChatMemories", type: "function", detail: "(chatId?) => Promise<ChatMemory[]>" },
  { label: "refreshMemories", type: "function", detail: "() => Promise<void>" },
  { label: "updateShortMemory", type: "function", detail: '(scope: "user" | string, content: string) => Promise<void>' },
  { label: "getShortMemoryContent", type: "function", detail: '(scope: "user" | string) => string' },
  { label: "getShortMemoryScopes", type: "function", detail: "() => Array<{ scope, label, avatarUrl? }>" },
  { label: "addParticipant", type: "function", detail: "(participant: ChatParticipant) => Promise<void>" },
  { label: "removeParticipant", type: "function", detail: "(participantId: string) => Promise<void>" },
  { label: "updateParticipant", type: "function", detail: "(participantId, data) => Promise<void>" },
  { label: "toggleParticipantEnabled", type: "function", detail: "(participantId: string) => Promise<void>" },
];

const CHARACTER_COMPLETIONS: Completion[] = [
  { label: "createCharacter", type: "function", detail: "(characterData: Character) => Promise<Character>" },
  { label: "getCharacterById", type: "function", detail: "(id: string) => Promise<Character | null>" },
  { label: "updateCharacter", type: "function", detail: "(profile_id, id, updateData) => Promise<Character | null>" },
  { label: "deleteCharacter", type: "function", detail: "(id: string) => Promise<boolean>" },
  { label: "fetchCharacters", type: "function", detail: "(profile_id, filter?) => Promise<void>" },
  { label: "clearCharacters", type: "function", detail: "() => void" },
  { label: "loadCharacterAvatars", type: "function", detail: "() => Promise<void>" },
  { label: "refreshCharacterAvatars", type: "function", detail: "(characterId?) => Promise<void>" },
];

const LOREBOOK_COMPLETIONS: Completion[] = [
  { label: "loadLorebooks", type: "function", detail: "(profileId: string) => Promise<void>" },
  { label: "createLorebook", type: "function", detail: "(data: CreateLorebookParams) => Promise<Lorebook | null>" },
  { label: "updateLorebook", type: "function", detail: "(id, data) => Promise<Lorebook | null>" },
  { label: "deleteLorebook", type: "function", detail: "(id: string) => Promise<boolean>" },
  { label: "loadLorebookEntries", type: "function", detail: "(profileId, lorebookId) => Promise<void>" },
  { label: "createLorebookEntry", type: "function", detail: "(data) => Promise<LorebookEntry | null>" },
  { label: "updateLorebookEntry", type: "function", detail: "(id, data) => Promise<LorebookEntry | null>" },
  { label: "deleteLorebookEntry", type: "function", detail: "(profileId, id, lorebookId) => Promise<boolean>" },
];

const MODEL_COMPLETIONS: Completion[] = [
  { label: "createModel", type: "function", detail: "(modelData, isDuplicate?) => Promise<Model>" },
  { label: "getModelById", type: "function", detail: "(id: string) => Promise<Model | null>" },
  { label: "updateModel", type: "function", detail: "(id, updateData) => Promise<Model | null>" },
  { label: "deleteModel", type: "function", detail: "(id: string) => Promise<boolean>" },
  { label: "fetchModels", type: "function", detail: "(filter?) => Promise<void>" },
  { label: "getModelsByProfileGroupedByType", type: "function", detail: "(profileId: string) => Promise<Record<ModelType, Model[]>>" },
];

const STORES_NAMESPACE_COMPLETIONS: Completion[] = [
  { label: "chat", type: "namespace", detail: "Chat store actions" },
  { label: "characters", type: "namespace", detail: "Character store actions" },
  { label: "lorebook", type: "namespace", detail: "Lorebook store actions" },
  { label: "models", type: "namespace", detail: "Model store actions" },
];

const UTILS_COMPLETIONS: Completion[] = [
  { label: "delay", type: "function", detail: "(ms: number) => Promise<void>" },
  { label: "jsonParse", type: "function", detail: "(text: string) => unknown | null" },
  { label: "jsonStringify", type: "function", detail: "(value: unknown) => string" },
];

const TOP_LEVEL_COMPLETIONS: Completion[] = [
  { label: "input", type: "variable", detail: "Value from connected input nodes" },
  { label: "args", type: "variable", detail: "Alias for input" },
  { label: "stores", type: "namespace", detail: "Narratrix store actions (chat, characters, lorebook, models)" },
  { label: "utils", type: "namespace", detail: "Utility helpers (delay, jsonParse, jsonStringify)" },
];

function narratrixCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/\w*/);
  if (!word) {
    return null;
  }

  // Look at the text immediately before the current word to detect member access
  const textBefore = context.state.doc.sliceString(Math.max(0, word.from - 60), word.from);

  if (textBefore.endsWith("stores.chat.")) {
    return { from: word.from, options: CHAT_COMPLETIONS, validFor: /^\w*$/ };
  }
  if (textBefore.endsWith("stores.characters.")) {
    return { from: word.from, options: CHARACTER_COMPLETIONS, validFor: /^\w*$/ };
  }
  if (textBefore.endsWith("stores.lorebook.")) {
    return { from: word.from, options: LOREBOOK_COMPLETIONS, validFor: /^\w*$/ };
  }
  if (textBefore.endsWith("stores.models.")) {
    return { from: word.from, options: MODEL_COMPLETIONS, validFor: /^\w*$/ };
  }
  if (textBefore.endsWith("stores.")) {
    return { from: word.from, options: STORES_NAMESPACE_COMPLETIONS, validFor: /^\w*$/ };
  }
  if (textBefore.endsWith("utils.")) {
    return { from: word.from, options: UTILS_COMPLETIONS, validFor: /^\w*$/ };
  }

  // Offer top-level injected names when typing a plain identifier
  if (word.from === word.to && !context.explicit) {
    return null;
  }
  return { from: word.from, options: TOP_LEVEL_COMPLETIONS, validFor: /^\w*$/ };
}

// Registers our completion source alongside the built-in JS completions
const narratrixCompletionExtension = javascriptLanguage.data.of({ autocomplete: narratrixCompletionSource });

// Mirrors the AsyncFunction wrapper in javascript-runner.ts:
//   new AsyncFunction("input", "args", "stores", "utils", code)
// Wrapping before linting lets ESLint accept bare `return` and injected vars.
const WRAPPER_PREFIX = "async function __narratrix__(input, args, stores, utils) {\n";
const WRAPPER_SUFFIX = "\n}";
const WRAPPER_PREFIX_LINES = 1; // number of newlines in WRAPPER_PREFIX

const eslintLinter = new Linter();

const ESLINT_CONFIG = {
  languageOptions: { ecmaVersion: 2022, sourceType: "script" },
  rules: {
    "no-undef": "warn",
    "no-unused-vars": "warn",
    "no-constant-condition": "warn",
    "no-debugger": "warn",
    "no-dupe-args": "error",
    "no-dupe-keys": "error",
    "no-duplicate-case": "error",
    "no-empty": "warn",
    "no-extra-semi": "warn",
    "no-unreachable": "warn",
    "no-unsafe-negation": "error",
    "use-isnan": "error",
    "valid-typeof": "error",
    "no-redeclare": "warn",
    "no-self-assign": "warn",
    "no-sparse-arrays": "warn",
  },
} as const;

/**
 * Custom ESLint lint source that wraps user code in an async function matching
 * the runtime execution context, then maps diagnostic positions back to the
 * original editor document.
 */
function wrappedEsLintSource(view: EditorView): Diagnostic[] {
  const { state } = view;
  const userCode = state.doc.toString();
  const wrappedCode = WRAPPER_PREFIX + userCode + WRAPPER_SUFFIX;
  const messages = eslintLinter.verify(wrappedCode, ESLINT_CONFIG);

  const diagnostics: Diagnostic[] = [];
  const totalUserLines = state.doc.lines;

  for (const msg of messages) {
    // Translate wrapped-code line back to user-code line (1-indexed)
    const userLine = msg.line - WRAPPER_PREFIX_LINES;

    // Skip diagnostics that fall on the wrapper signature or closing brace
    if (userLine < 1 || userLine > totalUserLines) {
      continue;
    }

    const docLine = state.doc.line(userLine);
    const col = Math.max(0, (msg.column ?? 1) - 1);
    const from = Math.min(docLine.from + col, docLine.to);

    let to = from;
    if (msg.endLine != null) {
      const endUserLine = msg.endLine - WRAPPER_PREFIX_LINES;
      if (endUserLine >= 1 && endUserLine <= totalUserLines) {
        const endDocLine = state.doc.line(endUserLine);
        const endCol = Math.max(0, (msg.endColumn ?? 1) - 1);
        to = Math.min(endDocLine.from + endCol, endDocLine.to);
      }
    }

    const diagnostic: Diagnostic = {
      from,
      to: to > from ? to : from,
      severity: msg.severity === 1 ? "warning" : "error",
      message: msg.message,
      source: msg.ruleId ? `eslint:${msg.ruleId}` : "eslint",
    };

    // Carry over auto-fix actions, adjusting range offsets for the wrapper prefix
    if (msg.fix) {
      const { range, text } = msg.fix;
      const prefixLen = WRAPPER_PREFIX.length;
      const fixFrom = range[0] - prefixLen;
      const fixTo = range[1] - prefixLen;
      if (fixFrom >= 0 && fixTo <= userCode.length) {
        diagnostic.actions = [
          {
            name: "fix",
            apply(fixView: EditorView) {
              fixView.dispatch({ changes: { from: fixFrom, to: fixTo, insert: text }, scrollIntoView: true });
            },
          },
        ];
      }
    }

    diagnostics.push(diagnostic);
  }

  return diagnostics;
}

export interface JavascriptEditorRef {
  replaceContent: (code: string) => void;
}

interface JavascriptEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  minHeight?: string;
  maxHeight?: string;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

export const JavascriptEditor = forwardRef<JavascriptEditorRef, JavascriptEditorProps>(
  ({ value = "", onChange, minHeight = "200px", maxHeight = "500px", placeholder, className, readOnly = false }, ref) => {
    const editorRef = useRef<EditorView | null>(null);

    useImperativeHandle(ref, () => ({
      replaceContent: (code: string) => {
        const view = editorRef.current;
        if (!view) {
          return;
        }
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: code },
        });
      },
    }));

    const extensions = useMemo(
      () => [
        javascript({ jsx: false, typescript: false }),
        narratrixCompletionExtension,
        lineNumbers(),
        history(),
        bracketMatching(),
        indentOnInput(),
        autocompletion({ defaultKeymap: true, maxRenderedOptions: 10 }),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        EditorState.readOnly.of(readOnly),
        ...(readOnly ? [] : [linter(wrappedEsLintSource), lintGutter()]),
      ],
      [readOnly],
    );

    return (
      <CodeMirror
        value={value}
        editable={!readOnly}
        extensions={extensions}
        onChange={onChange}
        onCreateEditor={(editor) => {
          editorRef.current = editor;
        }}
        placeholder={placeholder}
        className={cn("text-xs ring-1 ring-border rounded-sm font-mono", className)}
        theme={narratrixCodeMirror}
        minHeight={minHeight}
        maxHeight={maxHeight}
      />
    );
  },
);

JavascriptEditor.displayName = "JavascriptEditor";

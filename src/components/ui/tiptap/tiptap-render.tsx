import { cn } from "@/lib/utils";
import { Extension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Markdown } from "tiptap-markdown";
import { BracketHighlight } from "./bracket-highlight";
import { BracketSuggestions } from "./bracket-suggestions";
import { clipboardTextParser } from "./hardbreak-extension";

// Sanitize markdown content to prevent invalid list items
const sanitizeMarkdown = (content: string): string => {
  if (!content) {
    return "";
  }

  // Replace list items with empty content (- ) with a valid placeholder (- ␣)
  return content
    .replace(/^(\s*[-*+]\s*)$/gm, "$1␣") // Replace empty list items at start of line
    .replace(/\n(\s*[-*+]\s*)(?=\n|$)/g, "\n$1␣") // Replace empty list items in the middle/end
    .replace(/^(\s*\d+\.\s*)$/gm, "$1␣") // Same for numbered lists
    .replace(/\n(\s*\d+\.\s*)(?=\n|$)/g, "\n$1␣");
};

export interface SuggestionItem {
  title: string;
  description?: string;
}

interface TipTapTextAreaProps {
  initialValue?: string;
  onChange?: (content: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  editable?: boolean;
  disableRichText?: boolean;
  suggestions?: SuggestionItem[];
  sendShortcut?: "Enter" | "Ctrl+Enter" | "Shift+Enter" | "CMD+Enter";
  onSubmit?: (text: string) => void;
}

export function TipTapRender({
  initialValue = "",
  onChange,
  className,
  placeholder,
  editable = false,
  disableRichText = false,
  suggestions = [],
  sendShortcut = "Ctrl+Enter",
  onSubmit,
}: TipTapTextAreaProps) {
  const isUpdatingRef = useRef(false);

  // Sanitize initialValue to prevent invalid list items
  const sanitizedInitialValue = useRef(sanitizeMarkdown(initialValue));

  // Create a keyboard shortcuts extension based on sendShortcut
  const KeyboardShortcutHandler = Extension.create({
    name: "keyboardShortcutHandler",
    addKeyboardShortcuts() {
      const shortcuts: Record<string, any> = {};

      if (sendShortcut === "Enter") {
        shortcuts.Enter = () => {
          // Check if suggestions are active
          const isSuggestionsActive = this.editor.extensionStorage.bracketSuggestions?.isActive;

          if (isSuggestionsActive) {
            // If suggestions are active, don't handle Enter here
            return false;
          }

          if (onSubmit) {
            const text = this.editor.getText({
              blockSeparator: "<br>",
            });
            if (text.trim()) {
              onSubmit(text);
              this.editor.commands.clearContent();
            }
          }
          return true;
        };

        // Use Shift+Enter for newline when Enter is the send shortcut
        shortcuts["Shift-Enter"] = () => {
          return this.editor.commands.first(({ commands }) => [
            () => commands.newlineInCode(),
            () => commands.splitListItem("listItem"),
            () => commands.createParagraphNear(),
            () => commands.liftEmptyBlock(),
            () => commands.splitBlock(),
          ]);
        };
      } else if (sendShortcut) {
        // For other shortcuts, handle them specifically
        const shortcutKey =
          sendShortcut === "Ctrl+Enter"
            ? "Mod-Enter"
            : sendShortcut === "CMD+Enter"
              ? "Mod-Enter"
              : sendShortcut === "Shift+Enter"
                ? "Shift-Enter"
                : null;

        if (shortcutKey && onSubmit) {
          shortcuts[shortcutKey] = () => {
            const text = this.editor.getText({
              blockSeparator: "<br>",
            });
            if (text.trim()) {
              onSubmit(text);
              this.editor.commands.clearContent();
            }
            return true;
          };
        }
      }

      if (!sendShortcut || sendShortcut !== "Enter") {
        shortcuts.Enter = () => {
          // Check if suggestions are active
          const isSuggestionsActive = this.editor.extensionStorage.bracketSuggestions?.isActive;

          if (isSuggestionsActive) {
            // If suggestions are active, don't handle Enter here
            return false;
          }

          return this.editor.commands.first(({ commands }) => [() => commands.setHardBreak()]);
        };
      }

      return shortcuts;
    },
  });

  const editor = useEditor({
    extensions: [
      ...(suggestions.length > 0 ? [BracketSuggestions({ suggestions })] : []),
      BracketHighlight,
      StarterKit.configure({
        ...(disableRichText && {
          blockquote: false,
          codeBlock: false,
          heading: false,
          code: false,
          bold: false,
          dropcursor: false,
          listItem: false,
          bulletList: false,
          orderedList: false,
          italic: false,
          strike: false,
          underline: false,
          superscript: false,
          subscript: false,
          link: false,
        }),
      }),
      Placeholder.configure({
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:float-left before:text-muted-foreground/50 before:italic before:h-0 before:pointer-events-none",
        placeholder,
      }),
      ...(!disableRichText
        ? [
            Markdown.configure({
              html: true,
              transformPastedText: false,
              transformCopiedText: true,
              bulletListMarker: "-",
              tightLists: false,
              breaks: true,
              linkify: false,
            }),
          ]
        : []),
      // Add keyboard shortcut handler if onSubmit is provided
      KeyboardShortcutHandler,
    ],
    parseOptions: {
      preserveWhitespace: "full",
    },
    content: sanitizedInitialValue.current,
    editable,
    onUpdate: ({ editor }) => {
      if (onChange && !isUpdatingRef.current) {
        if (disableRichText) {
          const text = editor.getText({});
          onChange(text);
        } else {
          onChange(editor.storage.markdown!.getMarkdown());
        }
      }
    },
    editorProps: {
      clipboardTextParser: clipboardTextParser,
      attributes: {
        class: cn(
          "prose dark:prose-invert prose-li:p-0 prose-p:m-0",
          "prose-h1:text-lg prose-h1:m-0 prose-h2:text-base prose-h2:m-0 prose-h3:text-sm prose-headings:m-0",
          "font-base prose:text-sm",
          "outline-none",
          "h-full w-full overflow-auto",
          className,
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && editor.getText() !== initialValue) {
      isUpdatingRef.current = true;
      const sanitized = sanitizeMarkdown(initialValue);
      sanitizedInitialValue.current = sanitized;
      try {
        editor.commands.setContent(sanitized, false, { preserveWhitespace: "full" });
      } catch (error) {
        console.warn("Error setting content:", error);
        // Fallback to plain text if markdown parsing fails
        editor.commands.setContent(initialValue.replace(/[-*+]/g, "\\$&"), false);
      }
      // Reset the flag after the update
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  }, [editor, initialValue, editable]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable, disableRichText]);

  return (
    <div className="h-full w-full overflow-hidden">
      {editor && (
        <BubbleMenu className="bubble-menu" tippyOptions={{ duration: 100 }} editor={editor}>
          <button
            onClick={() => {
              if (disableRichText) {
                const selection = editor.state.selection;
                const content = selection.empty ? "" : editor.state.doc.textBetween(selection.from, selection.to, " ");

                if (selection.empty) {
                  editor.chain().focus().insertContent("****").run();
                  editor.commands.setTextSelection({
                    from: selection.from + 2,
                    to: selection.from + 2,
                  });
                } else {
                  editor.chain().focus().insertContent(`**${content}**`).run();
                }
              } else {
                editor.chain().focus().toggleBold().run();
              }
            }}
            className={editor.isActive("bold") ? "is-active" : ""}
            title="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            onClick={() => {
              if (disableRichText) {
                const selection = editor.state.selection;
                const content = selection.empty ? "" : editor.state.doc.textBetween(selection.from, selection.to, " ");

                if (selection.empty) {
                  editor.chain().focus().insertContent("**").run();
                  editor.commands.setTextSelection({
                    from: selection.from + 1,
                    to: selection.from + 1,
                  });
                } else {
                  editor.chain().focus().insertContent(`*${content}*`).run();
                }
              } else {
                editor.chain().focus().toggleItalic().run();
              }
            }}
            className={editor.isActive("italic") ? "is-active" : ""}
            title="Italic"
          >
            <Italic size={14} />
          </button>
          <button
            onClick={() => {
              if (disableRichText) {
                const selection = editor.state.selection;

                if (!selection.empty) {
                  // Delete the selected text
                  editor.chain().focus().deleteSelection().run();
                }
              } else {
                // In rich text mode, we'll also just delete the selection instead of toggle strike
                editor.chain().focus().deleteSelection().run();
              }
            }}
            className={editor.isActive("strike") ? "is-active" : ""}
            title="Remove selected text"
          >
            <Trash2 size={14} />
          </button>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} spellCheck={false} className="h-full" />
    </div>
  );
}

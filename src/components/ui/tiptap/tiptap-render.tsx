import { cn } from "@/lib/utils";
import { Extension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { Markdown } from "tiptap-markdown";
import { BracketHighlight } from "./bracket-highlight";
import { BracketSuggestions } from "./bracket-suggestions";

interface SuggestionItem {
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

  // Create a keyboard shortcuts extension based on sendShortcut
  const KeyboardShortcutHandler = Extension.create({
    name: "keyboardShortcutHandler",
    addKeyboardShortcuts() {
      const shortcuts: Record<string, any> = {};

      // Default shortcuts for different send commands
      if (sendShortcut === "Enter") {
        shortcuts.Enter = () => {
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
      } else {
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
              transformPastedText: true,
              transformCopiedText: true,
              bulletListMarker: "-",
              tightLists: true,
            }),
          ]
        : []),
      // Add keyboard shortcut handler if onSubmit is provided
      ...(onSubmit ? [KeyboardShortcutHandler] : []),
    ],
    content: initialValue?.replace(/\n/g, "<br>"),
    editable,
    onUpdate: ({ editor }) => {
      if (onChange && !isUpdatingRef.current) {
        const text = editor.getText({
          blockSeparator: "<br>",
        });
        // onChange(editor.storage.markdown?.getMarkdown() || text);
        onChange(text);
      }
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose dark:prose-invert prose-li:p-0 prose-p:m-0",
          "prose-h1:text-lg prose-h1:m-0 prose-h2:text-base prose-h2:m-0 prose-h3:text-sm prose-headings:m-0",
          "font-mono",
          "outline-none",
          "h-full w-full overflow-auto",
          className,
        ),
      },
    },
  });

  useEffect(() => {
    if (!editable && editor && editor.getText() !== initialValue) {
      isUpdatingRef.current = true;
      editor.commands.setContent(initialValue);
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
  }, [editor, editable]);

  return (
    <div className="h-full w-full overflow-hidden">
      <EditorContent editor={editor} spellCheck={false} className="h-full" />
    </div>
  );
}

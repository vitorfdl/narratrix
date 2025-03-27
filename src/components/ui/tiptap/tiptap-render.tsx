import { cn } from "@/lib/utils";
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
}

export function TipTapRender({
  initialValue = "",
  onChange,
  className,
  placeholder,
  editable = false,
  disableRichText = false,
  suggestions = [],
}: TipTapTextAreaProps) {
  const isUpdatingRef = useRef(false);

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
    ],
    content: initialValue?.replace(/\n/g, "<br>"),
    editable,
    onUpdate: ({ editor }) => {
      if (onChange && !isUpdatingRef.current) {
        const text = editor.getText({
          blockSeparator: "\n",
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
          "text-xs font-mono",
          "outline-none",
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

  return <EditorContent editor={editor} spellCheck={false} />;
}

import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Instance as TippyInstance } from "tippy.js";
import tippy from "tippy.js";
import "tippy.js/animations/shift-away.css";

// Define interface for the suggestion item
interface SuggestionItem {
  title: string;
  description?: string;
}

interface SuggestionListRef {
  onKeyDown?: (props: { event: KeyboardEvent }) => boolean;
}

// Component to render suggestion dropdown with keyboard navigation
const SuggestionList = forwardRef<
  SuggestionListRef,
  {
    items: SuggestionItem[];
    command: (item: SuggestionItem) => void;
  }
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { items, command } = props;
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset refs array when items change
  useEffect(() => {
    itemsRef.current = itemsRef.current.slice(0, items.length);
  }, [items]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Scroll selected item into view when selection changes
  useEffect(() => {
    if (selectedIndex >= 0 && itemsRef.current[selectedIndex]) {
      itemsRef.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [selectedIndex]);

  // Create ref callback for list items
  const setItemRef = useCallback((element: HTMLDivElement | null, index: number) => {
    itemsRef.current[index] = element;
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((selectedIndex + items.length - 1) % items.length);
        return true;
      }

      if (event.key === "ArrowDown") {
        setSelectedIndex((selectedIndex + 1) % items.length);
        return true;
      }

      if (event.key === "Enter") {
        if (items[selectedIndex]) {
          command(items[selectedIndex]);
          return true;
        }
      }

      return false;
    },
  }));

  return (
    <div
      ref={containerRef}
      className="bg-popover rounded-b-md shadow-md border border-border max-h-[200px] overflow-y-auto custom-scrollbar"
      style={{
        minWidth: "200px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      }}
    >
      {items.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground text-center">No suggestions available</div>}
      {items.map((item, index) => (
        <div
          ref={(el) => setItemRef(el, index)}
          key={index}
          className={`px-2 py-0.5 text-xs cursor-pointer transition-colors flex flex-col ${
            index === selectedIndex ? "bg-background bg-opacity-20 text-primary border-l-2 border-primary" : "hover:bg-accent"
          }`}
          onClick={() => command(item)}
        >
          <span className={`font-medium ${index === selectedIndex ? "text-primary" : "text-foreground"}`}>{item.title}</span>
          {item.description && <span className="text-[0.5rem] text-muted-foreground mt-0">{item.description}</span>}
        </div>
      ))}
    </div>
  );
});

SuggestionList.displayName = "SuggestionList";

export const BracketSuggestions = (props: {
  suggestions: SuggestionItem[];
}) =>
  Extension.create({
    name: "bracketSuggestions",

    addProseMirrorPlugins() {
      const editor = this.editor;

      return [
        Suggestion({
          editor,
          char: "{{",
          command: ({ editor, range, props }) => {
            // Delete the trigger text
            editor
              .chain()
              .focus()
              .deleteRange({
                from: range.from, // Remove the "{{" trigger
                to: range.to,
              })
              .insertContent(`{{${props.title}}}`)
              .run();
          },
          items: ({ query }) => {
            // Filter suggestions based on query
            return props.suggestions.filter((item) => item.title.toLowerCase().includes(query.toLowerCase())).slice(0, 10); // Limit to 10 items
          },
          render: () => {
            let popup: TippyInstance | undefined;
            let component: ReactRenderer | undefined;
            let element: HTMLElement | undefined;

            return {
              onStart: (props) => {
                element = document.createElement("div");
                element.style.display = "contents";
                document.body.appendChild(element);

                component = new ReactRenderer(SuggestionList, {
                  props,
                  editor,
                });

                if (element) {
                  popup = tippy(document.body, {
                    getReferenceClientRect: () => props.clientRect?.() as DOMRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: "manual",
                    placement: "bottom-start",
                    arrow: false,
                    theme: "light",
                    animation: "shift-away",
                    duration: [200, 150],
                    offset: [0, 10],
                    maxWidth: 500,
                  });
                }
              },
              onUpdate(props) {
                if (component) {
                  component.updateProps(props);
                }

                if (popup && props.clientRect) {
                  popup.setProps({
                    getReferenceClientRect: () => props.clientRect?.() as DOMRect,
                  });
                }
              },
              onKeyDown(props) {
                if (props.event.key === "Escape") {
                  popup?.hide();
                  return true;
                }

                // Cast ref to any to bypass TypeScript's strict checking
                const ref = component?.ref as any;
                return ref?.onKeyDown?.(props) || false;
              },
              onExit() {
                if (popup) {
                  popup.destroy();
                  popup = undefined;
                }

                if (component) {
                  component.destroy();
                  component = undefined;
                }

                if (element?.parentElement) {
                  element.parentElement.removeChild(element);
                  element = undefined;
                }
              },
            };
          },
        }),
      ];
    },
  });

import type { Element, Root, Text } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

// Helper function to create a styled span
const createStyledSpan = (className: string, children: (Element | Text)[]): Element => ({
  type: "element",
  tagName: "span",
  properties: { className: [className] },
  children,
});

// Helper function to recursively process phrasing content for highlighting
const processPhrasingContent = (
  nodes: (Element | Text)[],
  inSpan: Element | null = null,
  inSpanType: "quote" | "brace" | null = null,
): (Element | Text)[] => {
  const newChildren: (Element | Text)[] = [];
  let currentSpan = inSpan;
  let currentSpanType = inSpanType;

  for (const child of nodes) {
    if (child.type === "text") {
      const textValue = child.value;
      let currentPos = 0;
      while (currentPos < textValue.length) {
        if (currentSpanType === null) {
          const nextQuote = textValue.indexOf('"', currentPos);
          const nextBraceOpen = textValue.indexOf("{{", currentPos);

          let firstDelimiterPos = -1;
          let delimiterType: "quote" | "brace" | null = null;

          if (nextQuote !== -1) {
            firstDelimiterPos = nextQuote;
            delimiterType = "quote";
          }
          if (nextBraceOpen !== -1 && (firstDelimiterPos === -1 || nextBraceOpen < firstDelimiterPos)) {
            firstDelimiterPos = nextBraceOpen;
            delimiterType = "brace";
          }

          if (delimiterType) {
            const openingDelimiter = delimiterType === "quote" ? '"' : "{{";
            const delimiterLength = delimiterType === "quote" ? 1 : 2;
            if (firstDelimiterPos > currentPos) {
              newChildren.push({ type: "text", value: textValue.slice(currentPos, firstDelimiterPos) });
            }
            const className = delimiterType === "quote" ? "markdown-quoted-text" : "markdown-special-text";
            currentSpan = createStyledSpan(className, [{ type: "text", value: openingDelimiter }]);
            newChildren.push(currentSpan);
            currentSpanType = delimiterType;
            currentPos = firstDelimiterPos + delimiterLength;
          } else {
            if (currentPos < textValue.length) {
              if (currentSpan) {
                currentSpan.children.push({ type: "text", value: textValue.slice(currentPos) });
              } else {
                newChildren.push({ type: "text", value: textValue.slice(currentPos) });
              }
            }
            break;
          }
        } else {
          const closingDelimiter = currentSpanType === "quote" ? '"' : "}}";
          const closingDelimiterLength = closingDelimiter.length;
          const nextClosing = textValue.indexOf(closingDelimiter, currentPos);

          if (nextClosing !== -1) {
            if (nextClosing > currentPos) {
              currentSpan!.children.push({ type: "text", value: textValue.slice(currentPos, nextClosing) });
            }
            currentSpan!.children.push({ type: "text", value: closingDelimiter });
            currentSpan = null;
            currentSpanType = null;
            currentPos = nextClosing + closingDelimiterLength;
          } else {
            if (currentPos < textValue.length) {
              currentSpan!.children.push({ type: "text", value: textValue.slice(currentPos) });
            }
            break;
          }
        }
      }
    } else if (child.type === "element") {
      // Recursively process children of inline elements
      const processedChildren = processPhrasingContent(child.children as (Element | Text)[], currentSpan, currentSpanType);
      const newElement: Element = {
        ...child,
        children: processedChildren,
      };
      if (currentSpan) {
        currentSpan.children.push(newElement);
      } else {
        newChildren.push(newElement);
      }
    }
    // Ignore other node types for now (Comment, Doctype, Raw, etc.)
  }
  return newChildren;
};

/**
 * Rehype plugin to highlight quoted phrases ("...") and special phrases ({{...}})
 * in markdown, correctly handling phrases that contain inline elements.
 */
const rehypeHighlightQuotes: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "element", (node: Element) => {
      if (!["p", "li", "div", "blockquote", "td", "th"].includes(node.tagName)) {
        return;
      }
      node.children = processPhrasingContent(node.children as (Element | Text)[]);
    });
  };
};

export default rehypeHighlightQuotes;

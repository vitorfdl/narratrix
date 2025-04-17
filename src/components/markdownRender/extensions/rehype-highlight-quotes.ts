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

/**
 * Rehype plugin to highlight quoted phrases ("...") and special phrases ({{...}})
 * in markdown, correctly handling phrases that contain inline elements.
 */
const rehypeHighlightQuotes: Plugin<[], Root> = () => {
  return (tree) => {
    // Visit elements that can contain phrasing content where highlighting is desired.
    visit(tree, "element", (node: Element) => {
      // Extend this list if highlighting is needed in other container elements.
      if (!["p", "li", "div", "blockquote", "td", "th"].includes(node.tagName)) {
        return;
      }

      const newChildren: (Element | Text)[] = [];
      let currentSpan: Element | null = null;
      // Tracks whether we are inside "..." ('quote') or {{...}} ('brace')
      let currentSpanType: "quote" | "brace" | null = null;

      for (const child of node.children) {
        // Only process text and element nodes for highlighting purposes
        if (child.type === "text") {
          const textValue = child.value;
          let currentPos = 0; // Position within the current text node's value

          while (currentPos < textValue.length) {
            if (currentSpanType === null) {
              // ===== Outside any highlighted span =====
              // Find the next opening delimiter (" or {{)
              const nextQuote = textValue.indexOf('"', currentPos);
              const nextBraceOpen = textValue.indexOf("{{", currentPos);

              let firstDelimiterPos = -1;
              let delimiterType: "quote" | "brace" | null = null;

              // Determine which delimiter comes first
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
                // Add the text preceding the delimiter
                if (firstDelimiterPos > currentPos) {
                  newChildren.push({ type: "text", value: textValue.slice(currentPos, firstDelimiterPos) });
                }
                // Start the new span
                const className = delimiterType === "quote" ? "markdown-quoted-text" : "markdown-special-text";
                currentSpan = createStyledSpan(className, [{ type: "text", value: openingDelimiter }]);
                newChildren.push(currentSpan); // Add the span to the parent's children
                currentSpanType = delimiterType;
                currentPos = firstDelimiterPos + delimiterLength; // Move position past the opening delimiter
              } else {
                // No more delimiters in this text node, add the remainder
                if (currentPos < textValue.length) {
                  newChildren.push({ type: "text", value: textValue.slice(currentPos) });
                }
                break; // Exit the while loop for this text node
              }
            } else {
              // ===== Inside a highlighted span (currentSpan is not null) =====
              const closingDelimiter = currentSpanType === "quote" ? '"' : "}}";
              const closingDelimiterLength = closingDelimiter.length;
              const nextClosing = textValue.indexOf(closingDelimiter, currentPos);

              if (nextClosing !== -1) {
                // Add text before the closing delimiter (inside the current span)
                if (nextClosing > currentPos) {
                  currentSpan!.children.push({ type: "text", value: textValue.slice(currentPos, nextClosing) });
                }
                // Add the closing delimiter text node
                currentSpan!.children.push({ type: "text", value: closingDelimiter });
                // Close the current span
                currentSpan = null;
                currentSpanType = null;
                currentPos = nextClosing + closingDelimiterLength; // Move position past the closing delimiter
              } else {
                // No closing delimiter found in this text node, add the rest to the current span
                if (currentPos < textValue.length) {
                  currentSpan!.children.push({ type: "text", value: textValue.slice(currentPos) });
                }
                break; // Exit the while loop for this text node
              }
            }
          } // End while loop through text node value
        } else if (child.type === "element") {
          if (currentSpan) {
            // If we are inside a quote or brace span, move this element into the span
            currentSpan.children.push(child);
          } else {
            // Otherwise, add it directly to the new list of children
            newChildren.push(child);
          }
        } else {
          // Handle other node types (Comment, Doctype, Raw, etc.)
          // If inside a span, we might need to decide if they should be included.
          // For now, we'll add them outside any highlight span.
          if (!currentSpan) {
            // Ensure we are only pushing compatible types if necessary, though newChildren can hold various types.
            // For simplicity, let's only add text and element nodes back.
            // If comments etc. need preserving, adjust this part.
          }
        }
      } // End loop through node.children

      // Replace the original children with the potentially modified list
      node.children = newChildren;
    });
  };
};

export default rehypeHighlightQuotes;

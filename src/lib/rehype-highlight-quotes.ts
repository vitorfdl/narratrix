import type { Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

interface MatchResult {
  text: string;
  index: number;
  length: number;
  className: string;
}

/**
 * Rehype plugin to highlight quoted phrases and curly braced text in markdown
 */
const rehypeHighlightQuotes: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      if (!parent || index === null || typeof node.value !== "string") {
        return;
      }

      const text = node.value;
      const matches: MatchResult[] = [];

      // Find all quoted phrases
      const quoteRegex = /"([^"]+)"/g;
      let quoteMatch: RegExpExecArray | null;

      // Process quoted text matches
      quoteMatch = quoteRegex.exec(text);
      while (quoteMatch !== null) {
        matches.push({
          text: quoteMatch[0],
          index: quoteMatch.index,
          length: quoteMatch[0].length,
          className: "markdown-quoted-text",
        });
        quoteMatch = quoteRegex.exec(text);
      }

      // Find all curly braced phrases
      const bracketRegex = /\{\{([^{}]+)\}\}/g;
      let bracketMatch: RegExpExecArray | null;

      // Process curly brace matches
      bracketMatch = bracketRegex.exec(text);
      while (bracketMatch !== null) {
        matches.push({
          text: bracketMatch[0],
          index: bracketMatch.index,
          length: bracketMatch[0].length,
          className: "markdown-special-text",
        });
        bracketMatch = bracketRegex.exec(text);
      }

      // Sort matches by index to process them in order
      matches.sort((a, b) => a.index - b.index);

      if (matches.length === 0) {
        return;
      }

      // Create new nodes
      const parts: any[] = [];
      let lastIndex = 0;

      for (const match of matches) {
        // Add text before the match
        if (match.index > lastIndex) {
          parts.push({
            type: "text",
            value: text.slice(lastIndex, match.index),
          });
        }

        // Add the matched text with a span wrapper
        parts.push({
          type: "element",
          tagName: "span",
          properties: {
            className: [match.className],
          },
          children: [
            {
              type: "text",
              value: match.text,
            },
          ],
        });

        lastIndex = match.index + match.length;
      }

      // Add any remaining text
      if (lastIndex < text.length) {
        parts.push({
          type: "text",
          value: text.slice(lastIndex),
        });
      }

      // Replace the original node with our new parts
      if (typeof index === "number") {
        parent.children.splice(index, 1, ...parts);
      }
    });
  };
};

export default rehypeHighlightQuotes;

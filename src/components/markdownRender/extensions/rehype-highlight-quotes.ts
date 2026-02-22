import type { Element, Root, Text } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export type DelimiterType = "quote-double" | "quote-left" | "brace" | "dash-em" | "dash-en";

export interface RehypeHighlightQuotesOptions {
  enabledTypes?: DelimiterType[];
}

interface DelimiterConfig {
  type: DelimiterType;
  opening: string;
  closing: string;
  className: string;
}

const DELIMITER_CONFIGS: DelimiterConfig[] = [
  { type: "quote-double", opening: '"', closing: '"', className: "markdown-quoted-text" },
  { type: "quote-left", opening: "\u201C", closing: "\u201D", className: "markdown-quoted-text" },
  { type: "brace", opening: "{{", closing: "}}", className: "markdown-special-text" },
  { type: "dash-em", opening: "\u2014", closing: "\u2014", className: "markdown-quoted-text" },
];

const createStyledSpan = (className: string, children: (Element | Text)[]): Element => ({
  type: "element",
  tagName: "span",
  properties: { className: [className] },
  children,
});

const findNextDelimiter = (configs: DelimiterConfig[], text: string, startPos: number): { pos: number; config: DelimiterConfig } | null => {
  let closestPos = -1;
  let closestConfig: DelimiterConfig | null = null;

  for (const config of configs) {
    const pos = text.indexOf(config.opening, startPos);
    if (pos !== -1 && (closestPos === -1 || pos < closestPos)) {
      closestPos = pos;
      closestConfig = config;
    }
  }

  return closestConfig ? { pos: closestPos, config: closestConfig } : null;
};

const addTextToNode = (target: (Element | Text)[] | Element, text: string): void => {
  const textNode: Text = { type: "text", value: text };
  if (Array.isArray(target)) {
    target.push(textNode);
  } else {
    target.children.push(textNode);
  }
};

const processTextOutsideSpan = (
  configs: DelimiterConfig[],
  text: string,
  startPos: number,
  newChildren: (Element | Text)[],
): { newPos: number; span: Element | null; spanType: DelimiterType | null } => {
  const delimiter = findNextDelimiter(configs, text, startPos);

  if (!delimiter) {
    if (startPos < text.length) {
      addTextToNode(newChildren, text.slice(startPos));
    }
    return { newPos: text.length, span: null, spanType: null };
  }

  if (delimiter.pos > startPos) {
    addTextToNode(newChildren, text.slice(startPos, delimiter.pos));
  }

  const span = createStyledSpan(delimiter.config.className, [{ type: "text", value: delimiter.config.opening }]);
  newChildren.push(span);

  return {
    newPos: delimiter.pos + delimiter.config.opening.length,
    span,
    spanType: delimiter.config.type,
  };
};

const processTextInsideSpan = (configs: DelimiterConfig[], text: string, startPos: number, span: Element, spanType: DelimiterType): { newPos: number; spanClosed: boolean } => {
  const config = configs.find((c) => c.type === spanType)!;
  const closingPos = text.indexOf(config.closing, startPos);

  if (closingPos === -1) {
    if (startPos < text.length) {
      addTextToNode(span, text.slice(startPos));
    }
    return { newPos: text.length, spanClosed: false };
  }

  if (closingPos > startPos) {
    addTextToNode(span, text.slice(startPos, closingPos));
  }
  addTextToNode(span, config.closing);

  return {
    newPos: closingPos + config.closing.length,
    spanClosed: true,
  };
};

const processTextNode = (
  configs: DelimiterConfig[],
  textValue: string,
  currentSpan: Element | null,
  currentSpanType: DelimiterType | null,
  newChildren: (Element | Text)[],
): { span: Element | null; spanType: DelimiterType | null } => {
  let currentPos = 0;
  let span = currentSpan;
  let spanType = currentSpanType;

  while (currentPos < textValue.length) {
    if (spanType === null) {
      const result = processTextOutsideSpan(configs, textValue, currentPos, newChildren);
      currentPos = result.newPos;
      span = result.span;
      spanType = result.spanType;
    } else {
      const result = processTextInsideSpan(configs, textValue, currentPos, span!, spanType);
      currentPos = result.newPos;
      if (result.spanClosed) {
        span = null;
        spanType = null;
      }
    }
  }

  return { span, spanType };
};

const processPhrasingContent = (configs: DelimiterConfig[], nodes: (Element | Text)[], inSpan: Element | null = null, inSpanType: DelimiterType | null = null): (Element | Text)[] => {
  const newChildren: (Element | Text)[] = [];
  let currentSpan = inSpan;
  let currentSpanType = inSpanType;

  for (const child of nodes) {
    if (child.type === "text") {
      const result = processTextNode(configs, child.value, currentSpan, currentSpanType, newChildren);
      currentSpan = result.span;
      currentSpanType = result.spanType;
    } else if (child.type === "element") {
      const processedChildren = processPhrasingContent(configs, child.children as (Element | Text)[], currentSpan, currentSpanType);
      const newElement: Element = { ...child, children: processedChildren };

      if (currentSpan) {
        currentSpan.children.push(newElement);
      } else {
        newChildren.push(newElement);
      }
    }
  }

  return newChildren;
};

/**
 * Rehype plugin to highlight quoted phrases ("...") and special phrases ({{...}})
 * in markdown, correctly handling phrases that contain inline elements.
 * Accepts optional `enabledTypes` to filter which delimiter types are processed.
 */
const rehypeHighlightQuotes: Plugin<[RehypeHighlightQuotesOptions?], Root> = (options) => {
  const activeConfigs = options?.enabledTypes ? DELIMITER_CONFIGS.filter((c) => options.enabledTypes!.includes(c.type)) : DELIMITER_CONFIGS;

  return (tree) => {
    if (activeConfigs.length === 0) {
      return;
    }

    visit(tree, "element", (node: Element) => {
      if (!["p", "li", "div", "blockquote", "td", "th"].includes(node.tagName)) {
        return;
      }
      node.children = processPhrasingContent(activeConfigs, node.children as (Element | Text)[]);
    });
  };
};

export default rehypeHighlightQuotes;

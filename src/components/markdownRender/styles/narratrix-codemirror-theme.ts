import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

// Using https://github.com/one-dark/vscode-one-dark-theme/ as reference for the colors

const chalky = "#e5c07b";
const coral = "#e06c75";
const cyan = "#56b6c2";
const invalid = "#ffffff";
const ivory = "#f8fafd";
const stone = "#7d8799"; // Brightened compared to original to increase contrast
const malibu = "#61afef";
const sage = "#98c379";
const whiskey = "#d19a66";
const violet = "#c678dd";
const darkBackground = "#21252b";
const highlightBackground = "#2c313a";
const background = "hsl(var(--background))";
const tooltipBackground = "#353a42";
const selection = "#3E4451";
const cursor = "hsl(var(--primary))";

/// The colors used in the theme, as CSS color strings.
export const color = {
  chalky,
  coral,
  cyan,
  invalid,
  ivory,
  stone,
  malibu,
  sage,
  whiskey,
  violet,
  darkBackground,
  highlightBackground,
  background,
  tooltipBackground,
  selection,
  cursor,
};

export const narratrixTheme = EditorView.theme(
  {
    "&": {
      color: "hsl(var(--foreground))",
      backgroundColor: "hsl(var(--accent) / 0.8)",
      fontFamily: "var(--font-mono)",
      borderBottom: "2px solid hsl(var(--border) / 0.5)",
      transition: "background-color 0.2s, border-color 0.2s",
    },
    "&.cm-focused": {
      backgroundColor: "hsl(var(--background))",
      borderBottom: "2px solid hsl(var(--primary))",
    },
    ".cm-content": {
      caretColor: "hsl(var(--primary))",
    },
    ".cm-placeholder": {
      color: "hsl(var(--muted-foreground) / 0.4)",
      fontStyle: "italic",
      opacity: "1",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "hsl(var(--primary))" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "hsl(var(--primary) / 0.15)",
    },

    ".cm-panels": { backgroundColor: "hsl(var(--card))", color: "hsl(var(--card-foreground))" },
    ".cm-panels.cm-panels-top": { borderBottom: "2px solid hsl(var(--border))" },
    ".cm-panels.cm-panels-bottom": { borderTop: "2px solid hsl(var(--border))" },

    ".cm-searchMatch": {
      backgroundColor: "hsl(var(--primary) / 0.35)",
      outline: "1px solid hsl(var(--primary))",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "hsl(var(--primary) / 0.18)",
    },

    ".cm-activeLine": {
      backgroundColor: "hsl(var(--transparent))",
    },
    "&.cm-focused .cm-activeLine": {
      backgroundColor: "hsl(var(--primary) / 0.01)",
    },
    ".cm-selectionMatch": { backgroundColor: "hsl(var(--chart-4) / 0.10)" },

    "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: "hsl(var(--muted) / 0.28)",
    },

    ".cm-gutters": {
      backgroundColor: "hsl(var(--muted))",
      color: "hsl(var(--muted-foreground))",
      border: "none",
    },

    ".cm-activeLineGutter": {
      backgroundColor: "hsl(var(--muted) / 0.5)",
    },

    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: "none",
      color: "hsl(var(--muted-foreground))",
    },

    ".cm-tooltip": {
      border: "none",
      backgroundColor: "hsl(var(--popover))",
      color: "hsl(var(--popover-foreground))",
    },
    ".cm-tooltip .cm-tooltip-arrow:before": {
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
    },
    ".cm-tooltip .cm-tooltip-arrow:after": {
      borderTopColor: "hsl(var(--popover))",
      borderBottomColor: "hsl(var(--popover))",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: "hsl(var(--muted) / 0.25)",
        color: "hsl(var(--primary))",
      },
    },
  },
  { dark: true },
);

/// The highlighting style for code in the One Dark theme.
export const oneDarkHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: violet },
  { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: coral },
  { tag: [t.function(t.variableName), t.labelName], color: malibu },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: whiskey },
  { tag: [t.definition(t.name), t.separator], color: ivory },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: chalky },
  { tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)], color: cyan },
  { tag: [t.meta, t.comment], color: stone },
  { tag: t.strong, fontWeight: "bold" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: stone, textDecoration: "underline" },
  { tag: t.heading, fontWeight: "bold", color: coral },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: whiskey },
  { tag: [t.processingInstruction, t.string, t.inserted], color: malibu },
  { tag: t.invalid, color: invalid },
]);

/// Extension to enable the One Dark theme (both the editor theme and
/// the highlight style).
export const narratrixCodeMirror: Extension = [narratrixTheme, syntaxHighlighting(oneDarkHighlightStyle)];

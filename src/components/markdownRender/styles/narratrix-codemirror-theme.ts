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
const background = "var(--background)";
const tooltipBackground = "#353a42";
const selection = "#3E4451";
const cursor = "var(--primary)";
const withAlpha = (color: string, alpha: number) => `color-mix(in oklab, ${color} ${alpha}%, transparent)`;

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
      width: "100%",
      maxWidth: "100%",
      color: "var(--foreground)",
      backgroundColor: withAlpha("var(--accent)", 80),
      fontFamily: "var(--font-mono)",
      borderBottom: `2px solid ${withAlpha("var(--border)", 50)}`,
      transition: "background-color 0.2s, border-color 0.2s",
    },
    ".cm-scroller": {
      width: "100%",
    },
    "&.cm-focused": {
      backgroundColor: "var(--background)",
      borderBottom: "2px solid var(--primary)",
    },
    ".cm-content": {
      caretColor: "var(--primary)",
    },
    ".cm-placeholder": {
      color: withAlpha("var(--muted-foreground)", 40),
      fontStyle: "italic",
      opacity: "1",
    },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--primary)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: withAlpha("var(--primary)", 15),
    },

    ".cm-panels": { backgroundColor: "var(--card)", color: "var(--card-foreground)" },
    ".cm-panels.cm-panels-top": { borderBottom: "2px solid var(--border)" },
    ".cm-panels.cm-panels-bottom": { borderTop: "2px solid var(--border)" },

    ".cm-searchMatch": {
      backgroundColor: withAlpha("var(--primary)", 35),
      outline: "1px solid var(--primary)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: withAlpha("var(--primary)", 18),
    },

    ".cm-activeLine": {
      backgroundColor: "transparent",
    },
    "&.cm-focused .cm-activeLine": {
      backgroundColor: withAlpha("var(--primary)", 1),
    },
    ".cm-selectionMatch": { backgroundColor: withAlpha("var(--chart-4)", 10) },

    "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: withAlpha("var(--muted)", 28),
    },

    ".cm-gutters": {
      backgroundColor: "var(--accent)",
      color: withAlpha("var(--primary)", 80),
      border: "none",
    },

    ".cm-activeLineGutter": {
      backgroundColor: withAlpha("var(--muted)", 50),
    },

    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: "none",
      color: "var(--muted-foreground)",
    },

    ".cm-tooltip": {
      border: "none",
      backgroundColor: "var(--popover)",
      color: "var(--popover-foreground)",
    },
    ".cm-tooltip .cm-tooltip-arrow:before": {
      borderTopColor: "transparent",
      borderBottomColor: "transparent",
    },
    ".cm-tooltip .cm-tooltip-arrow:after": {
      borderTopColor: "var(--popover)",
      borderBottomColor: "var(--popover)",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: withAlpha("var(--muted)", 25),
        color: "var(--primary)",
      },
    },
    ".cm-panel.cm-search": {
      position: "fixed",
      top: "1rem",
      right: "1rem",
      zIndex: "100",
      background: "var(--card)",
      width: "320px",
      maxWidth: "40vw",
      borderRadius: "var(--radius)",
      boxShadow: "var(--shadow-md)",
      border: "1px solid var(--border)",
      maxHeight: "50vh",
      overflowY: "auto",
      padding: "0.5rem",
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

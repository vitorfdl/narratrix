import type { CSSProperties } from "react";
import type { SheetSectionStyle, SheetStyleBase } from "@/schema/template-character-sheet-schema";

// Quiet dashed add-buttons shared by the editor and the fill-mode renderer
export const SHEET_ADD_BUTTON = "h-6 w-full border border-dashed border-foreground/20 text-[11px] text-muted-foreground hover:border-foreground/40 hover:bg-foreground/5 hover:text-foreground";

/**
 * Every recipe derives its colors from two CSS variables set on the section
 * frame — `--sheet-accent` and `--sheet-bg` — so a single accent override
 * recolors the frame, title, field labels, control surfaces and tables
 * together. Backgrounds default to an accent-tinted mix over the theme card,
 * which keeps them readable in both light and dark themes.
 */
export interface SheetStyleRecipe {
  /** Default accent when the section has no override (any CSS color) */
  accent: string;
  /** Default frame background when the section has no override (any CSS color) */
  background: string;
  /** Hex shown in the color picker while no accent override is set */
  pickerAccent: string;
  frame: string;
  title: string;
  fieldLabel: string;
  /** Inputs, selects, steppers and other editable controls */
  surface: string;
  tableWrapper: string;
  tableHeader: string;
  tableRow: string;
  corner: string | null;
}

// Accent-derived building blocks
const ACCENT_TEXT = "text-[var(--sheet-accent)]";
const LABEL_TINT = "text-[color:color-mix(in_srgb,var(--sheet-accent)_55%,var(--muted-foreground))]";
const HEADER_BG = "bg-[color:color-mix(in_srgb,var(--sheet-accent)_14%,transparent)]";
const ROW_BASE = "border-[color:color-mix(in_srgb,var(--sheet-accent)_18%,var(--border))]";
const ROW_ZEBRA = "even:bg-[color:color-mix(in_srgb,var(--sheet-accent)_5%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--sheet-accent)_9%,transparent)]";
// Defined in index.css beside .input-fields so it wins the specificity fight
// against the app-wide input treatment; themed by --sheet-accent.
const SURFACE = "sheet-surface shadow-none";

export const SHEET_STYLE_RECIPES: Record<SheetStyleBase, SheetStyleRecipe> = {
  // Modern minimal card — dashboards, sci-fi, anything contemporary
  clean: {
    accent: "var(--primary)",
    background: "color-mix(in srgb, var(--sheet-accent) 4%, var(--card))",
    pickerAccent: "#a78bfa",
    frame: "rounded-lg border border-[color:color-mix(in_srgb,var(--sheet-accent)_25%,var(--border))] bg-[var(--sheet-bg)] shadow-sm",
    title: `flex items-center gap-2 font-semibold text-foreground before:h-3.5 before:w-1 before:rounded-full before:bg-[var(--sheet-accent)] before:content-['']`,
    fieldLabel: "text-muted-foreground",
    surface: SURFACE,
    tableWrapper: "border-[color:color-mix(in_srgb,var(--sheet-accent)_25%,var(--border))]",
    tableHeader: `${HEADER_BG} text-muted-foreground`,
    tableRow: `${ROW_BASE} ${ROW_ZEBRA}`,
    corner: null,
  },

  // Classic TTRPG rulebook page: serif, warm paper, underlined write-in fields
  tome: {
    accent: "#b08d4f",
    background: "color-mix(in srgb, var(--sheet-accent) 10%, var(--card))",
    pickerAccent: "#b08d4f",
    frame:
      "rounded-md border-[3px] border-double border-[color:color-mix(in_srgb,var(--sheet-accent)_55%,transparent)] bg-[var(--sheet-bg)] font-serif shadow-[inset_0_0_26px_color-mix(in_srgb,var(--sheet-accent)_10%,transparent)]",
    title: `border-b border-[color:color-mix(in_srgb,var(--sheet-accent)_35%,transparent)] pb-1 font-serif tracking-wide ${ACCENT_TEXT}`,
    fieldLabel: `font-serif ${LABEL_TINT}`,
    surface: SURFACE,
    tableWrapper: "border-[color:color-mix(in_srgb,var(--sheet-accent)_40%,transparent)]",
    tableHeader: `${HEADER_BG} font-serif ${ACCENT_TEXT}`,
    tableRow: `${ROW_BASE} ${ROW_ZEBRA}`,
    corner: null,
  },

  // Dark leather-and-gilt panel with corner brackets — DnD, dark fantasy
  grimoire: {
    accent: "#d3ab5e",
    background: "color-mix(in srgb, var(--sheet-accent) 7%, color-mix(in srgb, black 22%, var(--card)))",
    pickerAccent: "#d3ab5e",
    frame:
      "rounded-lg border border-[color:color-mix(in_srgb,var(--sheet-accent)_45%,transparent)] bg-[var(--sheet-bg)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--sheet-accent)_20%,transparent),0_2px_10px_rgba(0,0,0,0.25)]",
    title: `text-center font-serif tracking-[0.2em] ${ACCENT_TEXT}`,
    fieldLabel: `font-serif tracking-wide ${LABEL_TINT}`,
    surface: SURFACE,
    tableWrapper: "border-[color:color-mix(in_srgb,var(--sheet-accent)_40%,transparent)]",
    tableHeader: `${HEADER_BG} font-serif ${ACCENT_TEXT}`,
    tableRow: `${ROW_BASE} ${ROW_ZEBRA}`,
    corner: "border-[color:color-mix(in_srgb,var(--sheet-accent)_80%,transparent)]",
  },

  // Soft glow and wide tracking — magic, psionics, ethereal themes
  arcane: {
    accent: "#a78bfa",
    background: "color-mix(in srgb, var(--sheet-accent) 8%, var(--card))",
    pickerAccent: "#a78bfa",
    frame: "rounded-xl border border-[color:color-mix(in_srgb,var(--sheet-accent)_40%,transparent)] bg-[var(--sheet-bg)] shadow-[0_0_18px_color-mix(in_srgb,var(--sheet-accent)_25%,transparent)]",
    title: `tracking-widest ${ACCENT_TEXT}`,
    fieldLabel: LABEL_TINT,
    surface: SURFACE,
    tableWrapper: "border-[color:color-mix(in_srgb,var(--sheet-accent)_35%,transparent)]",
    tableHeader: `${HEADER_BG} ${ACCENT_TEXT}`,
    tableRow: `${ROW_BASE} ${ROW_ZEBRA}`,
    corner: null,
  },

  // Rounded, borderless pastel wash — visual novels, slice-of-life, cozy games
  novel: {
    accent: "#e57399",
    background: "color-mix(in srgb, var(--sheet-accent) 12%, var(--card))",
    pickerAccent: "#e57399",
    frame: "rounded-2xl bg-[var(--sheet-bg)] shadow-[0_4px_16px_rgba(0,0,0,0.10)]",
    title: `font-medium ${ACCENT_TEXT} underline decoration-[color:color-mix(in_srgb,var(--sheet-accent)_45%,transparent)] decoration-4 underline-offset-4`,
    fieldLabel: "font-medium text-[color:color-mix(in_srgb,var(--sheet-accent)_50%,var(--foreground))]",
    surface: SURFACE,
    tableWrapper: "border-transparent bg-[color:color-mix(in_srgb,var(--background)_40%,transparent)]",
    tableHeader: `${HEADER_BG} ${ACCENT_TEXT}`,
    tableRow: `border-transparent ${ROW_ZEBRA}`,
    corner: null,
  },
};

export function resolveSectionStyle(style: SheetSectionStyle): { recipe: SheetStyleRecipe; vars: CSSProperties } {
  const recipe = SHEET_STYLE_RECIPES[style.base] ?? SHEET_STYLE_RECIPES.clean;
  const vars = {
    "--sheet-accent": style.accent ?? recipe.accent,
    "--sheet-bg": style.background ?? recipe.background,
  } as CSSProperties;
  return { recipe, vars };
}

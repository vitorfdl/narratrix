import type { SheetSectionStyle } from "@/schema/template-character-sheet-schema";

export interface SectionStylePreset {
  frame: string;
  title: string;
  tableWrapper: string;
  tableHeader: string;
  tableRow: string;
  corner: string | null;
}

export const SECTION_STYLE_PRESETS: Record<SheetSectionStyle, SectionStylePreset> = {
  plain: {
    frame: "border border-border/80 bg-gradient-to-b from-muted/40 to-card shadow-sm",
    title: "flex items-center gap-2 text-foreground before:h-3.5 before:w-1 before:rounded-full before:bg-primary before:content-['']",
    tableWrapper: "border-border/70",
    tableHeader: "bg-muted/70 text-muted-foreground",
    tableRow: "border-border/40 even:bg-muted/20 hover:bg-muted/40",
    corner: null,
  },
  parchment: {
    frame:
      "border-[3px] border-double border-amber-800/50 bg-gradient-to-br from-amber-50 via-orange-50/90 to-amber-100 text-stone-800 shadow-[inset_0_0_28px_rgba(120,80,20,0.14)] dark:border-amber-600/40 dark:from-[#2a2118] dark:via-[#251d14] dark:to-[#1d160e] dark:text-amber-100/90 dark:shadow-[inset_0_0_28px_rgba(0,0,0,0.45)]",
    title: "font-serif tracking-wide text-amber-900 border-b border-amber-800/30 pb-1 dark:text-amber-300 dark:border-amber-500/30",
    tableWrapper: "border-amber-800/30 dark:border-amber-500/30",
    tableHeader: "bg-amber-900/10 font-serif text-amber-900 dark:bg-amber-500/10 dark:text-amber-200",
    tableRow: "border-amber-800/15 even:bg-amber-900/5 hover:bg-amber-900/10 dark:border-amber-500/15 dark:even:bg-amber-500/5 dark:hover:bg-amber-500/10",
    corner: "border-amber-700/60 dark:border-amber-500/50",
  },
  ornate: {
    frame:
      "border border-amber-500/60 bg-gradient-to-b from-amber-500/10 via-background to-amber-500/10 shadow-[inset_0_0_0_3px_var(--background),inset_0_0_0_4px_rgba(217,119,6,0.45),0_2px_8px_rgba(0,0,0,0.15)]",
    title: "text-center font-serif uppercase tracking-[0.25em] text-amber-600 dark:text-amber-400",
    tableWrapper: "border-amber-500/40",
    tableHeader: "bg-amber-500/15 font-serif uppercase tracking-wider text-amber-700 dark:text-amber-300",
    tableRow: "border-amber-500/20 even:bg-amber-500/5 hover:bg-amber-500/10",
    corner: "border-amber-500/80",
  },
  arcane: {
    frame:
      "border border-purple-500/50 bg-gradient-to-br from-purple-500/15 via-background to-indigo-500/15 shadow-[0_0_20px_rgba(147,51,234,0.25),inset_0_0_24px_rgba(88,28,135,0.12)] dark:from-purple-950/40 dark:to-indigo-950/30",
    title: "bg-gradient-to-r from-purple-500 to-fuchsia-500 bg-clip-text uppercase tracking-widest text-transparent dark:from-purple-400 dark:to-fuchsia-400",
    tableWrapper: "border-purple-500/40",
    tableHeader: "bg-purple-500/15 uppercase tracking-wider text-purple-700 dark:text-purple-300",
    tableRow: "border-purple-500/20 even:bg-purple-500/5 hover:bg-purple-500/10",
    corner: "border-purple-400/70",
  },
  shadow: {
    frame: "border border-border/50 bg-gradient-to-b from-muted/80 to-background shadow-xl ring-1 ring-black/5 dark:ring-white/5",
    title: "text-foreground/90 tracking-wide",
    tableWrapper: "border-border/50",
    tableHeader: "bg-foreground/10 text-foreground/70",
    tableRow: "border-border/30 even:bg-foreground/5 hover:bg-foreground/10",
    corner: null,
  },
};

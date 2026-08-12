import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SheetSectionStyle } from "@/schema/template-character-sheet-schema";
import { SECTION_STYLE_PRESETS } from "./sheet-style-presets";

const CORNER_POSITIONS = [
  "left-1.5 top-1.5 border-l-2 border-t-2",
  "right-1.5 top-1.5 border-r-2 border-t-2",
  "left-1.5 bottom-1.5 border-l-2 border-b-2",
  "right-1.5 bottom-1.5 border-r-2 border-b-2",
];

interface SectionFrameProps {
  style: SheetSectionStyle;
  className?: string;
  children: ReactNode;
}

export function SectionFrame({ style, className, children }: SectionFrameProps) {
  const preset = SECTION_STYLE_PRESETS[style];

  return (
    <div className={cn("relative rounded-lg p-3", preset.frame, className)}>
      {preset.corner && CORNER_POSITIONS.map((position) => <span key={position} className={cn("pointer-events-none absolute h-3.5 w-3.5", position, preset.corner)} />)}
      {children}
    </div>
  );
}

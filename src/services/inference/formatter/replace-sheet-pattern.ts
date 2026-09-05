import type { SheetSection, SheetValues } from "@/schema/template-character-sheet-schema";
import { resolveSheetReference } from "@/utils/sheet-markdown";

export interface CharacterSheetPromptContext {
  sections: SheetSection[];
  values: SheetValues;
  characterName?: string;
}

export type SheetMacroPrefix = "char" | "user";

// Paths owned by the existing character macros ({{user.name}}, {{user.personality}});
// never treated as sheet references even if a sheet field shares the key.
const RESERVED_PATHS = new Set(["name", "personality"]);

// {{<prefix>.<path>}} — dotted path into a character sheet. Excludes "|" so
// random patterns ({{a|b}}) fall through to their own pass, and stops at the
// first closing braces. "{{character.*}}" never matches ("char" is followed
// by "a", not ".").
const PATTERNS: Record<SheetMacroPrefix, RegExp> = {
  char: /\{\{char\.([^{}|]+?)\}\}/gi,
  user: /\{\{user\.([^{}|]+?)\}\}/gi,
};

/**
 * Replaces {{char.SECTION}}, {{char.SECTION.FIELD}} and {{char.sheet}} (or the
 * {{user.*}} equivalents) with the referenced sheet content rendered as
 * markdown. Unresolvable references (no sheet configured, unknown
 * section/field) are left untouched so they stay visible for debugging,
 * matching the other macro passes.
 */
export function replaceSheetPattern(text: string, sheet: CharacterSheetPromptContext | null | undefined, prefix: SheetMacroPrefix = "char"): string {
  return text.replace(PATTERNS[prefix], (match, rawPath: string) => {
    if (!sheet || RESERVED_PATHS.has(rawPath.trim().toLowerCase())) {
      return match;
    }
    return resolveSheetReference(rawPath, sheet) ?? match;
  });
}

import type { SheetValues } from "@/schema/template-character-sheet-schema";

export interface SheetExpressionContext {
  characterName?: string;
  // Current table row cells keyed by column key, for per-column table expressions
  row?: Record<string, unknown>;
}

const REFERENCE_PATTERN = /\$\{([^}]+)\}/g;
const ARITHMETIC_PATTERN = /^[\d\s+\-*/().]+$/;

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "0";
  }
  if (Array.isArray(value)) {
    return value.map((item) => (Array.isArray(item) ? item.join(" ") : String(item))).join(", ");
  }
  return String(value);
}

// Minimal arithmetic evaluator (+ - * / and parentheses) so expressions never reach eval/Function,
// which are blocked by the Tauri CSP.
function evaluateArithmetic(input: string): number | null {
  let pos = 0;

  const peek = () => input[pos];
  const skipSpaces = () => {
    while (pos < input.length && input[pos] === " ") {
      pos++;
    }
  };

  function parseNumber(): number | null {
    skipSpaces();
    const start = pos;
    while (pos < input.length && /[\d.]/.test(input[pos])) {
      pos++;
    }
    if (start === pos) {
      return null;
    }
    const num = Number(input.slice(start, pos));
    return Number.isNaN(num) ? null : num;
  }

  function parseFactor(): number | null {
    skipSpaces();
    if (peek() === "(") {
      pos++;
      const value = parseExpression();
      skipSpaces();
      if (peek() !== ")") {
        return null;
      }
      pos++;
      return value;
    }
    if (peek() === "-") {
      pos++;
      const value = parseFactor();
      return value === null ? null : -value;
    }
    if (peek() === "+") {
      pos++;
      return parseFactor();
    }
    return parseNumber();
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) {
      return null;
    }
    skipSpaces();
    while (peek() === "*" || peek() === "/") {
      const op = input[pos++];
      const right = parseFactor();
      if (right === null) {
        return null;
      }
      left = op === "*" ? left * right : left / right;
      skipSpaces();
    }
    return left;
  }

  function parseExpression(): number | null {
    let left = parseTerm();
    if (left === null) {
      return null;
    }
    skipSpaces();
    while (peek() === "+" || peek() === "-") {
      const op = input[pos++];
      const right = parseTerm();
      if (right === null) {
        return null;
      }
      left = op === "+" ? left + right : left - right;
      skipSpaces();
    }
    return left;
  }

  const result = parseExpression();
  skipSpaces();
  if (result === null || pos !== input.length || !Number.isFinite(result)) {
    return null;
  }
  return Math.round(result * 100) / 100;
}

function resolveCharacterAttribute(key: string, context?: SheetExpressionContext): string | null {
  if (key === "name") {
    return context?.characterName ?? "";
  }
  return null;
}

/**
 * Resolves a sheet expression like "10 + ${sheet.level} * 2".
 * Reference forms:
 * - ${sheet.key} — a sheet field (also accepts the legacy ${character.sheet.key})
 * - ${row.key} — a sibling cell in the same table row (column label as key)
 * - ${char.name} / ${name} — character attributes; a bare ${key} resolves the
 *   sheet field first and falls back to the character attribute
 * If the substituted result is pure arithmetic it is computed, otherwise
 * returned as a plain string.
 */
export function resolveSheetExpression(expression: string, values: SheetValues, context?: SheetExpressionContext): string {
  const substituted = expression.replace(REFERENCE_PATTERN, (_match, rawPath: string) => {
    const path = rawPath.trim();

    if (path.startsWith("row.")) {
      return formatValue(context?.row?.[path.slice(4)]);
    }
    if (path.startsWith("char.") || path.startsWith("character.")) {
      const attr = path.replace(/^char(acter)?\./, "");
      if (attr.startsWith("sheet.")) {
        return formatValue(values[attr.slice(6)]);
      }
      return resolveCharacterAttribute(attr, context) ?? "0";
    }
    if (path.startsWith("sheet.")) {
      return formatValue(values[path.slice(6)]);
    }

    // Bare key: sheet field wins, then the current table row, then character attributes
    if (values[path] !== undefined) {
      return formatValue(values[path]);
    }
    if (context?.row && context.row[path] !== undefined) {
      return formatValue(context.row[path]);
    }
    return resolveCharacterAttribute(path, context) ?? formatValue(undefined);
  });

  if (ARITHMETIC_PATTERN.test(substituted) && /\d/.test(substituted)) {
    const computed = evaluateArithmetic(substituted.trim());
    if (computed !== null) {
      return String(computed);
    }
  }

  return substituted;
}

export function isExpressionField(expression: string | null | undefined): expression is string {
  return typeof expression === "string" && expression.trim().length > 0;
}

// Shared runtime for the Roll Dice node. The schema is the single source of truth for the
// node executor's inputSchema and the BUILTIN_NODE_TOOLS registry in services/agent-tools.ts.

export const ROLL_DICE_TOOL_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    notation: {
      type: "string",
      description: "Dice in standard notation, e.g. '2d6+3', 'd20', '4d8-1'. A leading count and a trailing modifier are optional. Defaults to '1d20' when omitted.",
    },
  },
};

export interface DiceRoll {
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
}

const MAX_DICE = 1000;
const MAX_SIDES = 1000;

/** Parse and evaluate standard dice notation. Returns an error message for invalid input. */
export function rollDice(notation: string): DiceRoll | { error: string } {
  const match = /^\s*(\d*)\s*d\s*(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(notation);
  if (!match) {
    return { error: `Invalid dice notation "${notation}". Use a form like "2d6+3", "d20" or "4d8-1".` };
  }

  const count = match[1] === "" ? 1 : Number.parseInt(match[1], 10);
  const sides = Number.parseInt(match[2], 10);
  const modifier = match[3] ? Number.parseInt(match[3].replace(/\s+/g, ""), 10) : 0;

  if (sides < 1 || sides > MAX_SIDES) {
    return { error: `A die must have between 1 and ${MAX_SIDES} sides.` };
  }
  if (count < 1 || count > MAX_DICE) {
    return { error: `You can roll between 1 and ${MAX_DICE} dice at once.` };
  }

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  const total = rolls.reduce((sum, value) => sum + value, 0) + modifier;
  const normalized = `${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : ""}`;

  return { notation: normalized, rolls, modifier, total };
}

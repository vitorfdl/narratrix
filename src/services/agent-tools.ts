import { ROLL_DICE_TOOL_SCHEMA } from "@/pages/agents/components/tool-nodes/dice-tools";
import { GET_CHARACTER_SHEET_TOOL_DESCRIPTION } from "@/pages/agents/components/tool-nodes/nodeGetCharacterSheet";
import type { TriggerNodeConfig } from "@/pages/agents/components/tool-nodes/nodeTrigger";
import { UPDATE_CHARACTER_SHEET_TOOL_DESCRIPTION } from "@/pages/agents/components/tool-nodes/nodeUpdateCharacterSheet";
import { GET_PARTICIPANT_DATA_TOOL_SCHEMA, LIST_PARTICIPANTS_TOOL_SCHEMA, SET_PARTICIPANT_ENABLED_TOOL_SCHEMA } from "@/pages/agents/components/tool-nodes/participant-tools";
import type { AgentType } from "@/schema/agent-schema";
import type { ChatTemplateTool } from "@/schema/template-chat-schema";
import type { WorkflowToolDefinition } from "@/services/agent-workflow/types";

const EMPTY_OBJECT_SCHEMA: Record<string, unknown> = { type: "object", properties: {} };

// Picker-only placeholders: the sheet tools build their real schema per chat when the
// tool is assembled (the character enum and field catalog depend on the participants).
const CHARACTER_SHEET_PICKER_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: { character: { type: "string", description: "Name of a chat participant that has a character sheet." } },
  required: ["character"],
};
const UPDATE_CHARACTER_SHEET_PICKER_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    character: { type: "string", description: "Name of a chat participant that has a character sheet." },
    updates: { type: "array", description: "Field changes: { field, op: set|add|remove, value }.", items: { type: "object" } },
  },
  required: ["character", "updates"],
};

/** Input schema the User Choice node exposes in tool mode (mirrors its executor). */
const USER_CHOICE_TOOL_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      description: "One or more questions to ask the user. They are shown one at a time, in order, each after the previous is answered.",
      items: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "The question or prompt to show the user" },
          choices: {
            type: "array",
            description: "The options the user can choose from. May be empty when allowCustom is true.",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "The option text shown to the user" },
                description: { type: "string", description: "Optional secondary text shown beneath the label" },
              },
              required: ["label"],
            },
          },
          allowCustom: { type: "boolean", description: "If true, also let the user type a custom free-text answer instead of picking one of the choices." },
          allowMultiple: { type: "boolean", description: "If true, let the user select more than one option. The answer is returned as a JSON array of the chosen values." },
        },
        required: ["prompt", "choices"],
      },
    },
  },
  required: ["questions"],
};

/** Coerce an arbitrary string into a provider-safe tool identifier. */
export function sanitizeToolName(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return cleaned || "tool";
}

function getTriggerConfig(agent: AgentType): TriggerNodeConfig | undefined {
  return agent.nodes?.find((n) => n.type === "trigger")?.config as TriggerNodeConfig | undefined;
}

export interface AgentToolDescriptor {
  agentId: string;
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

/**
 * If the agent's trigger is "tool", returns its tool descriptor; otherwise null. The tool's
 * name/description/arguments all come from the Trigger node's parameters schema (its `title`
 * is the tool name, `description` the tool description), mirroring how nodeJavascript derives them.
 */
export function getAgentToolDefinition(agent: AgentType): AgentToolDescriptor | null {
  const cfg = getTriggerConfig(agent);
  const triggerType = cfg?.triggerType ?? agent.settings?.run_on?.type;
  if (triggerType !== "tool") {
    return null;
  }

  const schema = cfg?.toolParameters ?? null;
  const name = sanitizeToolName(schema?.title || agent.name);
  const description = schema?.description || agent.description || undefined;
  const parameters = (schema as Record<string, unknown> | null) || EMPTY_OBJECT_SCHEMA;

  return { agentId: agent.id, name, description, parameters };
}

export function isToolAgent(agent: AgentType): boolean {
  return getAgentToolDefinition(agent) !== null;
}

/**
 * Built-in tool nodes that can be attached to a chat directly, without authoring an agent.
 * Limited to nodes that work with no setup — the LLM supplies everything at call time.
 * `buildConfig` returns the node config used to run the node executor in tool mode.
 */
export type BuiltinToolCategory = "story" | "participants" | "sheets";

export interface BuiltinNodeTool {
  nodeType: string;
  /** Provider-facing identifier sent to the LLM. Never shown to end users. */
  name: string;
  /** Provider-facing description sent to the LLM. */
  description: string;
  /** Human-friendly title shown in the chat template picker. */
  label: string;
  /** One short sentence telling the user what enabling this does. */
  summary: string;
  category: BuiltinToolCategory;
  parameters: Record<string, unknown>;
  buildConfig: () => Record<string, unknown>;
  /** Run the node when the toolset is assembled so its schema/description can depend on the chat (e.g. participant names). `parameters` is then only a picker placeholder. */
  dynamicSchema?: boolean;
}

export const BUILTIN_NODE_TOOLS: BuiltinNodeTool[] = [
  {
    nodeType: "userChoice",
    name: "userChoice",
    label: "Ask the User",
    summary: "Pauses the reply to offer you choices before continuing.",
    category: "story",
    description: "Ask the user one or more multiple-choice questions in sequence and return their answers.",
    parameters: USER_CHOICE_TOOL_SCHEMA,
    buildConfig: () => ({
      mode: "tool",
      prompt: "",
      choices: [],
      toolName: "userChoice",
      toolDescription: "Ask the user one or more multiple-choice questions in sequence and return their answers.",
      timeoutSeconds: 0,
    }),
  },
  {
    nodeType: "listParticipants",
    name: "listParticipants",
    label: "See Who's Here",
    summary: "Lets the AI know which characters are in the chat.",
    category: "participants",
    description: "List the participants in the current chat with their id, name, kind and whether they are currently enabled.",
    parameters: LIST_PARTICIPANTS_TOOL_SCHEMA,
    buildConfig: () => ({
      mode: "tool",
      toolName: "listParticipants",
      toolDescription: "List the participants in the current chat with their id, name, kind and whether they are currently enabled.",
      typeFilter: "all",
      tags: [],
    }),
  },
  {
    nodeType: "setParticipantEnabled",
    name: "setParticipantEnabled",
    label: "Enter & Leave Scene",
    summary: "Lets the AI bring characters into the scene or send them away.",
    category: "participants",
    description: "Enable or disable a chat participant by id. Disabled participants stay in the chat but are excluded from generation.",
    parameters: SET_PARTICIPANT_ENABLED_TOOL_SCHEMA,
    buildConfig: () => ({
      mode: "tool",
      toolName: "setParticipantEnabled",
      toolDescription: "Enable or disable a chat participant by id. Disabled participants stay in the chat but are excluded from generation.",
      enabled: true,
    }),
  },
  {
    nodeType: "getParticipantData",
    name: "getParticipantData",
    label: "Character Details",
    summary: "Lets the AI look up a character's personality and tags.",
    category: "participants",
    description: "Get a chat participant's data (name, kind, enabled state, personality, tags, avatar) by id.",
    parameters: GET_PARTICIPANT_DATA_TOOL_SCHEMA,
    buildConfig: () => ({
      mode: "tool",
      toolName: "getParticipantData",
      toolDescription: "Get a chat participant's data (name, kind, enabled state, personality, tags, avatar) by id.",
      fields: [],
    }),
  },
  {
    nodeType: "getCharacterSheet",
    name: "getCharacterSheet",
    label: "Read Character Sheet",
    summary: "Lets the AI check stats, inventory and notes on a sheet.",
    category: "sheets",
    description: GET_CHARACTER_SHEET_TOOL_DESCRIPTION,
    parameters: CHARACTER_SHEET_PICKER_SCHEMA,
    dynamicSchema: true,
    buildConfig: () => ({
      mode: "tool",
      toolName: "getCharacterSheet",
      toolDescription: GET_CHARACTER_SHEET_TOOL_DESCRIPTION,
      characterId: "",
      includeUserCharacter: true,
    }),
  },
  {
    nodeType: "updateCharacterSheet",
    name: "updateCharacterSheet",
    label: "Update Character Sheet",
    summary: "Lets the AI change stats, inventory and notes as the story unfolds.",
    category: "sheets",
    description: UPDATE_CHARACTER_SHEET_TOOL_DESCRIPTION,
    parameters: UPDATE_CHARACTER_SHEET_PICKER_SCHEMA,
    dynamicSchema: true,
    buildConfig: () => ({
      mode: "tool",
      toolName: "updateCharacterSheet",
      toolDescription: UPDATE_CHARACTER_SHEET_TOOL_DESCRIPTION,
      characterId: "",
      includeUserCharacter: true,
      scope: "chat",
    }),
  },
  {
    nodeType: "rollDice",
    name: "rollDice",
    label: "Roll Dice",
    summary: "Lets the AI roll real dice (like 2d6+3) instead of guessing.",
    category: "story",
    description: "Roll dice using standard notation (e.g. 2d6+3) and return the individual rolls and their total.",
    parameters: ROLL_DICE_TOOL_SCHEMA,
    buildConfig: () => ({
      mode: "tool",
      toolName: "rollDice",
      toolDescription: "Roll dice using standard notation (e.g. 2d6+3) and return the individual rolls and their total.",
      notation: "1d20",
    }),
  },
];

export function getBuiltinNodeTool(nodeType: string): BuiltinNodeTool | undefined {
  return BUILTIN_NODE_TOOLS.find((tool) => tool.nodeType === nodeType);
}

/** Stable identity for a tool reference, used for selection matching and React keys. */
export function toolRefKey(ref: ChatTemplateTool): string {
  return ref.agent_id ? `agent:${ref.agent_id}` : `node:${ref.node_type ?? ""}`;
}

export type ChatToolGroup = "agents" | BuiltinToolCategory;

/** A tool selectable in the chat config picker. `name`/`description` are LLM-facing; `label`/`summary` are what users see. */
export interface ChatToolOption {
  key: string;
  name: string;
  description?: string;
  label: string;
  summary?: string;
  kind: "agent" | "node";
  group: ChatToolGroup;
  nodeType?: string;
  ref: ChatTemplateTool;
}

/**
 * Tools selectable for a chat: agents whose trigger is "tool", plus built-in node tools.
 * `agents` should already be scoped to the current profile.
 */
export function listChatToolOptions(agents: AgentType[]): ChatToolOption[] {
  const options: ChatToolOption[] = [];

  for (const agent of agents) {
    const descriptor = getAgentToolDefinition(agent);
    if (descriptor) {
      options.push({
        key: `agent:${agent.id}`,
        name: descriptor.name,
        description: descriptor.description,
        label: agent.name,
        summary: agent.description || descriptor.description,
        kind: "agent",
        group: "agents",
        ref: { agent_id: agent.id },
      });
    }
  }

  for (const builtin of BUILTIN_NODE_TOOLS) {
    options.push({
      key: `node:${builtin.nodeType}`,
      name: builtin.name,
      description: builtin.description,
      label: builtin.label,
      summary: builtin.summary,
      kind: "node",
      group: builtin.category,
      nodeType: builtin.nodeType,
      ref: { node_type: builtin.nodeType },
    });
  }

  return options;
}

/** Extract the first WorkflowToolDefinition from a tool-mode node executor result. */
export function extractToolFromResult(value: unknown): WorkflowToolDefinition | null {
  if (Array.isArray(value)) {
    return (value[0] as WorkflowToolDefinition) ?? null;
  }
  if (value && typeof value === "object" && Array.isArray((value as { toolset?: unknown[] }).toolset)) {
    return ((value as { toolset: unknown[] }).toolset[0] as WorkflowToolDefinition) ?? null;
  }
  return null;
}

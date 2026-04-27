import { BookOpen, User } from "lucide-react";
import { memo } from "react";
import { useCharacterStore } from "@/hooks/characterStore";
import type { NodeExecutionResult, NodeExecutor } from "@/services/agent-workflow/types";
import { NodeBase, type NodeInput, type NodeOutput } from "../tool-components/NodeBase";
import { NodeField } from "../tool-components/node-content-ui";
import { createNodeTheme, NodeRegistry } from "../tool-components/node-registry";
import type { NodeProps } from "./nodeTypes";

// ─── Executor ──────────────────────────────────────────────────────────────────

const executeGetLorebookNode: NodeExecutor = async (_node, inputs): Promise<NodeExecutionResult> => {
  const characterId = typeof inputs.characterId === "string" ? inputs.characterId : undefined;

  if (!characterId) {
    return { success: false, error: "Get Lorebook node requires a Character ID input" };
  }

  try {
    const characters = useCharacterStore.getState().characters;
    const character = characters.find((c) => c.id === characterId);

    if (!character) {
      return { success: false, error: `Character not found: ${characterId}` };
    }

    if (!character.lorebook_id) {
      return { success: false, error: `Character "${character.name}" has no lorebook attached` };
    }

    return { success: true, value: character.lorebook_id };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to resolve lorebook";
    return { success: false, error: message };
  }
};

// ─── Metadata ──────────────────────────────────────────────────────────────────

const GET_LOREBOOK_NODE_METADATA = {
  type: "getLorebook",
  label: "Get Lorebook",
  category: "Lorebook",
  description: "Resolves the lorebook attached to a character",
  icon: BookOpen,
  theme: createNodeTheme("orange"),
  deletable: true,
  inputs: [{ id: "in-character", label: "Character ID", edgeType: "string" as const, targetRef: "character-section" }] as NodeInput[],
  outputs: [{ id: "out-lorebook-id", label: "Lorebook ID", edgeType: "string" as const }] as NodeOutput[],
  defaultConfig: {},
};

namespace GetLorebookNodeConfigProvider {
  export function getDefaultConfig() {
    return {
      label: GET_LOREBOOK_NODE_METADATA.label,
      config: GET_LOREBOOK_NODE_METADATA.defaultConfig,
    };
  }
}

// ─── Content ───────────────────────────────────────────────────────────────────

const GetLorebookContent = memo(() => {
  return (
    <div className="space-y-3 w-full">
      <NodeField label="Character ID" icon={User} refId="character-section" helpText="Connect a Participant Picker or Trigger output to resolve the character's lorebook." />
    </div>
  );
});

GetLorebookContent.displayName = "GetLorebookContent";

// ─── Node Component ────────────────────────────────────────────────────────────

export const GetLorebookNode = memo(({ id, data, selected }: NodeProps) => {
  return (
    <NodeBase nodeId={id} data={data} selected={!!selected}>
      <GetLorebookContent />
    </NodeBase>
  );
});

GetLorebookNode.displayName = "GetLorebookNode";

// ─── Registration ──────────────────────────────────────────────────────────────

NodeRegistry.register({
  metadata: GET_LOREBOOK_NODE_METADATA,
  component: GetLorebookNode,
  configProvider: GetLorebookNodeConfigProvider,
  executor: executeGetLorebookNode,
});

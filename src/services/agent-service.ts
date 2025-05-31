import {
  AgentEdgeType,
  AgentNodeType,
  AgentSettingsType,
  AgentType,
  CreateAgentParams,
  CreateCustomNodeParams,
  CustomNodeType,
  UpdateAgentParams,
  UpdateCustomNodeParams,
  agentSchema,
  createAgentSchema,
  createCustomNodeSchema,
  customNodeSchema,
} from "@/schema/agent-schema";
import { formatDateTime } from "@/utils/date-time";
import { uuidUtils } from "../schema/utils-schema";
import { buildUpdateParams, executeDBQuery, selectDBQuery } from "../utils/database";

const parseBoolean = (value: any) => value === 1 || value === true || value === "true";

// Helper to parse JSON fields from DB results for Agent
function parseAgentJsonFields(agent: any): AgentType {
  return {
    ...agent,
    tags: JSON.parse(agent.tags || "[]"),
    nodes: JSON.parse(agent.nodes || "[]"),
    edges: JSON.parse(agent.edges || "[]"),
    settings: JSON.parse(agent.settings || '{"run_on":{"type":"manual"}}'),
    created_at: new Date(agent.created_at),
    updated_at: new Date(agent.updated_at),
    favorite: parseBoolean(agent.favorite),
  };
}

// Helper to parse JSON fields from DB results for CustomNode
function parseCustomNodeJsonFields(node: any): CustomNodeType {
  return {
    ...node,
    tags: JSON.parse(node.tags || "[]"),
    default_config: JSON.parse(node.default_config || "{}"),
    extra: JSON.parse(node.extra || "{}"),
    created_at: new Date(node.created_at),
    updated_at: new Date(node.updated_at),
    favorite: parseBoolean(node.favorite),
  };
}

// Interface for filtering agents
export interface AgentFilter {
  profile_id: string;
  category?: string;
  favorite?: boolean;
}

// Interface for filtering custom nodes
export interface CustomNodeFilter {
  profile_id: string;
  node_type?: string;
  favorite?: boolean;
}

// --- Agent CRUD ---

// Create a new agent
export async function createAgent(agentData: CreateAgentParams): Promise<AgentType> {
  const profileId = uuidUtils.uuid().parse(agentData.profile_id);
  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Use the schema's default values by parsing the input
  const validatedInput = createAgentSchema.parse(agentData);

  const validatedAgent = agentSchema.parse({
    ...validatedInput,
    id,
    profile_id: profileId,
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  // Convert JSON fields to strings for storage
  const tagsStr = JSON.stringify(validatedAgent.tags);
  const nodesStr = JSON.stringify(validatedAgent.nodes);
  const edgesStr = JSON.stringify(validatedAgent.edges);
  const settingsStr = JSON.stringify(validatedAgent.settings);

  await executeDBQuery(
    `INSERT INTO agents (
      id, profile_id, name, description, version, tags,
      nodes, edges, settings, category, favorite,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      validatedAgent.id,
      validatedAgent.profile_id,
      validatedAgent.name,
      validatedAgent.description,
      validatedAgent.version,
      tagsStr,
      nodesStr,
      edgesStr,
      settingsStr,
      validatedAgent.category,
      validatedAgent.favorite,
      now,
      now,
    ],
  );

  return validatedAgent;
}

// Get an agent by ID
export async function getAgentById(id: string): Promise<AgentType | null> {
  const validId = uuidUtils.uuid().parse(id);
  const result = await selectDBQuery<any[]>("SELECT * FROM agents WHERE id = $1", [validId]);

  if (result.length === 0) {
    return null;
  }

  return parseAgentJsonFields(result[0]);
}

// List agents with optional filtering
export async function listAgents(filter: AgentFilter): Promise<AgentType[]> {
  let query = "SELECT * FROM agents";
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // profile_id is mandatory
  conditions.push(`profile_id = $${paramIndex}`);
  params.push(uuidUtils.uuid().parse(filter.profile_id));
  paramIndex++;

  // Optional filter: category
  if (filter.category !== undefined) {
    if (filter.category === null) {
      conditions.push("category IS NULL");
    } else {
      conditions.push(`category = $${paramIndex}`);
      params.push(filter.category);
      paramIndex++;
    }
  }

  // Optional filter: favorite
  if (filter.favorite !== undefined) {
    conditions.push(`favorite = $${paramIndex}`);
    params.push(filter.favorite);
    paramIndex++;
  }

  query += ` WHERE ${conditions.join(" AND ")}`;
  query += " ORDER BY name ASC"; // Default ordering

  const result = await selectDBQuery<any[]>(query, params);
  return result.map(parseAgentJsonFields);
}

// Update an agent
export async function updateAgent(id: string, updateData: UpdateAgentParams): Promise<AgentType | null> {
  const agentId = uuidUtils.uuid().parse(id);
  
  // Fetch to ensure ownership before update
  const currentAgent = await getAgentById(agentId);
  if (!currentAgent) {
    return null;
  }

  const now = formatDateTime();

  // Define field transformations for JSON fields
  const fieldMapping = {
    tags: (value: string[]) => JSON.stringify(value),
    nodes: (value: AgentNodeType[]) => JSON.stringify(value),
    edges: (value: AgentEdgeType[]) => JSON.stringify(value),
    settings: (value: AgentSettingsType) => JSON.stringify(value),
  };

  const { updates, values, whereClause } = buildUpdateParams(agentId, updateData, fieldMapping);
  if (updates.length === 0) {
    return currentAgent; // No changes
  }

  updates.push(`updated_at = $${values.length + 1}`);
  values.push(now);

  await executeDBQuery(`UPDATE agents SET ${updates.join(", ")}${whereClause}`, values);

  return getAgentById(agentId);
}

// Delete an agent
export async function deleteAgent(id: string): Promise<boolean> {
  const agentId = uuidUtils.uuid().parse(id);
  const result = await executeDBQuery("DELETE FROM agents WHERE id = $1", [agentId]);
  return result.rowsAffected > 0;
}

// --- Custom Node CRUD ---

// Create a new custom node
export async function createCustomNode(nodeData: CreateCustomNodeParams): Promise<CustomNodeType> {
  const profileId = uuidUtils.uuid().parse(nodeData.profile_id);
  const id = crypto.randomUUID();
  const now = formatDateTime();

  // Use the schema's default values
  const validatedInput = createCustomNodeSchema.parse(nodeData);

  const validatedNode = customNodeSchema.parse({
    ...validatedInput,
    id,
    profile_id: profileId,
    created_at: new Date(now),
    updated_at: new Date(now),
  });

  const tagsStr = JSON.stringify(validatedNode.tags);
  const defaultConfigStr = JSON.stringify(validatedNode.default_config);
  const extraStr = JSON.stringify(validatedNode.extra);

  await executeDBQuery(
    `INSERT INTO custom_nodes (
      id, profile_id, name, description, version, node_type,
      tags, default_config, extra, favorite,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      validatedNode.id,
      validatedNode.profile_id,
      validatedNode.name,
      validatedNode.description,
      validatedNode.version,
      validatedNode.node_type,
      tagsStr,
      defaultConfigStr,
      extraStr,
      validatedNode.favorite,
      now,
      now,
    ],
  );

  return validatedNode;
}

// Get a custom node by ID
export async function getCustomNodeById(id: string): Promise<CustomNodeType | null> {
  const validId = uuidUtils.uuid().parse(id);
  const result = await selectDBQuery<any[]>("SELECT * FROM custom_nodes WHERE id = $1", [validId]);

  if (result.length === 0) {
    return null;
  }

  return parseCustomNodeJsonFields(result[0]);
}

// List custom nodes with optional filtering
export async function listCustomNodes(filter: CustomNodeFilter): Promise<CustomNodeType[]> {
  let query = "SELECT * FROM custom_nodes";
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // profile_id is mandatory
  conditions.push(`profile_id = $${paramIndex}`);
  params.push(uuidUtils.uuid().parse(filter.profile_id));
  paramIndex++;

  // Optional filter: node_type
  if (filter.node_type !== undefined) {
    conditions.push(`node_type = $${paramIndex}`);
    params.push(filter.node_type);
    paramIndex++;
  }

  // Optional filter: favorite
  if (filter.favorite !== undefined) {
    conditions.push(`favorite = $${paramIndex}`);
    params.push(filter.favorite);
    paramIndex++;
  }

  query += ` WHERE ${conditions.join(" AND ")}`;
  query += " ORDER BY name ASC"; // Default ordering

  const result = await selectDBQuery<any[]>(query, params);
  return result.map(parseCustomNodeJsonFields);
}

// Update a custom node
export async function updateCustomNode(id: string, updateData: UpdateCustomNodeParams): Promise<CustomNodeType | null> {
  const nodeId = uuidUtils.uuid().parse(id);
  
  // Fetch to ensure ownership before update
  const currentNode = await getCustomNodeById(nodeId);
  if (!currentNode) {
    return null;
  }

  const now = formatDateTime();

  const fieldMapping = {
    tags: (value: string[]) => JSON.stringify(value),
    default_config: (value: Record<string, any>) => JSON.stringify(value),
    extra: (value: Record<string, any>) => JSON.stringify(value),
  };

  const { updates, values, whereClause } = buildUpdateParams(nodeId, updateData, fieldMapping);
  if (updates.length === 0) {
    return currentNode; // No changes
  }

  updates.push(`updated_at = $${values.length + 1}`);
  values.push(now);

  await executeDBQuery(`UPDATE custom_nodes SET ${updates.join(", ")}${whereClause}`, values);

  return getCustomNodeById(nodeId);
}

// Delete a custom node
export async function deleteCustomNode(id: string): Promise<boolean> {
  const nodeId = uuidUtils.uuid().parse(id);
  const result = await executeDBQuery("DELETE FROM custom_nodes WHERE id = $1", [nodeId]);
  return result.rowsAffected > 0;
}

// --- Utility Functions ---

// Get agents by category
export async function getAgentsByCategory(profileId: string, category: string | null): Promise<AgentType[]> {
  return listAgents({ profile_id: profileId, category: category ?? undefined });
}

// Get favorite agents
export async function getFavoriteAgents(profileId: string): Promise<AgentType[]> {
  return listAgents({ profile_id: profileId, favorite: true });
}

// Get custom nodes by type
export async function getCustomNodesByType(profileId: string, nodeType: string): Promise<CustomNodeType[]> {
  return listCustomNodes({ profile_id: profileId, node_type: nodeType });
}

// Duplicate an agent (useful for creating templates)
export async function duplicateAgent(id: string, newName: string): Promise<AgentType | null> {
  const originalAgent = await getAgentById(id);
  if (!originalAgent) {
    return null;
  }

  const duplicateData: CreateAgentParams = {
    profile_id: originalAgent.profile_id,
    name: newName,
    description: originalAgent.description,
    version: originalAgent.version,
    tags: [...originalAgent.tags],
    nodes: [...originalAgent.nodes],
    edges: [...originalAgent.edges],
    settings: { ...originalAgent.settings },
    category: originalAgent.category,
  };

  return createAgent(duplicateData);
}

// Export types
export type {
  AgentType as Agent, CreateAgentParams, CreateCustomNodeParams, CustomNodeType as CustomNode, UpdateAgentParams, UpdateCustomNodeParams
};


import { z } from "zod";
import { uuidUtils } from "./utils-schema";

/**
 * Node Position Schema
 */
export const nodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

/**
 * Agent Node Schema
 */
export const agentNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: nodePositionSchema,
  label: z.string(),
  config: z.record(z.string(), z.any()).optional(),
});

/**
 * Agent Edge Schema
 */
export const agentEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string(),
  targetHandle: z.string(),
  edgeType: z.string(),
});

/**
 * Agent Settings Schema
 */
export const agentSettingsSchema = z.object({
  run_on: z.object({
    type: z.enum(["manual", "every_message", "scheduled"]),
    config: z.record(z.string(), z.any()).optional(),
  }),
  // Additional settings can be added here
}).catchall(z.any()); // Allow additional properties

/**
 * Agent Schema
 */
export const agentSchema = z.object({
  id: uuidUtils.withDefault(),
  profile_id: uuidUtils.uuid(),
  favorite: z.boolean().default(false),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  version: z.string().default("1.0.0"),
  tags: z.array(z.string()).default([]),
  
  // Workflow configuration
  nodes: z.array(agentNodeSchema).default([]),
  edges: z.array(agentEdgeSchema).default([]),
  settings: agentSettingsSchema.default({ run_on: { type: "manual" } }),
  
  // Metadata
  category: z.string().nullable().optional(),
  
  created_at: z.date(),
  updated_at: z.date(),
});

/**
 * Custom Node Schema
 */
export const customNodeSchema = z.object({
  id: uuidUtils.withDefault(),
  profile_id: uuidUtils.uuid(),
  favorite: z.boolean().default(false),
  name: z.string().min(1, "Name is required"),
  description: z.string().nullable().optional(),
  version: z.string().default("1.0.0"),
  
  // Node definition
  node_type: z.string().min(1, "Node type is required"),
  tags: z.array(z.string()).default([]),
  
  // Node configuration
  default_config: z.record(z.string(), z.any()).default({}),
  
  // Metadata
  extra: z.record(z.string(), z.any()).default({}),
  
  created_at: z.date(),
  updated_at: z.date(),
});

/**
 * Request/Response Schemas for Agent
 */
export const createAgentSchema = agentSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  favorite: true,
});

export const updateAgentSchema = agentSchema.partial().pick({
  name: true,
  description: true,
  version: true,
  tags: true,
  nodes: true,
  edges: true,
  settings: true,
  category: true,
  favorite: true,
});

/**
 * Request/Response Schemas for Custom Node
 */
export const createCustomNodeSchema = customNodeSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  favorite: true,
});

export const updateCustomNodeSchema = customNodeSchema.partial().pick({
  name: true,
  description: true,
  version: true,
  node_type: true,
  tags: true,
  default_config: true,
  extra: true,
  favorite: true,
});

/**
 * Agent Workflow Import/Export Schema
 */
export const agentWorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  tags: z.array(z.string()),
  nodes: z.array(agentNodeSchema),
  edges: z.array(agentEdgeSchema),
  settings: agentSettingsSchema,
});

/**
 * TypeScript Types
 */
export type NodePositionType = z.infer<typeof nodePositionSchema>;
export type AgentNodeType = z.infer<typeof agentNodeSchema>;
export type AgentEdgeType = z.infer<typeof agentEdgeSchema>;
export type AgentSettingsType = z.infer<typeof agentSettingsSchema>;

export type AgentType = z.infer<typeof agentSchema>;
export type CreateAgentParams = z.infer<typeof createAgentSchema>;
export type UpdateAgentParams = z.infer<typeof updateAgentSchema>;

export type CustomNodeType = z.infer<typeof customNodeSchema>;
export type CreateCustomNodeParams = z.infer<typeof createCustomNodeSchema>;
export type UpdateCustomNodeParams = z.infer<typeof updateCustomNodeSchema>;

export type AgentWorkflow = z.infer<typeof agentWorkflowSchema>;

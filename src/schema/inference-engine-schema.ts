import { z } from "zod";
import { uuidUtils } from "./utils-schema";

// Types for inference messages
const InferenceToolCallSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  arguments: z.union([z.string(), z.record(z.string(), z.any())]),
});

const InferenceToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
});

type InferenceToolCall = z.infer<typeof InferenceToolCallSchema>;

type InferenceToolDefinition = z.infer<typeof InferenceToolDefinitionSchema>;

const InferenceMessageSchema = z.object({
  role: z.enum(["assistant", "user", "tool"]),
  text: z.string(),
  tool_calls: z.array(InferenceToolCallSchema).optional(),
  tool_call_id: z.string().optional(),
});

type InferenceMessage = z.infer<typeof InferenceMessageSchema>;

// Types for inference requests and responses
const InferenceRequestSchema = z.object({
  id: uuidUtils.uuid(),
  message_list: z.array(InferenceMessageSchema),
  system_prompt: z.string().optional(),
  parameters: z.record(z.string(), z.any()),
  stream: z.boolean(),
  tools: z.array(InferenceToolDefinitionSchema).optional(),
});

type InferenceRequest = z.infer<typeof InferenceRequestSchema>;

const StreamingResultSchema = z.object({
  text: z.string().optional(),
  reasoning: z.string().optional(),
  full_response: z.string().optional(),
  tool_calls: z.array(InferenceToolCallSchema).optional(),
});

const InferenceResponseSchema = z.discriminatedUnion("status", [
  z.object({
    request_id: z.string(),
    status: z.literal("completed"),
    result: StreamingResultSchema,
    error: z.undefined().optional(),
  }),
  z.object({
    request_id: z.string(),
    status: z.literal("streaming"),
    result: StreamingResultSchema,
    error: z.undefined().optional(),
  }),
  z.object({
    request_id: z.string(),
    status: z.literal("error"),
    result: z.undefined().optional(),
    error: z.string(),
  }),
  z.object({
    request_id: z.string(),
    status: z.literal("cancelled"),
    result: StreamingResultSchema.optional(),
    error: z.string().optional(),
  }),
]);

type InferenceResponse = z.infer<typeof InferenceResponseSchema>;
type InferenceCompletedResponse = Extract<InferenceResponse, { status: "completed" }>;
type InferenceCancelledResponse = Extract<InferenceResponse, { status: "cancelled" }>;
type InferenceStreamingResponse = Extract<InferenceResponse, { status: "streaming" }>;
// Model specifications for controlling concurrency
const ModelSpecsSchema = z.object({
  id: z.string(),
  model_type: z.string(),
  config: z.record(z.string(), z.any()),
  max_concurrent_requests: z.number().int().positive(),
  engine: z.string(),
});

type ModelSpecs = z.infer<typeof ModelSpecsSchema>;

export { InferenceMessageSchema, InferenceRequestSchema, InferenceResponseSchema, InferenceToolCallSchema, InferenceToolDefinitionSchema, ModelSpecsSchema };

export type {
  InferenceCancelledResponse,
  InferenceCompletedResponse,
  InferenceMessage,
  InferenceRequest,
  InferenceResponse,
  InferenceStreamingResponse,
  InferenceToolCall,
  InferenceToolDefinition,
  ModelSpecs,
};

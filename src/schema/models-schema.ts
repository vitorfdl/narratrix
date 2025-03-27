import { z } from "zod";
import { uuidUtils } from "./utils-schema";

export const ModelTypeSchema = z.enum(["llm", "audio", "image", "database"]);
export type ModelType = z.infer<typeof ModelTypeSchema>;

export const ModelSchema = z.object({
  id: uuidUtils.uuid(),
  profile_id: uuidUtils.uuid(),
  name: z.string().min(1),
  type: ModelTypeSchema,
  manifest_id: z.string(),
  config: z.record(z.string(), z.any()),
  max_concurrency: z.number().min(1).max(10).default(1),
  format_template_id: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Model = z.infer<typeof ModelSchema>;

export interface ModelGroup {
  type: ModelType;
  title: string;
  models: Model[];
}

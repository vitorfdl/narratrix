import { z } from "zod";

const baseTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  profile_id: z.string(),
  created_at: z.date(),
  updated_at: z.date(),
});

export { baseTemplateSchema };

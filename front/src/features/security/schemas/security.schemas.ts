import { z } from "zod";

export const panicModeSchema = z.object({
  preserveCurrentSession: z.boolean(),
  currentSessionId: z.string().uuid().optional().or(z.literal("")),
  reason: z.string().min(3).max(255),
});

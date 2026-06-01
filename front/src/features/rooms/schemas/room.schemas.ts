import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(600).optional().or(z.literal("")),
  visibility: z.enum(["SECRET", "PRIVATE"]),
  accessMode: z.enum(["INVITE_ONLY", "REQUEST", "OWNER_APPROVAL"]),
  requireTwoFactor: z.boolean(),
  minAccountAgeDays: z.number().min(0).max(3650),
  messageRetentionDays: z.number().min(1).max(3650).nullable(),
});

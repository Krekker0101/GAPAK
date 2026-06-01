import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(80),
  bio: z.string().max(600).optional().or(z.literal("")),
  statusMessage: z.string().max(160).optional().or(z.literal("")),
  avatarFileId: z.string().uuid().optional().or(z.literal("")),
});

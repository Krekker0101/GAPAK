import { z } from "zod";

export const createDirectChatSchema = z.object({
  participantUserId: z.string().uuid(),
});

export const sendMessageSchema = z.object({
  body: z.string().max(50000).optional().or(z.literal("")),
});

import { z } from "zod";

export const privacySchema = z.object({
  profileVisibility: z.enum(["PUBLIC", "CONNECTIONS", "TRUSTED_ONLY", "PRIVATE"]),
  lastSeenVisibility: z.enum(["EVERYONE", "CONNECTIONS", "NOBODY"]),
  allowFriendRequests: z.boolean(),
  allowTrustedInvites: z.boolean(),
  searchableByEmail: z.boolean(),
  searchableByUsername: z.boolean(),
  postDefaultPrivacy: z.enum(["PUBLIC", "FRIENDS", "TRUSTED_CIRCLE", "PRIVATE", "ONE_TIME", "TIMED"]),
  showOnlineStatus: z.boolean(),
});

import { z } from "zod";

const privacyEnum = z.enum(["PUBLIC", "FRIENDS", "TRUSTED_CIRCLE", "PRIVATE", "ONE_TIME", "TIMED"]);
const contentTypeEnum = z.enum(["POST", "CLIP"]);

export const createPostSchema = z
  .object({
    contentType: contentTypeEnum,
    body: z.string().min(1).max(5000),
    privacy: privacyEnum,
    expiresAt: z.string().optional().or(z.literal("")),
    oneTimeViewLimit: z.number().min(1).max(10).nullable(),
    audienceUserIds: z.string().optional(),
    mediaFileIds: z.string().optional(),
    uploadFile: z.any().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.contentType === "CLIP" && !value.uploadFile && !value.mediaFileIds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Добавьте видео для клипса",
        path: ["uploadFile"],
      });
    }
    if (value.privacy === "ONE_TIME" && !value.oneTimeViewLimit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set a one-time view limit",
        path: ["oneTimeViewLimit"],
      });
    }
    if (value.privacy === "TIMED" && !value.expiresAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Timed posts need an expiration moment",
        path: ["expiresAt"],
      });
    }
  });

import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(254).optional().or(z.literal("")),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9]+$/, "Use only letters and numbers"),
  displayName: z.string().min(2).max(80),
  password: z.string().min(12).max(128),
  preferAnonymous: z.boolean(),
});

export const loginSchema = z.object({
  login: z.string().min(3).max(254),
  password: z.string().min(12).max(128),
  totpCode: z.string().length(6).optional().or(z.literal("")),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  newPassword: z.string().min(12).max(128),
});

export const verifyTwoFactorSchema = z.object({
  login: z.string().min(3).max(254),
  password: z.string().min(12).max(128),
  code: z.string().length(6),
});

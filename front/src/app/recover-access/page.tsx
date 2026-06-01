"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/common/form-field";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { forgotPasswordSchema, resetPasswordSchema } from "@/features/auth/schemas/auth.schemas";
import { authService } from "@/shared/api/services/auth.service";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type ForgotValues = z.infer<typeof forgotPasswordSchema>;
type ResetValues = z.infer<typeof resetPasswordSchema>;

export default function RecoverAccessPage() {
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const forgotForm = useForm<ForgotValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: "", newPassword: "" },
  });

  const submitForgot = forgotForm.handleSubmit(async (values) => {
    setForgotError(null);
    setForgotMessage(null);
    try {
      await authService.forgotPassword(values);
      setForgotMessage("Recovery request accepted. Continue with the reset token when available.");
    } catch (error) {
      setForgotError(error instanceof Error ? error.message : "Unable to request reset");
    }
  });

  const submitReset = resetForm.handleSubmit(async (values) => {
    setResetError(null);
    setResetMessage(null);
    try {
      await authService.resetPassword(values);
      setResetMessage("Password updated. You can sign back in now.");
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "Unable to reset password");
    }
  });

  return (
    <AuthShell
      title="Recover access"
      description="Prepared for the backend recovery contract: request a reset, then finish the password change with the issued token."
      footer={
        <p>
          Back to secure entry?{" "}
          <Link href="/login" className="text-primary">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="space-y-8">
        <form className="space-y-4 rounded-[1.75rem] border border-white/8 bg-black/20 p-5" onSubmit={submitForgot}>
          <div className="space-y-2">
            <p className="font-display text-2xl font-semibold">Request reset</p>
            <p className="text-sm text-muted-foreground">Send a recovery request to the backend password recovery flow.</p>
          </div>
          <FormField label="Email" error={forgotForm.formState.errors.email?.message}>
            <Input type="email" placeholder="private@email.com" {...forgotForm.register("email")} />
          </FormField>
          {forgotMessage ? <p className="text-sm text-emerald-300">{forgotMessage}</p> : null}
          {forgotError ? <p className="text-sm text-red-300">{forgotError}</p> : null}
          <Button type="submit" variant="outline" disabled={forgotForm.formState.isSubmitting}>
            {forgotForm.formState.isSubmitting ? "Sending..." : "Request access reset"}
          </Button>
        </form>

        <form className="space-y-4 rounded-[1.75rem] border border-white/8 bg-black/20 p-5" onSubmit={submitReset}>
          <div className="space-y-2">
            <p className="font-display text-2xl font-semibold">Apply reset token</p>
            <p className="text-sm text-muted-foreground">Finalize recovery with the token issued by the backend.</p>
          </div>
          <FormField label="Reset token" error={resetForm.formState.errors.token?.message}>
            <Input placeholder="paste secure token" {...resetForm.register("token")} />
          </FormField>
          <FormField label="New password" error={resetForm.formState.errors.newPassword?.message}>
            <Input type="password" placeholder="new strong secret" {...resetForm.register("newPassword")} />
          </FormField>
          {resetMessage ? <p className="text-sm text-emerald-300">{resetMessage}</p> : null}
          {resetError ? <p className="text-sm text-red-300">{resetError}</p> : null}
          <Button type="submit" disabled={resetForm.formState.isSubmitting}>
            {resetForm.formState.isSubmitting ? "Resetting..." : "Reset password"}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}

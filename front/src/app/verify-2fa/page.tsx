"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/common/form-field";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { verifyTwoFactorSchema } from "@/features/auth/schemas/auth.schemas";
import { getDeviceFingerprint, getDeviceName } from "@/shared/lib/device";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type VerifyValues = z.infer<typeof verifyTwoFactorSchema>;

export default function VerifyTwoFactorPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<VerifyValues>({
    resolver: zodResolver(verifyTwoFactorSchema),
    defaultValues: {
      login: "",
      password: "",
      code: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login({
        login: values.login,
        password: values.password,
        totpCode: values.code,
        deviceName: getDeviceName(),
        deviceFingerprint: await getDeviceFingerprint(),
      });
      router.replace("/feed");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Verification failed");
    }
  });

  return (
    <AuthShell
      title="Verify 2FA"
      description="Complete a secure sign-in by submitting your TOTP code together with the login identity you are restoring."
      footer={
        <p>
          Need the standard flow?{" "}
          <Link href="/login" className="text-primary">
            Back to login
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <FormField label="Login" error={form.formState.errors.login?.message}>
          <Input placeholder="username or email" {...form.register("login")} />
        </FormField>
        <FormField label="Password" error={form.formState.errors.password?.message}>
          <Input type="password" placeholder="Your password" {...form.register("password")} />
        </FormField>
        <FormField label="Verification code" error={form.formState.errors.code?.message}>
          <Input placeholder="123456" inputMode="numeric" {...form.register("code")} />
        </FormField>
        {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}
        <Button className="w-full" size="lg" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Verifying..." : "Verify and continue"}
        </Button>
      </form>
    </AuthShell>
  );
}

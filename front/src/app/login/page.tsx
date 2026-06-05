"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/common/form-field";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { loginSchema } from "@/features/auth/schemas/auth.schemas";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { getDeviceFingerprint, getDeviceName } from "@/shared/lib/device";
import { localizePath, stripLocaleFromPath } from "@/shared/i18n/config";
import { LocaleLink } from "@/shared/i18n/locale-link";
import { useI18n } from "@/shared/i18n/provider";
import { ApiError } from "@/shared/types/api";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type LoginValues = z.infer<typeof loginSchema>;

function safeNextPath(rawNext: string | null) {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//") || rawNext.includes("\\")) {
    return "/feed";
  }

  return rawNext;
}


export default function LoginPage() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const login = useAuthStore((state) => state.login);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: "",
      password: "",
      totpCode: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      await login({
        login: values.login,
        password: values.password,
        totpCode: twoFactorRequired ? values.totpCode : undefined,
        deviceName: getDeviceName(),
        deviceFingerprint: await getDeviceFingerprint(),
      });
      router.replace(localizePath(stripLocaleFromPath(next), locale));
    } catch (error) {
      if (error instanceof ApiError && error.code === "auth.two_factor_required") {
        setTwoFactorRequired(true);
        form.setFocus("totpCode");
        return;
      }
      setSubmitError(error instanceof Error ? error.message : t("auth.unableSignIn"));
    }
  });

  return (
    <AuthShell
      title="Sign in"
      description="Welcome back. Use your username or email to continue."
      aside={<LanguageSwitcher compact />}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            New to Gapak? <LocaleLink href="/register" className="text-primary">Create an account</LocaleLink>
          </p>
          <LocaleLink href="/recover-access" className="text-primary">
            Forgot password
          </LocaleLink>
        </div>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <FormField label="Email or username" error={form.formState.errors.login?.message}>
          <Input placeholder="username or email" {...form.register("login")} />
        </FormField>
        <FormField label="Password" error={form.formState.errors.password?.message}>
          <Input type="password" placeholder="Minimum 12 characters" {...form.register("password")} />
        </FormField>
        {twoFactorRequired ? (
          <FormField label="Two-factor code" hint="Enter the 6-digit code from your authenticator app." error={form.formState.errors.totpCode?.message}>
            <Input placeholder="123456" inputMode="numeric" autoComplete="one-time-code" {...form.register("totpCode")} />
          </FormField>
        ) : null}

        {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}

        <Button className="w-full" size="lg" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Signing in..." : twoFactorRequired ? "Verify and sign in" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}

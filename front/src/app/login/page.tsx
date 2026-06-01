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
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type LoginValues = z.infer<typeof loginSchema>;

function safeNextPath(rawNext: string | null) {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//") || rawNext.includes("\\")) {
    return "/feed";
  }

  return rawNext;
}

const oauthProviders = [
  { name: "Apple", label: "Continue with Apple" },
  { name: "Google", label: "Continue with Google" },
  { name: "GitHub", label: "Continue with GitHub" },
];

export default function LoginPage() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const login = useAuthStore((state) => state.login);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
        totpCode: values.totpCode || undefined,
        deviceName: getDeviceName(),
        deviceFingerprint: await getDeviceFingerprint(),
      });
      router.replace(localizePath(stripLocaleFromPath(next), locale));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("auth.unableSignIn"));
    }
  });

  return (
    <AuthShell
      title="Sign in"
      description="Enter your secure workspace with a cinematic, glass-first entry point built for premium social UX."
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
        <FormField label="TOTP code" hint="Use this field when the account requires 2FA." error={form.formState.errors.totpCode?.message}>
          <Input placeholder="123456" inputMode="numeric" {...form.register("totpCode")} />
        </FormField>

        {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Button className="w-full" size="lg" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
          <Button asChild className="w-full" size="lg" variant="outline">
            <LocaleLink href="/verify-2fa">2FA verify</LocaleLink>
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            <span className="h-px flex-1 bg-white/10" />
            <span>OAuth login</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {oauthProviders.map((provider) => (
              <Button key={provider.name} type="button" variant="outline" className="w-full justify-center" disabled>
                {provider.label}
              </Button>
            ))}
          </div>
        </div>
      </form>
    </AuthShell>
  );
}

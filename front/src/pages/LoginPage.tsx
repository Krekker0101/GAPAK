import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
      navigate(localizePath(stripLocaleFromPath(next), locale));
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
    <div className="login-page-container relative">
      {/* Фоновые декоративные сферы */}
      <div className="login-page-bg-orb" />
      <div className="login-page-bg-orb" />
      <div className="login-page-bg-orb" />

      <AuthShell
        title="Sign in"
        description="Welcome back. Use your username or email to continue."
        aside={<LanguageSwitcher compact />}
        footer={
          <div className="form-tabs" style={{ animation: "login-form-pop 0.8s 0.6s both" }}>
            <LocaleLink href="/register" className="tab-card">
              <span className="plus-icon">+</span>
              <span className="sr-only">Create an account</span>
            </LocaleLink>
            <LocaleLink href="/recover-access" className="tab-card">
              <span className="forgot-link">Forgot password</span>
            </LocaleLink>
          </div>
        }
      >
        <form className="space-y-5 login-form-enter" onSubmit={onSubmit}>
          <div>
            <FormField className="floating" label="Email or username" error={form.formState.errors.login?.message}>
              <Input
                className="login-input-glow"
                placeholder="Enter your credentials"
                {...form.register("login")}
              />
            </FormField>
          </div>
          <div>
            <FormField className="floating" label="Password" error={form.formState.errors.password?.message}>
              <Input
                type="password"
                className="login-input-glow"
                placeholder=""
                {...form.register("password")}
              />
            </FormField>
          </div>

          {twoFactorRequired && (
            <div className="login-totp-reveal">
              <FormField
                label="Two-factor code"
                hint="Enter the 6-digit code from your authenticator app."
                error={form.formState.errors.totpCode?.message}
              >
                <Input
                  className="login-input-glow"
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  {...form.register("totpCode")}
                />
              </FormField>
            </div>
          )}

          {submitError && (
            <p className="text-sm text-red-400 font-medium login-error">
              {submitError}
            </p>
          )}

          <div>
            <Button
              className="w-full login-button auth-cta"
              size="lg"
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Signing in...
                </span>
              ) : twoFactorRequired ? (
                <>
                  <span className="cta-text">Verify and sign in</span>
                  <span className="cta-arrow" aria-hidden>→</span>
                </>
              ) : (
                <>
                  <span className="cta-text">Sign in</span>
                  <span className="cta-arrow" aria-hidden>→</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </AuthShell>
    </div>
  );
}
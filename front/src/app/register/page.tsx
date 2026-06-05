"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/common/form-field";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { registerSchema } from "@/features/auth/schemas/auth.schemas";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { getDeviceFingerprint, getDeviceName } from "@/shared/lib/device";
import { localizePath } from "@/shared/i18n/config";
import { LocaleLink } from "@/shared/i18n/locale-link";
import { useI18n } from "@/shared/i18n/provider";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";

type RegisterValues = z.infer<typeof registerSchema>;


export default function RegisterPage() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const registerAnonymous = useAuthStore((state) => state.registerAnonymous);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      username: "",
      displayName: "",
      password: "",
      preferAnonymous: true,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      const payload = {
        email: values.email || undefined,
        username: values.username,
        displayName: values.displayName,
        password: values.password,
        preferAnonymous: values.preferAnonymous,
        deviceName: getDeviceName(),
        deviceFingerprint: await getDeviceFingerprint(),
      };

      if (values.preferAnonymous) {
        await registerAnonymous(payload);
      } else {
        await register(payload);
      }

      router.replace(localizePath("/feed", locale));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("auth.unableRegister"));
    }
  });

  return (
    <AuthShell
      title="Create account"
      description="Choose a name, set a strong password, and decide whether this account should stay anonymous."
      aside={<LanguageSwitcher compact />}
      footer={
        <p>
          Already inside Gapak? <LocaleLink href="/login" className="text-primary">Sign in</LocaleLink>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <FormField label="Email" hint="Optional for anonymity-first signups" error={form.formState.errors.email?.message}>
          <Input type="email" placeholder="optional@secure.mail" {...form.register("email")} />
        </FormField>
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Username" error={form.formState.errors.username?.message}>
            <Input placeholder="gapakuser" {...form.register("username")} />
          </FormField>
          <FormField label="Display name" error={form.formState.errors.displayName?.message}>
            <Input placeholder="Private Alias" {...form.register("displayName")} />
          </FormField>
        </div>
        <FormField label="Password" hint="Use a strong secret with at least 12 characters" error={form.formState.errors.password?.message}>
          <Input type="password" placeholder="Minimum 12 characters" {...form.register("password")} />
        </FormField>
        <div className="flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
          <div>
            <p className="text-sm font-medium">Anonymous account</p>
            <p className="text-xs leading-6 text-muted-foreground">Hide email from signup and use a pseudonymous profile. Recovery may be limited.</p>
          </div>
          <Switch checked={form.watch("preferAnonymous")} onCheckedChange={(checked) => form.setValue("preferAnonymous", checked)} />
        </div>

        {submitError ? <p className="text-sm text-red-300">{submitError}</p> : null}

        <Button className="w-full" size="lg" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}

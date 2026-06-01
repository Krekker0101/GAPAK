"use client";

import { Languages } from "lucide-react";

import { localeMeta, supportedLocales, type Locale } from "@/shared/i18n/config";
import { useI18n } from "@/shared/i18n/provider";
import { cn } from "@/shared/lib/utils";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, changeLocale, isPending, t } = useI18n();

  return (
    <div
      className={cn(
        "language-switcher group inline-flex items-center rounded-full border border-white/10 bg-white/[0.055] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl",
        compact ? "gap-1" : "gap-1.5",
        isPending && "opacity-80",
      )}
      aria-label={t("language.helper")}
      title={t("language.helper")}
    >
      {!compact ? (
        <span className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition group-hover:text-foreground">
          <Languages className="h-4 w-4" />
        </span>
      ) : null}
      {supportedLocales.map((item) => {
        const active = item === locale;
        return (
          <button
            key={item}
            type="button"
            onClick={() => changeLocale(item)}
            className={cn(
              "relative h-9 rounded-full px-3 text-xs font-semibold tracking-[0.14em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary text-primary-foreground shadow-[0_12px_40px_rgba(67,210,202,0.24)]"
                : "text-muted-foreground hover:bg-white/8 hover:text-foreground",
            )}
            aria-pressed={active}
            aria-label={localeMeta[item as Locale].nativeLabel}
          >
            {localeMeta[item as Locale].shortLabel}
          </button>
        );
      })}
    </div>
  );
}

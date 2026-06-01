"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  defaultLocale,
  getLocaleFromPath,
  isLocale,
  localeCookieName,
  localeMeta,
  localizePath,
  type Locale,
} from "@/shared/i18n/config";
import { dictionaries, readDictionaryValue } from "@/shared/i18n/dictionaries";

type TranslateOptions = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  isPending: boolean;
  t: (key: string, options?: TranslateOptions) => string;
  changeLocale: (nextLocale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(message: string, options?: TranslateOptions) {
  if (!options) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (_, key: string) => String(options[key] ?? `{${key}}`));
}

function persistLocale(locale: Locale) {
  document.documentElement.lang = localeMeta[locale].htmlLang;
  localStorage.setItem(localeCookieName, locale);
  document.cookie = `${localeCookieName}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    const localeFromPath = getLocaleFromPath(pathname);
    if (localeFromPath && localeFromPath !== locale) {
      setLocale(localeFromPath);
      persistLocale(localeFromPath);
      return;
    }

    if (!localeFromPath) {
      const storedLocale = localStorage.getItem(localeCookieName);
      if (isLocale(storedLocale) && storedLocale !== locale) {
        setLocale(storedLocale);
        persistLocale(storedLocale);
      }
    }
  }, [locale, pathname]);

  const t = useCallback(
    (key: string, options?: TranslateOptions) => {
      const message =
        readDictionaryValue(dictionaries[locale], key) ??
        readDictionaryValue(dictionaries[defaultLocale], key) ??
        key;

      return interpolate(message, options);
    },
    [locale],
  );

  const changeLocale = useCallback(
    (nextLocale: Locale) => {
      if (nextLocale === locale) {
        return;
      }

      setLocale(nextLocale);
      persistLocale(nextLocale);

      const nextPath = `${localizePath(pathname, nextLocale)}${window.location.search}${window.location.hash}`;
      startTransition(() => {
        router.replace(nextPath, { scroll: false });
      });
    },
    [locale, pathname, router],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      isPending,
      t,
      changeLocale,
    }),
    [changeLocale, isPending, locale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return value;
}

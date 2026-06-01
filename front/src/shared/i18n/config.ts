export const supportedLocales = ["en", "ru", "tj"] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = "en";
export const localeCookieName = "gapak_locale";
export const localeHeaderName = "x-gapak-locale";

export const localeMeta: Record<
  Locale,
  {
    label: string;
    nativeLabel: string;
    shortLabel: string;
    htmlLang: string;
  }
> = {
  en: {
    label: "English",
    nativeLabel: "English",
    shortLabel: "EN",
    htmlLang: "en",
  },
  ru: {
    label: "Russian",
    nativeLabel: "Русский",
    shortLabel: "RU",
    htmlLang: "ru",
  },
  tj: {
    label: "Tajik",
    nativeLabel: "Тоҷикӣ",
    shortLabel: "TJ",
    htmlLang: "tg",
  },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return supportedLocales.includes(value as Locale);
}

export function normalizeLocale(value: string | undefined | null): Locale {
  if (!value) {
    return defaultLocale;
  }

  const normalized = value.toLowerCase().split("-")[0];
  return isLocale(normalized) ? normalized : defaultLocale;
}

export function detectLocaleFromAcceptLanguage(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  const preferred = acceptLanguage
    .split(",")
    .map((part) => normalizeLocale(part.trim().split(";")[0]))
    .find((locale) => isLocale(locale));

  return preferred ?? defaultLocale;
}

export function getLocaleFromPath(pathname: string): Locale | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return isLocale(firstSegment) ? firstSegment : null;
}

export function stripLocaleFromPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (isLocale(segments[0])) {
    const stripped = `/${segments.slice(1).join("/")}`;
    return stripped === "/" ? "/" : stripped.replace(/\/+$/, "");
  }

  return pathname || "/";
}

export function localizePath(pathname: string, locale: Locale): string {
  const cleanPath = stripLocaleFromPath(pathname);
  if (cleanPath === "/") {
    return `/${locale}`;
  }

  return `/${locale}${cleanPath}`;
}

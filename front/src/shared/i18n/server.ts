import { cookies, headers } from "next/headers";

import {
  defaultLocale,
  detectLocaleFromAcceptLanguage,
  isLocale,
  localeCookieName,
  localeHeaderName,
  type Locale,
} from "@/shared/i18n/config";

export async function getRequestLocale(): Promise<Locale> {
  const [headerStore, cookieStore] = await Promise.all([headers(), cookies()]);
  const middlewareLocale = headerStore.get(localeHeaderName);
  if (isLocale(middlewareLocale)) {
    return middlewareLocale;
  }

  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  return detectLocaleFromAcceptLanguage(headerStore.get("accept-language")) ?? defaultLocale;
}

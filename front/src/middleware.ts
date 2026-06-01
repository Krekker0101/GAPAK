import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/shared/config/env";
import {
  defaultLocale,
  detectLocaleFromAcceptLanguage,
  getLocaleFromPath,
  isLocale,
  localeCookieName,
  localeHeaderName,
  localizePath,
  stripLocaleFromPath,
  type Locale,
} from "@/shared/i18n/config";

const protectedPrefixes = ["/feed", "/clips", "/profile", "/chats", "/rooms", "/posts", "/settings", "/admin"];
const authPrefixes = ["/login", "/register", "/verify-2fa", "/recover-access"];
const adminPrefixes = ["/admin"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function preferredLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(localeCookieName)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  return detectLocaleFromAcceptLanguage(request.headers.get("accept-language"));
}

function withLocaleHeader(request: NextRequest, locale: Locale) {
  const headers = new Headers(request.headers);
  headers.set(localeHeaderName, locale);
  return headers;
}

function setLocaleCookie(response: NextResponse, locale: Locale) {
  response.cookies.set(localeCookieName, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = getLocaleFromPath(pathname);

  if (!locale) {
    const nextLocale = preferredLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = localizePath(pathname, nextLocale);
    const response = NextResponse.redirect(url);
    setLocaleCookie(response, nextLocale);
    return response;
  }

  const pathWithoutLocale = stripLocaleFromPath(pathname);
  const hasHint = request.cookies.get(publicEnv.authHintCookie)?.value === "1";

  if (matchesPrefix(pathWithoutLocale, adminPrefixes) && !hasHint) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", pathname);
    const response = NextResponse.redirect(url);
    setLocaleCookie(response, locale);
    return response;
  }

  if (matchesPrefix(pathWithoutLocale, protectedPrefixes) && !hasHint) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", pathname);
    const response = NextResponse.redirect(url);
    setLocaleCookie(response, locale);
    return response;
  }

  if (matchesPrefix(pathWithoutLocale, authPrefixes) && hasHint) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/feed`;
    url.search = "";
    const response = NextResponse.redirect(url);
    setLocaleCookie(response, locale);
    return response;
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = pathWithoutLocale === "/" ? "/" : pathWithoutLocale;

  const response = NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: withLocaleHeader(request, locale ?? defaultLocale),
    },
  });
  setLocaleCookie(response, locale);
  response.headers.set("Content-Language", locale);
  response.headers.append("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|robots.txt|sitemap.xml|api|.*\\..*).*)"],
};

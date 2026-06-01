import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";

import { I18nProvider } from "@/shared/i18n/provider";
import { getRequestLocale } from "@/shared/i18n/server";
import { localeMeta } from "@/shared/i18n/config";
import { publicEnv } from "@/shared/config/env";

export const metadata: Metadata = {
  title: `${publicEnv.appName} | Private Social Network`,
  description:
    "Gapak is a premium privacy-first social network focused on trusted spaces, secure messaging, and controlled visibility.",
  alternates: {
    languages: {
      en: "/en",
      ru: "/ru",
      tg: "/tj",
    },
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();

  return (
    <html lang={localeMeta[locale].htmlLang} className="dark">
      <body className="min-h-screen antialiased">
        <div className="page-shell">
          <I18nProvider initialLocale={locale}>{children}</I18nProvider>
        </div>
      </body>
    </html>
  );
}

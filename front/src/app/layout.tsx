import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";

import "@/app/globals.css";

import { I18nProvider } from "@/shared/i18n/provider";
import { getRequestLocale } from "@/shared/i18n/server";
import { localeMeta } from "@/shared/i18n/config";
import { publicEnv } from "@/shared/config/env";

const hydrationAttributeSanitizer = `
(function () {
  var blockedExact = { bis_skin_checked: true, bis_register: true };
  var blockedPrefix = "__processed_";

  function cleanNode(node) {
    if (!node || node.nodeType !== 1 || !node.attributes) {
      return;
    }

    var attributes = Array.prototype.slice.call(node.attributes);
    for (var i = 0; i < attributes.length; i += 1) {
      var name = attributes[i].name;
      if (blockedExact[name] || name.indexOf(blockedPrefix) === 0) {
        node.removeAttribute(name);
      }
    }
  }

  function cleanTree() {
    cleanNode(document.documentElement);
    if (document.body) {
      cleanNode(document.body);
    }

    var nodes = document.querySelectorAll("*");
    for (var i = 0; i < nodes.length; i += 1) {
      cleanNode(nodes[i]);
    }
  }

  cleanTree();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cleanTree, { once: true });
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i += 1) {
      cleanNode(mutations[i].target);
      for (var j = 0; j < mutations[i].addedNodes.length; j += 1) {
        cleanNode(mutations[i].addedNodes[j]);
      }
    }
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true
  });

  window.setTimeout(cleanTree, 0);
  window.setTimeout(cleanTree, 50);
  window.setTimeout(cleanTree, 250);
  window.setTimeout(function () {
    cleanTree();
    observer.disconnect();
  }, 3000);
})();
`;

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
    <html lang={localeMeta[locale].htmlLang} className="dark" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Script
          id="hydration-attribute-sanitizer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: hydrationAttributeSanitizer }}
        />
        <div className="page-shell">
          <I18nProvider initialLocale={locale}>{children}</I18nProvider>
        </div>
      </body>
    </html>
  );
}

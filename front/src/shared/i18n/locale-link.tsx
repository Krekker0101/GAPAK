"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

import { localizePath } from "@/shared/i18n/config";
import { useI18n } from "@/shared/i18n/provider";

type LocaleLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children: ReactNode;
  };

export function LocaleLink({ href, children, ...props }: LocaleLinkProps) {
  const { locale } = useI18n();
  const localizedHref = typeof href === "string" && href.startsWith("/") ? localizePath(href, locale) : href;

  return (
    <Link href={localizedHref} {...props}>
      {children}
    </Link>
  );
}

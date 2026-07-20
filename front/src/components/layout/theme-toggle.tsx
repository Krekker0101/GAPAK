"use client";

import { useEffect, useState } from "react";
import { MoonStar, SunMedium } from "lucide-react";

import { Button } from "@/shared/ui/button";

const THEME_STORAGE_KEY = "gapak-theme";

function applyTheme(theme: "dark" | "light") {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as "dark" | "light" | null;
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const initial = stored ?? (prefersLight ? "light" : "dark");
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="shrink-0"
    >
      {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </Button>
  );
}

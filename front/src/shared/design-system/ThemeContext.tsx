/**
 * GAPAK Theme Provider
 * Supports 'light', 'dark', and 'system' themes.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeMode } from '../types';

interface ThemeOrigin {
  x: number;
  y: number;
}

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode, origin?: ThemeOrigin) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('gapak_theme') as ThemeMode) || 'light';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (mode: ThemeMode) => {
      let active: 'light' | 'dark' = 'light';
      if (mode === 'system') {
        active = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        active = mode;
      }

      setResolvedTheme(active);

      if (active === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme(theme);
    localStorage.setItem('gapak_theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const setTheme = (mode: ThemeMode, origin?: ThemeOrigin) => {
    if (mode === theme) return;

    const root = document.documentElement;
    const body = document.body;
    const previousColor = getComputedStyle(root).getPropertyValue('--color-bg').trim() || '#ffffff';
    const apply = () => setThemeState(mode);

    // Where the reveal circle should originate from - the toggle button by
    // default, falling back to the viewport center if we weren't given a
    // click position (e.g. triggered programmatically).
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight / 2;
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    root.style.setProperty('--vt-x', `${x}px`);
    root.style.setProperty('--vt-y', `${y}px`);
    root.style.setProperty('--vt-radius', `${Math.ceil(maxRadius)}px`);

    // Read the *native* method off document.startViewTransition right before
    // calling it, and always call it as document.startViewTransition(...) -
    // it's a regular DOM method and throws "Illegal invocation" if invoked
    // detached from its `this` (document).
    const supportsViewTransitions =
      typeof document !== 'undefined' &&
      typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    body.classList.add('theme-transitioning');

    if (supportsViewTransitions) {
      const transition = (document as Document & {
        startViewTransition: (callback: () => void) => { finished: Promise<void> };
      }).startViewTransition(apply);
      transition.finished.finally(() => body.classList.remove('theme-transitioning'));
    } else {
      const overlay = document.createElement('div');
      overlay.className = 'theme-transition-overlay';
      overlay.style.setProperty('--theme-transition-color', previousColor);
      document.body.appendChild(overlay);
      apply();
      window.setTimeout(() => overlay.remove(), 620);
      window.setTimeout(() => body.classList.remove('theme-transitioning'), 620);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};

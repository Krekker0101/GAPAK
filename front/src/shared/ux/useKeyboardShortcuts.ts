/**
 * GAPAK Global Keyboard Shortcuts Engine
 */

import { useEffect } from 'react';

export interface ShortcutDefinition {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description?: string;
}

export const useKeyboardShortcuts = (shortcuts: ShortcutDefinition[]) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut inputs inside active input/textarea elements unless explicitly targetable
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        // Exception for Ctrl+K search surface or Escape
        if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') && e.key !== 'Escape') {
          return;
        }
      }

      for (const sc of shortcuts) {
        const matchesKey = e.key.toLowerCase() === sc.key.toLowerCase();
        const matchesCtrl = sc.ctrlKey === undefined || e.ctrlKey === sc.ctrlKey;
        const matchesAlt = sc.altKey === undefined || e.altKey === sc.altKey;
        const matchesShift = sc.shiftKey === undefined || e.shiftKey === sc.shiftKey;
        const matchesMeta = sc.metaKey === undefined || e.metaKey === sc.metaKey;

        if (matchesKey && matchesCtrl && matchesAlt && matchesShift && matchesMeta) {
          e.preventDefault();
          sc.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

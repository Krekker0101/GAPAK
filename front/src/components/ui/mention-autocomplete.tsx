"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { getCurrentMention } from "@/shared/lib/mention-utils";
import type { MentionSuggestion } from "@/shared/types/notification";
import { useDebounce } from "@/shared/lib/hooks/use-debounce";

interface MentionAutocompleteProps {
  text: string;
  cursorPosition: number;
  onSelect: (username: string, displayName: string) => void;
  onClose: () => void;
  containerRef: React.RefObject<HTMLElement>;
}

export function MentionAutocomplete({ text, cursorPosition, onSelect, onClose, containerRef }: MentionAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentMention = getCurrentMention(text, cursorPosition);
  const debouncedSearch = useDebounce(currentMention || "", 300);

  // Calculate dropdown position
  useEffect(() => {
    if (containerRef.current && currentMention) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
      });
    }
  }, [containerRef, currentMention]);

  // Fetch suggestions from API
  useEffect(() => {
    async function fetchSuggestions() {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/users/search?q=${debouncedSearch}`);
        // const data = await response.json();
        // setSuggestions(data);
        
        // Mock data for now
        const mockSuggestions: MentionSuggestion[] = [
          { id: "1", username: "john", displayName: "John Smith", isVerified: true },
          { id: "2", username: "johnny", displayName: "Johnny Appleseed", isVerified: false },
          { id: "3", username: "jordan", displayName: "Jordan Peterson", isVerified: true },
          { id: "4", username: "joshua", displayName: "Joshua Brown", isVerified: false },
        ].filter((user) => 
          user.username.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          user.displayName.toLowerCase().includes(debouncedSearch.toLowerCase())
        );
        
        setSuggestions(mockSuggestions);
      } catch (error) {
        console.error("Failed to fetch mention suggestions:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSuggestions();
  }, [debouncedSearch]);

  // Close dropdown when mention is complete
  useEffect(() => {
    if (!currentMention) {
      onClose();
    }
  }, [currentMention, onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!currentMention || suggestions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = suggestions[selectedIndex];
        if (selected) {
          onSelect(selected.username, selected.displayName);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentMention, suggestions, selectedIndex, onSelect, onClose]);

  const handleSelect = useCallback((suggestion: MentionSuggestion) => {
    onSelect(suggestion.username, suggestion.displayName);
  }, [onSelect]);

  if (!currentMention || currentMention.length < 2) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={dropdownRef}
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed z-50 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        style={{ top: position.top, left: position.left }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <Search className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Mentioning @{currentMention}
          </span>
        </div>

        {/* Suggestions */}
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500 dark:text-slate-400">
              <User className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSelect(suggestion)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  index === selectedIndex
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={suggestion.avatar} alt={suggestion.displayName} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                    {suggestion.displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">
                      {suggestion.displayName}
                    </span>
                    {suggestion.isVerified && (
                      <div className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    @{suggestion.username}
                  </span>
                </div>

                {index === selectedIndex && (
                  <Check className="w-4 h-4 text-blue-500" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Use ↑ ↓ to navigate, Enter to select
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

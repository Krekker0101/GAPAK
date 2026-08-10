/**
 * GAPAK Global Command Surface & Search Palette
 * Command shortcut: Ctrl + K / Cmd + K
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  User,
  Users,
  Rss,
  MessageSquare,
  Shield,
  Video,
  Flame,
  Settings,
  Sparkles,
  Command,
  ArrowRight,
  X,
  Radio,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { DomainKey } from '../types';

export interface CommandItem {
  id: string;
  domain: DomainKey;
  title: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDomain: (domain: DomainKey) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onSelectDomain }) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = [
    {
      id: 'cmd_feed',
      domain: 'posts',
      title: 'Posts & Feed',
      description: 'Explore global feed, trending posts, and media',
      icon: <Rss className="w-4 h-4 text-indigo-400" />,
      shortcut: 'G F',
      action: () => {
        onSelectDomain('posts');
        onClose();
      },
    },
    {
      id: 'cmd_trust_rooms',
      domain: 'trust-rooms',
      title: 'Trust Rooms',
      description: 'Enter encrypted trust rooms and audio stages',
      icon: <Lock className="w-4 h-4 text-emerald-400" />,
      shortcut: 'G T',
      action: () => {
        onSelectDomain('trust-rooms');
        onClose();
      },
    },
    {
      id: 'cmd_chats',
      domain: 'chats',
      title: 'Direct Chats & Groups',
      description: 'Real-time encrypted messaging and presence',
      icon: <MessageSquare className="w-4 h-4 text-sky-400" />,
      shortcut: 'G C',
      action: () => {
        onSelectDomain('chats');
        onClose();
      },
    },
    {
      id: 'cmd_users',
      domain: 'users',
      title: 'User Profile & Trust',
      description: 'Manage profile details, bio, trust score, and security settings',
      icon: <User className="w-4 h-4 text-secondary" />,
      shortcut: 'G U',
      action: () => {
        onSelectDomain('users');
        onClose();
      },
    },
    {
      id: 'cmd_connections',
      domain: 'connections',
      title: 'Connections & Network',
      description: 'Explore social graph, followers, mutual networks, and requests',
      icon: <Users className="w-4 h-4 text-teal-400" />,
      action: () => {
        onSelectDomain('connections');
        onClose();
      },
    },
    {
      id: 'cmd_subscriptions',
      domain: 'subscriptions',
      title: 'Subscriptions & Tier Pass',
      description: 'Manage creator memberships and tier access passes',
      icon: <Sparkles className="w-4 h-4 text-purple-400" />,
      action: () => {
        onSelectDomain('subscriptions');
        onClose();
      },
    },
    {
      id: 'cmd_stories',
      domain: 'stories',
      title: 'Ephemeral Stories',
      description: 'View and create 24-hour video/photo stories and reactions',
      icon: <Video className="w-4 h-4 text-pink-400" />,
      action: () => {
        onSelectDomain('stories');
        onClose();
      },
    },
    {
      id: 'cmd_battles',
      domain: 'battles',
      title: 'Battles & Arena',
      description: 'Live 1v1 battles, audience voting, and arena stages',
      icon: <Flame className="w-4 h-4 text-amber-400" />,
      action: () => {
        onSelectDomain('battles');
        onClose();
      },
    },
    {
      id: 'cmd_trust_rooms',
      domain: 'trust-rooms',
      title: 'Trust Rooms & Governance Enclaves',
      description: 'Private encrypted rooms with 2FA enforcement and zero-knowledge policies',
      icon: <Lock className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onSelectDomain('trust-rooms');
        onClose();
      },
    },
    {
      id: 'cmd_live',
      domain: 'live',
      title: 'Live Streams',
      description: 'Watch live broadcasts and interactive streams',
      icon: <Radio className="w-4 h-4 text-rose-400" />,
      action: () => {
        onSelectDomain('live');
        onClose();
      },
    },
    {
      id: 'cmd_security',
      domain: 'security',
      title: 'Security & Key Vault Center',
      description: 'Sessions, 2FA setup, audit timeline, alerts, and Panic Mode',
      icon: <ShieldAlert className="w-4 h-4 text-indigo-400" />,
      action: () => {
        onSelectDomain('security');
        onClose();
      },
    },
    {
      id: 'cmd_moderation',
      domain: 'moderation',
      title: 'Moderation Portal & Reports',
      description: 'Submit user reports, review moderation history and flags',
      icon: <Shield className="w-4 h-4 text-purple-400" />,
      action: () => {
        onSelectDomain('moderation');
        onClose();
      },
    },
    {
      id: 'cmd_admin',
      domain: 'admin',
      title: 'Admin Console',
      description: 'System metrics, user roles, security, and telemetry',
      icon: <Settings className="w-4 h-4 text-tertiary" />,
      action: () => {
        onSelectDomain('admin');
        onClose();
      },
    },
  ];

  const filteredCommands = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.domain.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setSearch('');
      }

      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-app-glass backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          className="relative w-full max-w-xl bg-surface border border-subtle rounded-[var(--radius-2xl)] shadow-token-lg overflow-hidden z-10 flex flex-col"
        >
          {/* Header Input */}
          <div className="p-3.5 border-b border-subtle flex items-center gap-3">
            <Search className="w-5 h-5 text-indigo-400 flex-shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Search domains, features, commands... (Ctrl+K)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm text-primary placeholder-slate-500 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-muted hover:text-secondary">
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-tertiary bg-surface-muted px-2 py-0.5 rounded border border-default">
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <div className="p-2 max-h-80 overflow-y-auto space-y-1">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted">
                No matching domains or commands found.
              </div>
            ) : (
              filteredCommands.map((cmd, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full p-2.5 rounded-[var(--radius-xl)] text-left flex items-center gap-3 transition-colors ${
                      isSelected ? 'bg-indigo-600/15 border border-indigo-500/30' : 'hover:bg-surface-glass'
                    }`}
                  >
                    <div className="p-2 bg-surface-glass rounded-[var(--radius-lg)]">{cmd.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-primary flex items-center gap-2">
                        <span>{cmd.title}</span>
                        <span className="text-[10px] text-muted bg-surface-glass px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                          {cmd.domain}
                        </span>
                      </div>
                      <p className="text-[11px] text-tertiary truncate mt-0.5">{cmd.description}</p>
                    </div>
                    {cmd.shortcut && (
                      <kbd className="text-[10px] font-mono text-muted bg-surface-muted px-1.5 py-0.5 rounded border border-default">
                        {cmd.shortcut}
                      </kbd>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 text-muted transition-transform ${isSelected ? 'translate-x-1 text-indigo-400' : ''}`} />
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Info */}
          <div className="p-2.5 bg-app-glass border-t border-subtle text-[11px] text-muted flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Command className="w-3.5 h-3.5 text-indigo-400" />
              <span>GAPAK Search Surface</span>
            </span>
            <div className="flex items-center gap-3">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

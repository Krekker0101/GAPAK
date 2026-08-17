/**
 * GAPAK Global Application Shell
 * Features:
 * - Desktop Sidebar with domain navigation & active indicators
 * - Mobile Navigation bar & Drawer
 * - Command Palette (Ctrl+K) trigger
 * - Theme Switcher (Light / Dark / System)
 * - Presence Selector & Profile Menu
 * - Notifications Entry Popover
 * - Offline / Network State Indicator
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Rss,
  MessageSquare,
  Lock,
  Flame,
  Radio,
  Settings,
  User,
  Users,
  Search,
  Bell,
  Sun,
  Moon,
  Monitor,
  Menu,
  ChevronRight,
  LogOut,
  WifiOff,
  Sparkles,
  Command,
  Circle,
  Key,
  KeyRound,
  ShieldAlert,
  Sliders,
  Check,
  Video,
} from 'lucide-react';
import { DomainKey, PresenceStatus } from '../../shared/types';
import { useAuth } from '../../domains/auth/AuthContext';
import { useTheme } from '../../shared/design-system/ThemeContext';
import { useNetworkState } from '../../shared/ux/useNetworkState';
import { CommandPalette } from '../../shared/ux/CommandPalette';
import { Avatar, Badge, IconButton } from '../../shared/design-system/primitives';
import { DOMAINS_REGISTRY } from '../../domains';
import { GlobalUploadCenter } from '../../domains/media/GlobalUploadCenter';
import { UploadRecoveryPrompt } from '../../domains/media/UploadRecoveryPrompt';
import { PermissionGuard } from '../../shared/permissions/permissions';
import { NotificationsController } from '../../domains/notifications/NotificationsController';
import { isNotificationRead } from '../../domains/notifications/notificationsState';
import { useToast } from '../../shared/ux/ToastContext';

interface AppShellProps {
  children: React.ReactNode;
}

const DOMAIN_PATHS: Record<DomainKey, string> = {
  auth: '/auth/login', users: '/users/me', connections: '/connections', subscriptions: '/subscriptions',
  posts: '/posts', stories: '/stories', chats: '/chats', media: '/media', presence: '/presence', live: '/live',
  'trust-rooms': '/trust-rooms', battles: '/battles', moderation: '/moderation', admin: '/admin', security: '/security',
};

const domainFromPath = (pathname: string): DomainKey => {
  if (pathname === '/' || pathname === '/posts' || pathname.startsWith('/posts/')) return 'posts';
  if (pathname.startsWith('/@') || pathname.startsWith('/users')) return 'users';
  if (pathname.startsWith('/chats')) return 'chats';
  if (pathname.startsWith('/stories')) return 'stories';
  if (pathname.startsWith('/live')) return 'live';
  if (pathname.startsWith('/media')) return 'media';
  if (pathname.startsWith('/trust-rooms')) return 'trust-rooms';
  if (pathname.startsWith('/connections')) return 'connections';
  if (pathname.startsWith('/subscriptions')) return 'subscriptions';
  if (pathname.startsWith('/security')) return 'security';
  if (pathname.startsWith('/moderation')) return 'moderation';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/presence')) return 'presence';
  if (pathname.startsWith('/battles')) return 'battles';
  return 'posts';
};

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentDomain = useMemo(() => domainFromPath(location.pathname), [location.pathname]);
  const onNavigate = (domain: DomainKey) => navigate(DOMAIN_PATHS[domain]);
  const { user, logout, setPresenceStatus } = useAuth();
  const toast = useToast();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const network = useNetworkState();
  const notificationsController = useRef(new NotificationsController()).current;
  const [notificationsState, setNotificationsState] = useState(notificationsController.getState());
  const [unreadCount, setUnreadCount] = useState(notificationsController.getUnreadCount());
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState(false);
  const [loadingMoreNotifications, setLoadingMoreNotifications] = useState(false);
  const [notificationMutationError, setNotificationMutationError] = useState(false);
  const notifications = notificationsState.items;

  useEffect(() => {
    const controller = new AbortController();
    setNotificationsLoading(true);
    setNotificationsError(false);
    void notificationsController.loadInitial(controller.signal)
      .then(() => {
        setNotificationsState(notificationsController.getState());
        setUnreadCount(notificationsController.getUnreadCount());
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setNotificationsError(true);
      })
      .finally(() => setNotificationsLoading(false));
    return () => controller.abort();
  }, [notificationsController]);

  const markRead = async (id: string) => {
    setNotificationMutationError(false);
    const previousState = notificationsController.getState();
    const previousUnread = notificationsController.getUnreadCount();
    setNotificationsState({ ...previousState, optimisticReadIds: new Set([...previousState.optimisticReadIds, id]) });
    try {
      await notificationsController.markRead(id);
      setNotificationsState(notificationsController.getState());
      setUnreadCount(notificationsController.getUnreadCount());
    } catch {
      setNotificationsState(previousState);
      setUnreadCount(previousUnread);
      setNotificationMutationError(true);
    }
  };

  const markAllRead = async () => {
    setNotificationMutationError(false);
    const previousState = notificationsController.getState();
    const previousUnread = notificationsController.getUnreadCount();
    setNotificationsState({ ...previousState, optimisticReadIds: new Set(previousState.items.map((item) => item.id)) });
    setUnreadCount(0);
    try {
      await notificationsController.markAllRead();
      setNotificationsState(notificationsController.getState());
      setUnreadCount(notificationsController.getUnreadCount());
    } catch {
      setNotificationsState(previousState);
      setUnreadCount(previousUnread);
      setNotificationMutationError(true);
    }
  };

  const loadMoreNotifications = async () => {
    if (loadingMoreNotifications || !notificationsState.hasMore) return;
    setLoadingMoreNotifications(true);
    try {
      await notificationsController.loadMore();
      setNotificationsState(notificationsController.getState());
    } catch {
      setNotificationMutationError(true);
    } finally {
      setLoadingMoreNotifications(false);
    }
  };



  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const mainDomainKeys: DomainKey[] = [
    'posts',
    'chats',
    'live',
    'trust-rooms',
    'battles',
    'users',
    'connections',
    'subscriptions',
    'stories',
    'media',
    'moderation',
    'admin',
  ];

  const getDomainIcon = (key: DomainKey) => {
    switch (key) {
      case 'posts':
        return <Rss className="w-4 h-4 text-indigo-400" />;
      case 'chats':
        return <MessageSquare className="w-4 h-4 text-sky-400" />;
      case 'live':
        return <Radio className="w-4 h-4 text-rose-500" />;
      case 'trust-rooms':
        return <Lock className="w-4 h-4 text-emerald-400" />;
      case 'battles':
        return <Flame className="w-4 h-4 text-amber-500" />;
      case 'users':
        return <User className="w-4 h-4 text-secondary" />;
      case 'connections':
        return <Users className="w-4 h-4 text-teal-400" />;
      case 'subscriptions':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'stories':
        return <Circle className="w-4 h-4 text-pink-400" />;
      case 'media':
        return <Sliders className="w-4 h-4 text-indigo-300" />;
      case 'moderation':
        return <Shield className="w-4 h-4 text-purple-400" />;
      case 'admin':
        return <Settings className="w-4 h-4 text-tertiary" />;
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  const currentDomainMeta = DOMAINS_REGISTRY[currentDomain];

  return (
    <div className="min-h-screen app-shell-surface text-primary flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[var(--z-popover)] focus:rounded-[var(--radius-lg)] focus:bg-surface focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-primary focus:shadow-token-md">Skip to main content</a>

      {/* Offline Alert Bar */}
      {!network.isOnline && (
        <div role="status" aria-live="polite" className="bg-amber-500 text-on-brand px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-token-md z-50">
          <WifiOff className="w-4 h-4" />
          <span>Offline mode active. Reconnecting to GAPAK nodes automatically...</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden md:p-3 md:gap-3">
        {/* ========================================== */}
        {/* DESKTOP SIDEBAR - floating glass panel      */}
        {/* ========================================== */}
        <aside
          className={`hidden md:flex flex-col overflow-hidden rounded-[var(--radius-2xl)] border border-white/10 bg-surface-glass-strong backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_60px_-20px_rgb(0,0,0,0.45)] transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] z-30 select-none ${
            isSidebarCollapsed ? 'w-18' : 'w-64'
          }`}
        >
          {/* Logo Header */}
          <div className="h-16 px-4 border-b border-subtle flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer overflow-hidden"
              onClick={() => onNavigate('posts')}
            >
              <div className="w-9 h-9 rounded-[var(--radius-xl)] bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-token-lg shadow-indigo-500/20 text-white font-black text-lg flex-shrink-0">
                G
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col">
                  <span className="font-extrabold text-base tracking-wider text-primary uppercase">GAPAK</span>
                  <span className="text-[10px] font-mono text-indigo-400 font-medium tracking-tight">FRONTEND PLATFORM</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 text-tertiary hover:text-primary hover:bg-surface-muted rounded-[var(--radius-lg)] transition-colors"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${isSidebarCollapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
            <div className={`px-2 pb-2 text-[10px] font-mono uppercase tracking-wider text-muted ${isSidebarCollapsed ? 'text-center' : ''}`}>
              {isSidebarCollapsed ? '•' : 'Domains'}
            </div>

            {mainDomainKeys.map((key) => {
              const meta = DOMAINS_REGISTRY[key];
              const isActive = currentDomain === key;

              return (
                <PermissionGuard
                  key={key}
                  permission={meta.requiredPermission}
                  fallback={null}
                >
                  <button
                    onClick={() => onNavigate(key)}
                    className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-xl)] text-xs font-semibold transition-colors overflow-hidden ${
                      isActive ? 'text-white font-bold' : 'text-tertiary hover:text-primary hover:bg-surface-glass'
                    }`}
                    title={isSidebarCollapsed ? meta.title : undefined}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-[var(--radius-xl)] bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-token-md shadow-indigo-600/25"
                      />
                    )}
                    <div className={`relative z-10 ${isActive ? 'text-white' : 'text-tertiary'}`}>{getDomainIcon(key)}</div>
                    {!isSidebarCollapsed && <span className="relative z-10 flex-1 text-left truncate">{meta.title}</span>}
                    {!isSidebarCollapsed && meta.badgeCount && (
                      <span className={`relative z-10 px-1.5 py-0.5 text-[10px] font-mono rounded-[var(--radius-pill)] ${isActive ? 'bg-white/20 text-white' : 'bg-indigo-500/30 text-indigo-300'}`}>
                        {meta.badgeCount}
                      </span>
                    )}
                  </button>
                </PermissionGuard>
              );
            })}
          </div>

          {/* User Presence Footer */}
          {user && (
            <div className="p-3 border-t border-subtle bg-app-glass">
              <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                <Avatar src={user.avatarUrl} name={user.displayName} status={user.presence} size="sm" />
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-primary truncate">{user.displayName}</p>
                    <p className="text-[10px] text-indigo-400 font-mono capitalize">Role: {user.role}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* ========================================== */}
        {/* MAIN LAYOUT WRAPPER                        */}
        {/* ========================================== */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:rounded-[var(--radius-2xl)] md:border md:border-white/10 md:shadow-[0_20px_60px_-20px_rgb(0,0,0,0.35)]">
          {/* Contextual App Header */}
          <header className="h-16 border-b border-subtle app-glass backdrop-blur-2xl backdrop-saturate-150 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-[0_1px_0_rgb(255_255_255_/_.04)]">
            {/* Header Title / Breadcrumb */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 text-tertiary hover:text-primary rounded-[var(--radius-lg)] hover:bg-surface-muted"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-sm font-bold text-primary flex items-center gap-2">
                  <span className="text-indigo-400">{getDomainIcon(currentDomain)}</span>
                  <span>{currentDomainMeta.title}</span>
                </h1>
                <p className="hidden sm:block text-[11px] text-tertiary truncate max-w-xs">
                  {currentDomainMeta.description}
                </p>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2.5">
              {/* Command Palette Button */}
              <button
                onClick={() => setIsCommandOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface-glass hover:bg-surface-muted border border-default rounded-[var(--radius-xl)] text-xs text-tertiary hover:text-primary transition-all"
              >
                <Search className="w-3.5 h-3.5 text-indigo-400" />
                <span>Search domains...</span>
                <kbd className="text-[10px] font-mono text-tertiary bg-surface px-1.5 py-0.5 rounded border border-default">
                  Ctrl K
                </kbd>
              </button>

              <IconButton
                icon={<Search className="w-4 h-4" />}
                ariaLabel="Search"
                className="sm:hidden"
                onClick={() => setIsCommandOpen(true)}
              />

              {/* Notifications Popover */}
              <div className="relative">
                <IconButton
                  icon={<Bell className="w-4 h-4" />}
                  ariaLabel="Notifications"
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-[var(--radius-pill)] bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-slate-900">{unreadCount > 99 ? '99+' : unreadCount}</span>}

                <AnimatePresence>
                  {isNotificationsOpen && (
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 mt-2 w-80 bg-surface border border-subtle rounded-[var(--radius-2xl)] shadow-token-lg p-4 z-50 text-xs">
                      <div className="flex items-center justify-between pb-3 border-b border-subtle mb-3">
                        <span className="font-bold text-primary">Notifications</span>
                        <button type="button" className="text-[10px] text-indigo-400 hover:text-indigo-300" disabled={!unreadCount} onClick={() => void markAllRead()}>Mark all read</button>
                      </div>
                      {notificationsLoading ? <div className="py-8 text-center text-muted">Loading notifications…</div> : notificationsError ? <div className="py-8 text-center text-rose-400">Unable to load notifications.</div> : notifications.length === 0 ? <div className="py-8 text-center text-muted">You are all caught up.</div> : <div className="space-y-2 max-h-96 overflow-y-auto">{notifications.map((notification) => <button key={notification.id} type="button" className={`w-full text-left p-2.5 rounded-[var(--radius-xl)] border ${isNotificationRead(notificationsState, notification) ? 'bg-surface border-subtle' : 'bg-indigo-950/30 border-indigo-500/20'}`} onClick={() => { if (!isNotificationRead(notificationsState, notification)) { void markRead(notification.id); } if (notification.targetUrl) navigate(notification.targetUrl); setIsNotificationsOpen(false); }}><p className="font-semibold text-primary">{notification.title}</p>{notification.body && <p className="text-[11px] text-tertiary mt-0.5">{notification.body}</p>}<p className="text-[9px] text-muted mt-1">{new Date(notification.createdAt).toLocaleString()}</p></button>)}</div>}
                      {notificationMutationError && <p className="mt-2 text-[10px] text-rose-400">Unable to update notifications. Your previous state was restored.</p>}
                      {notificationsState.hasMore && <button type="button" onClick={() => void loadMoreNotifications()} disabled={loadingMoreNotifications} className="mt-3 w-full rounded-[var(--radius-xl)] border border-default px-3 py-2 text-[10px] text-tertiary hover:text-primary disabled:opacity-50">{loadingMoreNotifications ? 'Loading…' : 'Load more'}</button>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Theme Selector */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.04 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                onClick={(e) => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark', { x: e.clientX, y: e.clientY })}
                className="theme-toggle group inline-flex h-9 items-center gap-2 rounded-full px-2.5 text-tertiary hover:text-primary"
                title={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Theme`}
                aria-label={`Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Theme`}
              >
                <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-surface-soft shadow-sm transition-transform duration-300 group-hover:rotate-12">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={resolvedTheme}
                      initial={{ opacity: 0, scale: 0.55, rotate: -45 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.55, rotate: 45 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      {resolvedTheme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-indigo-400" />}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className="relative z-10 hidden lg:inline text-[10px] font-semibold uppercase tracking-[.12em]">
                  {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
                </span>
              </motion.button>

              {/* User Profile Menu */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center gap-2 focus:outline-none ring-2 ring-transparent focus:ring-indigo-500 rounded-[var(--radius-pill)]"
                  >
                    <Avatar src={user.avatarUrl} name={user.displayName} status={user.presence} size="sm" />
                  </button>

                  <AnimatePresence>
                    {isProfileMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-56 bg-surface border border-subtle rounded-[var(--radius-2xl)] shadow-token-lg p-2 z-50 text-xs"
                      >
                        <div className="p-2 border-b border-subtle mb-1">
                          <p className="font-semibold text-primary">{user.displayName}</p>
                          <p className="text-[11px] text-tertiary">@{user.username}</p>
                        </div>

                        {/* Presence Switcher */}
                        <div className="px-2 py-1 text-[10px] font-mono text-muted uppercase">Presence</div>
                        <div className="grid grid-cols-2 gap-1 mb-2 px-1">
                          {(['online', 'away', 'busy', 'invisible'] as PresenceStatus[]).map((p) => (
                            <button
                              key={p}
                              onClick={() => setPresenceStatus(p)}
                              className={`px-2 py-1 rounded text-[11px] font-medium capitalize text-left flex items-center gap-1.5 ${
                                user.presence === p ? 'bg-indigo-600/30 text-indigo-300 font-bold' : 'hover:bg-surface-muted text-tertiary'
                              }`}
                            >
                              <Circle className={`w-2 h-2 fill-current ${
                                p === 'online' ? 'text-emerald-400' : p === 'away' ? 'text-amber-400' : p === 'busy' ? 'text-rose-400' : 'text-tertiary'
                              }`} />
                              <span>{p}</span>
                            </button>
                          ))}
                        </div>

                        <div className="border-t border-subtle pt-1 space-y-0.5">
                          <button
                            onClick={() => {
                              navigate(user ? `/@${encodeURIComponent(user.username)}` : '/users/me');
                              setIsProfileMenuOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-2 hover:bg-surface-muted text-secondary rounded-[var(--radius-lg)] flex items-center gap-2"
                          >
                            <User className="w-3.5 h-3.5 text-indigo-400" />
                            <span>My Profile</span>
                          </button>
                          <button
                            onClick={() => {
                              navigate('/security');
                              setIsProfileMenuOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-2 hover:bg-surface-muted text-secondary rounded-[var(--radius-lg)] flex items-center gap-2"
                          >
                            <Shield className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Security & Vault</span>
                          </button>
                          <button
                            onClick={() => {
                              void logout().catch((error) => toast.error('Server logout failed', error instanceof Error ? error.message : 'The local session was cleared, but the server logout request failed.'));
                              setIsProfileMenuOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-2 hover:bg-rose-500/10 text-rose-400 rounded-[var(--radius-lg)] flex items-center gap-2"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </header>

          {/* Main Workspace Area */}
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 md:pb-6 bg-app">
            {children}
          </main>
        </div>
      </div>

      {/* ========================================== */}
      {/* MOBILE BOTTOM NAVIGATION BAR               */}
      {/* ========================================== */}
      <nav
        aria-label="Primary navigation"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[calc(.9rem+env(safe-area-inset-bottom))]"
      >
        <motion.div
          initial={{ y: 48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="relative flex w-full max-w-sm items-center justify-between gap-1 rounded-[var(--radius-pill)] border border-white/10 bg-surface-glass-strong px-3 py-2 shadow-[0_20px_50px_-12px_rgb(0,0,0,0.45)] backdrop-blur-2xl backdrop-saturate-150"
        >
          {[
            { key: 'posts', label: 'Posts', icon: <Rss className="w-5 h-5" /> },
            { key: 'chats', label: 'Chats', icon: <MessageSquare className="w-5 h-5" /> },
            { key: 'live', label: 'Live', icon: <Radio className="w-5 h-5" /> },
            { key: 'trust-rooms', label: 'Rooms', icon: <Lock className="w-5 h-5" /> },
            { key: 'users', label: 'Profile', icon: <User className="w-5 h-5" /> },
          ].map((item) => {
            const isActive = currentDomain === item.key;
            const isRaised = item.key === 'live';
            const badgeCount = DOMAINS_REGISTRY[item.key as DomainKey]?.badgeCount;

            return (
              <motion.button
                key={item.key}
                onClick={() => onNavigate(item.key as DomainKey)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                className={`relative flex items-center justify-center rounded-full transition-colors ${
                  isRaised
                    ? '-mt-6 h-14 w-14 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white shadow-[0_10px_24px_-4px_rgb(99,102,241,0.55)]'
                    : `h-11 w-12 ${isActive ? 'text-white' : 'text-tertiary'}`
                }`}
              >
                {isActive && !isRaised && (
                  <motion.span
                    layoutId="mobile-nav-active-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-indigo-600"
                  />
                )}
                <span className="relative z-10">{item.icon}</span>
                {!!badgeCount && (
                  <span className="absolute right-1.5 top-1 z-20 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-[var(--color-surface)]" />
                )}
              </motion.button>
            );
          })}
        </motion.div>
      </nav>

      {/* Command Palette Component */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onSelectDomain={onNavigate}
      />

      {/* Global background media-upload status + reload-recovery prompt */}
      <GlobalUploadCenter />
      <UploadRecoveryPrompt />
    </div>
  );
};

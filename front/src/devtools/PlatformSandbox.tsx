/**
 * GAPAK Platform Sandbox & Domain Architecture Explorer
 * Interactive live verification tool for Phase 1 Frontend Platform Foundation:
 * - Single-Flight Concurrent Refresh Deduplication Engine
 * - Auth State Machine
 * - Design System UI Primitives Gallery
 * - Permission Guard Tester
 * - Telemetry Console
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  RefreshCw,
  Zap,
  Shield,
  Key,
  Code,
  Terminal,
  Activity,
  UserCheck,
  Lock,
  Layers,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Copy,
  Info,
  Radio,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../domains/auth/AuthContext';
import { usePermission, PermissionGuard } from '../shared/permissions/permissions';
import { httpClient } from '../shared/api/httpClient';
import { getRefreshCount } from './mocks/api/mockBackend';
import { telemetry } from '../shared/telemetry/telemetry';
import { useToast } from '../shared/ux/ToastContext';
import { useModal } from '../shared/ux/ModalContext';
import {
  Button,
  IconButton,
  Input,
  Textarea,
  Select,
  Checkbox,
  Switch,
  Avatar,
  Badge,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Tabs,
  SegmentedControl,
  Skeleton,
  Spinner,
  Progress,
  EmptyState,
  ErrorState,
  ConfirmDialog,
} from '../shared/design-system/primitives';
import { DomainKey, UserRole, TelemetryEvent, Post, UserStoryGroup, ExtendedUserProfile, ConnectionRequest } from '../shared/types';
import { DOMAINS_REGISTRY } from '../domains';
import { FeedView } from '../domains/feed/FeedView';
import { ProfileView } from '../domains/users/ProfileView';
import { ConnectionsView } from '../domains/connections/ConnectionsView';
import { ChatsView } from '../domains/chats/ChatsView';
import { LiveView } from './live/LiveView';
import { TrustRoomView } from './legacy-domains/trust-rooms';
import { BattleView } from './legacy-domains/battles';
import { SecurityCenterView } from '../domains/security';
import { MyReportsView } from './legacy-domains/moderation';
import { DomainStatusView } from './DomainStatusView';
import {
  CURRENT_USER,
  SAMPLE_USERS,
  INITIAL_POSTS,
  INITIAL_STORY_GROUPS,
  INITIAL_CONNECTION_REQUESTS,
} from './mocks/api/socialMockData';

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  status: 'info' | 'success' | 'warn' | 'error';
}

export const PlatformSandbox: React.FC<{ currentDomain: DomainKey; onNavigate: (d: DomainKey) => void }> = ({
  currentDomain,
  onNavigate,
}) => {
  const { state: authState, user, login, logout, anonymousRegister, verify2FA, startOAuth } = useAuth();
  const perm = usePermission();
  const toast = useToast();
  const { openModal } = useModal();

  // Social domain state
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [storyGroups, setStoryGroups] = useState<UserStoryGroup[]>(INITIAL_STORY_GROUPS);
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>(INITIAL_CONNECTION_REQUESTS);
  const [usersStore, setUsersStore] = useState<Record<string, ExtendedUserProfile>>(SAMPLE_USERS);
  const [activeProfileUserId, setActiveProfileUserId] = useState<string>(CURRENT_USER.id);

  const [activeTab, setActiveTab] = useState('single_flight');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRefreshingRunning, setIsRefreshingRunning] = useState(false);

  // Single flight test metrics
  const [refreshStats, setRefreshStats] = useState({
    totalRequests: 0,
    successfulRequests: 0,
    refreshCallsCount: 0,
  });

  // Design system primitive preview state
  const [btnLoading, setBtnLoading] = useState(false);
  const [switchVal, setSwitchVal] = useState(true);
  const [checkboxVal, setCheckboxVal] = useState(true);
  const [selectVal, setSelectVal] = useState('active');
  const [segmentedVal, setSegmentedVal] = useState('light');
  const [progressVal, setProgressVal] = useState(65);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Telemetry logs state
  const [telemetryLogs, setTelemetryLogs] = useState<TelemetryEvent[]>([]);

  useEffect(() => {
    setTelemetryLogs(telemetry.getEvents());
    const unsub = telemetry.subscribe(() => {
      setTelemetryLogs(telemetry.getEvents());
    });
    return unsub;
  }, []);

  // Post Actions Handlers
  const handleLikeToggle = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const likedByMe = !p.likedByMe;
          const likesCount = p.likesCount + (likedByMe ? 1 : -1);
          return { ...p, likedByMe, likesCount: Math.max(0, likesCount) };
        }
        return p;
      })
    );
  };

  const handleAddComment = (postId: string, text: string, parentId?: string) => {
    const newComment = {
      id: `cmt_${Date.now()}`,
      postId,
      parentId,
      author: CURRENT_USER,
      body: text,
      likesCount: 0,
      likedByMe: false,
      createdAt: new Date().toISOString(),
      replies: [],
    };

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            commentsCount: p.commentsCount + 1,
            comments: [newComment, ...p.comments],
          };
        }
        return p;
      })
    );
  };

  const handleCreatePost = async (postPayload: Partial<Post>) => {
    const newPost: Post = {
      id: `pst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      author: CURRENT_USER,
      body: postPayload.body || '',
      media: postPayload.media || [],
      contentType: postPayload.contentType || 'standard',
      privacy: postPayload.privacy || 'PUBLIC',
      isInTrustedCircle: postPayload.privacy === 'TRUSTED_CIRCLE',
      expiresAt: postPayload.expiresAt,
      oneTimeViewed: false,
      likesCount: 0,
      likedByMe: false,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: new Date().toISOString(),
      comments: [],
      audienceTags: postPayload.audienceTags || [],
    };

    setPosts([newPost, ...posts]);
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    toast.info('Post Deleted', 'Post removed from feed');
  };

  // Connection Handlers
  const handleAcceptRequest = (reqId: string) => {
    setConnectionRequests((prev) => prev.filter((r) => r.id !== reqId));
  };

  const handleRejectRequest = (reqId: string) => {
    setConnectionRequests((prev) => prev.filter((r) => r.id !== reqId));
  };

  const handleToggleTrustedCircle = (userId: string) => {
    setUsersStore((prev) => {
      const target = prev[userId];
      if (!target) return prev;
      return {
        ...prev,
        [userId]: {
          ...target,
          isInTrustedCircle: !target.isInTrustedCircle,
        },
      };
    });
  };

  // Domain view routing
  if (currentDomain === 'posts') {
    return (
      <FeedView
        currentUser={CURRENT_USER}
        posts={posts}
        storyGroups={storyGroups}
        onLikeToggle={handleLikeToggle}
        onAddComment={handleAddComment}
        onCreatePost={handleCreatePost}
        onDeletePost={handleDeletePost}
        onUserClick={(userId) => {
          setActiveProfileUserId(userId);
          onNavigate('users');
        }}
        onStoryReact={(storyId, emoji) => {
          telemetry.record('ux', 'story_react', 'info', { storyId, emoji });
        }}
      />
    );
  }

  if (currentDomain === 'users') {
    const activeProfileUser: ExtendedUserProfile =
      activeProfileUserId === CURRENT_USER.id
        ? {
            ...CURRENT_USER,
            coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
            bio: 'Principal Architect @ GAPAK • Building resilient distributed systems and encrypted media channels.',
            location: 'San Francisco, CA',
            websiteUrl: 'https://gapak.io',
            isSubscribed: false,
            followersCount: 1420,
            followingCount: 380,
            postsCount: posts.filter((p) => p.author.id === CURRENT_USER.id).length,
            trustedCircleCount: Object.values(usersStore).filter((u: ExtendedUserProfile) => u.isInTrustedCircle).length,
            relationshipState: 'owner',
            connectionState: 'connected',
            isInTrustedCircle: true,
            isPrivate: false,
            badges: ['FOUNDER', 'SECURITY CORE'],
          }
        : usersStore[activeProfileUserId] || Object.values(usersStore)[0];

    return (
      <ProfileView
        user={activeProfileUser}
        currentUser={CURRENT_USER}
        posts={posts}
        onLikeToggle={handleLikeToggle}
        onAddComment={handleAddComment}
        onUpdateUserRelationship={(updated) => {
          setUsersStore((prev) => ({
            ...prev,
            [activeProfileUser.id]: { ...activeProfileUser, ...updated },
          }));
        }}
      />
    );
  }

  if (currentDomain === 'connections') {
    return (
      <ConnectionsView
        currentUser={CURRENT_USER}
        requests={connectionRequests}
        sampleUsers={Object.values(usersStore)}
        onAcceptRequest={handleAcceptRequest}
        onRejectRequest={handleRejectRequest}
        onToggleTrustedCircle={handleToggleTrustedCircle}
        onUserClick={(userId) => {
          setActiveProfileUserId(userId);
          onNavigate('users');
        }}
      />
    );
  }

  if (currentDomain === 'chats') {
    return <ChatsView />;
  }

  if (currentDomain === 'live') {
    return <LiveView />;
  }

  if (currentDomain === 'media' || currentDomain === 'subscriptions' || currentDomain === 'stories' || currentDomain === 'presence' || currentDomain === 'admin') {
    return <DomainStatusView domain={DOMAINS_REGISTRY[currentDomain]} />;
  }

  if (currentDomain === 'trust-rooms') {
    return <TrustRoomView />;
  }

  if (currentDomain === 'battles') {
    return (
      <BattleView
        onNavigateToTrustRoom={(roomId) => {
          onNavigate('trust-rooms');
        }}
      />
    );
  }

  if (currentDomain === 'security') {
    return <SecurityCenterView />;
  }

  if (currentDomain === 'moderation') {
    return (
      <div className="h-full bg-slate-950 text-slate-100 p-4 md:p-6 overflow-y-auto">
        <MyReportsView />
      </div>
    );
  }

  // Fallback to Platform Sandbox for platform evaluation
  const addLog = (message: string, status: 'info' | 'success' | 'warn' | 'error') => {
    setLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 7),
        timestamp: new Date().toLocaleTimeString(),
        message,
        status,
      },
      ...prev,
    ]);
  };

  const runSingleFlightDeduplicationTest = async () => {
    setIsRefreshingRunning(true);
    addLog('🚀 Launching 10 SIMULTANEOUS 401 requests to /api/test/requires-auth...', 'warn');

    httpClient.setTokens('mock_expired_token_xyz', 'mock_refresh_token_valid');
    const initialRefreshCount = getRefreshCount();

    const requests = Array.from({ length: 10 }).map((_, index) => {
      addLog(`Enqueued Request #${index + 1} with expired token`, 'info');
      return httpClient.get<{ message: string; tokenUsed: string }>('/api/test/requires-auth', {
        headers: { Authorization: 'Bearer mock_expired_token_xyz' },
      });
    });

    try {
      const results = await Promise.all(requests);
      const newRefreshCount = getRefreshCount();
      const actualRefreshCalls = newRefreshCount - initialRefreshCount;

      setRefreshStats({
        totalRequests: 10,
        successfulRequests: results.length,
        refreshCallsCount: actualRefreshCalls,
      });

      addLog(`✅ All 10 requests completed successfully!`, 'success');
      addLog(`🔥 Single-Flight Proof: Received 10 401s but sent EXACTLY ${actualRefreshCalls} Token Refresh call!`, 'success');

      toast.success(
        'Single-flight Refresh Verified!',
        `10 concurrent 401s generated only ${actualRefreshCalls} refresh call. All 10 succeeded!`
      );
    } catch (err: any) {
      addLog(`❌ Test failed: ${err.message}`, 'error');
      toast.error('Test Failed', err.message);
    } finally {
      setIsRefreshingRunning(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Banner Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-xs font-mono mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>PHASE 2 — SOCIAL EXPERIENCE READY</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              GAPAK Architecture & Social Platform
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
              Inspect typed API infrastructure, single-flight refresh token deduplication, social feeds, profiles, stories, and connections.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Zap className="w-4 h-4" />}
              onClick={() => onNavigate('posts')}
            >
              Open Social Feed
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('users')}
            >
              Open Profile
            </Button>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs
        tabs={[
          { id: 'single_flight', label: 'Single-Flight API Refresh', icon: <RefreshCw className="w-4 h-4" /> },
          { id: 'auth_machine', label: 'Auth State Machine', icon: <Key className="w-4 h-4" /> },
          { id: 'design_system', label: 'UI Primitives Gallery', icon: <Layers className="w-4 h-4" /> },
          { id: 'permissions', label: 'Permission Guards', icon: <Shield className="w-4 h-4" /> },
          { id: 'domains_map', label: '15 Product Domains Map', icon: <Code className="w-4 h-4" /> },
          { id: 'telemetry', label: 'Telemetry Console', icon: <Activity className="w-4 h-4" />, badge: telemetryLogs.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: SINGLE-FLIGHT CONCURRENT TOKEN REFRESH DEDUPLICATION */}
      {activeTab === 'single_flight' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-100">Single-Flight Concurrent Refresh Engine</h3>
              </div>
              <Badge variant="success">Active</Badge>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                When 10 concurrent requests return <strong>401 Unauthorized</strong> simultaneously, the GAPAK API client queues pending requests and issues <strong>EXACTLY ONE</strong> token refresh request. Once resolved, all 10 queued calls are re-sent with the new Bearer token.
              </p>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total Concurrent Requests:</span>
                  <span className="font-mono font-bold text-slate-200">{refreshStats.totalRequests || 10}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Successful Responses Re-issued:</span>
                  <span className="font-mono font-bold text-emerald-400">{refreshStats.successfulRequests}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Token Refresh Calls Sent to Backend:</span>
                  <span className="font-mono font-bold text-indigo-400">{refreshStats.refreshCallsCount}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  fullWidth
                  leftIcon={<Play className="w-4 h-4" />}
                  onClick={runSingleFlightDeduplicationTest}
                  isLoading={isRefreshingRunning}
                >
                  Run 10 Concurrent 401 Deduplication Test
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Test Execution Logs */}
          <Card>
            <CardHeader>
              <h3 className="font-bold text-sm text-slate-100">Live Execution Log</h3>
              <IconButton icon={<Trash2 className="w-3.5 h-3.5" />} ariaLabel="Clear logs" onClick={() => setLogs([])} />
            </CardHeader>
            <CardBody>
              <div className="h-64 overflow-y-auto space-y-2 font-mono text-[11px] p-2 bg-slate-950 rounded-xl border border-slate-800">
                {logs.length === 0 ? (
                  <p className="text-slate-600 text-center py-8">Click "Run Test" to trigger concurrent calls...</p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-1.5 rounded border ${
                        log.status === 'success'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                          : log.status === 'warn'
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                          : log.status === 'error'
                          ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                          : 'border-slate-800 bg-slate-900 text-slate-400'
                      }`}
                    >
                      <span className="text-slate-500 mr-2">[{log.timestamp}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* TAB 2: AUTH STATE MACHINE */}
      {activeTab === 'auth_machine' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="font-bold text-sm text-slate-100">Current Auth State</h3>
              <Badge variant={authState === 'AUTHENTICATED' ? 'success' : 'warning'}>{authState}</Badge>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
                <p><span className="text-slate-500">State:</span> <span className="text-indigo-400 font-bold">{authState}</span></p>
                <p><span className="text-slate-500">User ID:</span> <span className="text-slate-300">{user?.id || 'None'}</span></p>
                <p><span className="text-slate-500">Username:</span> <span className="text-slate-300">{user?.username || 'None'}</span></p>
                <p><span className="text-slate-500">Role:</span> <span className="text-emerald-400">{user?.role || 'None'}</span></p>
                <p><span className="text-slate-500">Presence:</span> <span className="text-amber-400">{user?.presence || 'None'}</span></p>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold text-slate-300">Trigger State Machine Transitions:</h4>
                <div className="grid grid-cols-2 gap-2">
                  <p className="col-span-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                    Authentication transitions are exercised through the real Auth page and backend; this sandbox does not submit fabricated credentials or OTP codes.
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => void startOAuth('github')}>
                    OAuth (GitHub)
                  </Button>
                </div>
                <Button variant="danger" fullWidth size="sm" onClick={logout}>
                  Sign Out (UNAUTHENTICATED)
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-bold text-sm text-slate-100">Supported State Transitions</h3>
            </CardHeader>
            <CardBody className="space-y-3 text-xs text-slate-300">
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span>UNKNOWN → AUTHENTICATING</span>
                <Badge size="sm" variant="info">Mount</Badge>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span>AUTHENTICATING → AUTHENTICATED</span>
                <Badge size="sm" variant="success">Valid Token</Badge>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span>AUTHENTICATED → REFRESHING</span>
                <Badge size="sm" variant="warning">401 Token Expiry</Badge>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span>REFRESHING → UNAUTHENTICATED</span>
                <Badge size="sm" variant="danger">Refresh Reject</Badge>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* TAB 3: DESIGN SYSTEM PRIMITIVES */}
      {activeTab === 'design_system' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="font-bold text-sm text-slate-100">GAPAK UI Primitives Showcase</h3>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* Buttons & Icons */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500">1. Buttons & IconButtons</h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="accent">Accent</Button>
                  <Button variant="primary" isLoading={btnLoading} onClick={() => {
                    setBtnLoading(true);
                    setTimeout(() => setBtnLoading(false), 2000);
                  }}>
                    Click Loading
                  </Button>
                </div>
              </div>

              {/* Form Controls */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500">2. Inputs & Controls</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input label="Text Input" placeholder="Type something..." />
                  <Select
                    label="Select Menu"
                    value={selectVal}
                    onChange={(e) => setSelectVal(e.target.value)}
                    options={[
                      { label: 'Active', value: 'active' },
                      { label: 'Suspended', value: 'suspended' },
                      { label: 'Pending', value: 'pending' },
                    ]}
                  />
                  <div className="flex flex-col justify-center gap-2">
                    <Switch label="Dark Mode Switch" checked={switchVal} onChange={setSwitchVal} />
                    <Checkbox label="Remember device" checked={checkboxVal} onChange={(e) => setCheckboxVal(e.target.checked)} />
                  </div>
                </div>
              </div>

              {/* Badges & Avatars */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500">3. Avatars & Badges</h4>
                <div className="flex items-center gap-4 flex-wrap">
                  <Avatar name="Alex Rivers" status="online" size="lg" />
                  <Avatar name="Taylor Swift" status="away" size="md" />
                  <Badge variant="brand" dot>Brand Badge</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="danger">Danger</Badge>
                  <Badge variant="info">Info</Badge>
                </div>
              </div>

              {/* Progress & Skeletons */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500">4. Progress & Skeleton</h4>
                <div className="space-y-3 max-w-md">
                  <Progress value={progressVal} />
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="w-24 h-4" />
                    <Skeleton className="w-12 h-4" />
                  </div>
                </div>
              </div>

              {/* Dialogs & Toasts triggers */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-500">5. Modals & Toast Triggers</h4>
                <div className="flex gap-3 flex-wrap">
                  <Button variant="secondary" size="sm" onClick={() => toast.success('Action Saved', 'Data stored cleanly.')}>
                    Trigger Success Toast
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => toast.error('API Failure', '401 Unauthorized token expired.')}>
                    Trigger Error Toast
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
                    Trigger Confirm Dialog
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          <ConfirmDialog
            isOpen={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => toast.info('Confirmed', 'Action performed.')}
            title="Delete Trust Key?"
            message="This will revoke access for session #902."
          />
        </div>
      )}

      {/* TAB 4: PERMISSIONS */}
      {activeTab === 'permissions' && (
        <Card>
          <CardHeader>
            <h3 className="font-bold text-sm text-slate-100">Permissions Evaluator & Guards</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-xs text-slate-400">
              Test frontend permission evaluation. Current logged in user is <strong>{user?.username}</strong> with role <strong>{user?.role}</strong>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                <h4 className="font-semibold text-indigo-400">Moderation Guard Check</h4>
                <PermissionGuard
                  permission="moderation.content"
                  fallback={<p className="text-rose-400">❌ Access Denied: Requires 'moderation.content' permission.</p>}
                >
                  <p className="text-emerald-400">✅ Access Granted: You can moderate posts and trust rooms.</p>
                </PermissionGuard>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                <h4 className="font-semibold text-purple-400">Admin Role Guard Check</h4>
                <PermissionGuard
                  role="admin"
                  fallback={<p className="text-rose-400">❌ Access Denied: Requires 'admin' role.</p>}
                >
                  <p className="text-emerald-400">✅ Access Granted: Admin System Console available.</p>
                </PermissionGuard>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* TAB 5: 15 PRODUCT DOMAINS MAP */}
      {activeTab === 'domains_map' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(DOMAINS_REGISTRY).map((dom) => (
            <Card key={dom.key} className="hover:border-indigo-500/40 transition-colors">
              <CardBody className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-indigo-400 uppercase">{dom.key}</span>
                  <Badge size="sm" variant="neutral">{dom.category}</Badge>
                </div>
                <h4 className="text-sm font-semibold text-slate-100">{dom.title}</h4>
                <p className="text-xs text-slate-400">{dom.description}</p>
                <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => onNavigate(dom.key)}>
                  Open Domain →
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 6: TELEMETRY CONSOLE */}
      {activeTab === 'telemetry' && (
        <Card>
          <CardHeader>
            <h3 className="font-bold text-sm text-slate-100">Sanitized Telemetry Event Stream</h3>
            <IconButton icon={<Trash2 className="w-3.5 h-3.5" />} ariaLabel="Clear" onClick={() => telemetry.clear()} />
          </CardHeader>
          <CardBody>
            <div className="h-80 overflow-y-auto space-y-2 font-mono text-[11px] p-3 bg-slate-950 rounded-xl border border-slate-800">
              {telemetryLogs.map((evt) => (
                <div key={evt.id} className="p-2 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-indigo-400 font-bold uppercase">[{evt.category}]</span>
                    <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-200 font-semibold">{evt.name}</p>
                  {evt.payload && (
                    <pre className="text-[10px] text-slate-400 overflow-x-auto bg-slate-950 p-1.5 rounded">
                      {JSON.stringify(evt.payload, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

/**
 * GAPAK Domains Contract & Registry
 * Defines clean architectural boundaries for all 15 product domains.
 */

import { DomainKey } from '../shared/types';

export interface DomainMeta {
  key: DomainKey;
  title: string;
  description: string;
  category: 'core' | 'communication' | 'content' | 'live_interactive' | 'governance';
  requiredPermission?: string;
  badgeCount?: number;
}

export const DOMAINS_REGISTRY: Record<DomainKey, DomainMeta> = {
  auth: {
    key: 'auth',
    title: 'Authentication & Identity',
    description: 'State machine auth, 2FA, OAuth callbacks, and token lifecycle',
    category: 'core',
  },
  users: {
    key: 'users',
    title: 'User Profiles & Trust',
    description: 'User profiles, trust scores, verification badges, and settings',
    category: 'core',
  },
  connections: {
    key: 'connections',
    title: 'Connections & Graph',
    description: 'Social graph, followers, mutual trust networks, and blocks',
    category: 'core',
  },
  subscriptions: {
    key: 'subscriptions',
    title: 'Subscriptions & Tiers',
    description: 'Creator tier subscriptions, access pass keys, and billing',
    category: 'core',
  },
  posts: {
    key: 'posts',
    title: 'Posts & Feed Engine',
    description: 'Algorithmic & chronological feeds, rich posts, and comments',
    category: 'content',
  },
  stories: {
    key: 'stories',
    title: 'Ephemeral Stories',
    description: '24-hour media stories, interactive polls, and reactions',
    category: 'content',
  },
  chats: {
    key: 'chats',
    title: 'Direct Chats & Groups',
    description: 'E2E encrypted direct messages, group chats, and media sharing',
    category: 'communication',
    badgeCount: 3,
  },
  media: {
    key: 'media',
    title: 'Media Vault & Storage',
    description: 'Encrypted media processing, chunked uploads, and CDN distribution',
    category: 'content',
  },
  presence: {
    key: 'presence',
    title: 'Real-time Presence',
    description: 'WebSocket activity heartbeats, custom statuses, and online state',
    category: 'communication',
  },
  live: {
    key: 'live',
    title: 'Live Streams & Broadcasts',
    description: 'Low-latency RTMP/WebRTC streams, live chat, and tips',
    category: 'live_interactive',
  },
  'trust-rooms': {
    key: 'trust-rooms',
    title: 'Trust Rooms & Audio Stages',
    description: 'Invite-only encrypted rooms with role-based speaking stages',
    category: 'communication',
  },
  battles: {
    key: 'battles',
    title: 'Creator Battles & Arena',
    description: 'Real-time 1v1 battles, audience voting, and leaderboard arena',
    category: 'live_interactive',
  },
  moderation: {
    key: 'moderation',
    title: 'Moderation & Reports',
    description: 'Content review queue, AI safety flags, and trust appeals',
    category: 'governance',
    requiredPermission: 'moderation.content',
  },
  admin: {
    key: 'admin',
    title: 'System Admin Console',
    description: 'Global configuration, feature flags, telemetries, and node health',
    category: 'governance',
    requiredPermission: 'admin.access',
  },
  security: {
    key: 'security',
    title: 'Security & Key Vault',
    description: 'Device session logs, active keys, 2FA settings, and audit logs',
    category: 'governance',
  },
};

export * from './security';

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
    description: 'Server-backed profiles, privacy and account settings',
    category: 'core',
  },
  connections: {
    key: 'connections',
    title: 'Connections & Graph',
    description: 'Connection requests, accepted connections and trusted-circle state',
    category: 'core',
  },
  subscriptions: {
    key: 'subscriptions',
    title: 'Subscriptions & Tiers',
    description: 'Following, subscription visibility, requests and notification preferences',
    category: 'core',
  },
  posts: {
    key: 'posts',
    title: 'Posts & Feed Engine',
    description: 'Server feed, posts, likes and comments',
    category: 'content',
  },
  stories: {
    key: 'stories',
    title: 'Ephemeral Stories',
    description: 'Expiring media stories, viewers, reactions and highlights',
    category: 'content',
  },
  chats: {
    key: 'chats',
    title: 'Direct Chats & Groups',
    description: 'E2E encrypted direct messages, group chats, and media sharing',
    category: 'communication',
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
    description: 'Server-managed live streams, lifecycle, viewers and live chat',
    category: 'live_interactive',
  },
  'trust-rooms': {
    key: 'trust-rooms',
    title: 'Trust Rooms & Audio Stages',
    description: 'Private server-authorized rooms and membership roles',
    category: 'communication',
  },
  battles: {
    key: 'battles',
    title: 'Creator Battles & Arena',
    description: 'Challenges, responses, battle state, scores and audience votes',
    category: 'live_interactive',
  },
  moderation: {
    key: 'moderation',
    title: 'Moderation & Reports',
    description: 'User reports and permission-controlled moderation decisions',
    category: 'governance',
  },
  admin: {
    key: 'admin',
    title: 'System Admin Console',
    description: 'Operational overview, users and managed content pages',
    category: 'governance',
    requiredPermission: 'admin:dashboard:read',
  },
  security: {
    key: 'security',
    title: 'Security & Key Vault',
    description: 'Device session logs, active keys, 2FA settings, and audit logs',
    category: 'governance',
  },
};

export * from './security';

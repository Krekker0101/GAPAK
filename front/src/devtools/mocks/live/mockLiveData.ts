/**
 * GAPAK Live Streaming Platform Mock Data
 * Phase 4 - Live Domain
 */

import { LiveStream, LiveChatMessage, LiveStreamEvent } from '../../../shared/types';
import { CURRENT_USER, SAMPLE_USERS } from '../api/socialMockData';

export const INITIAL_LIVE_STREAMS: LiveStream[] = [
  {
    id: 'stream_gapak_01',
    title: 'GAPAK Tech Keynote 2026: Next-Gen Realtime E2EE & HLS Infrastructure',
    description: 'Join the lead core team for a deep dive into Double Ratchet protocol scaling, WebAssembly HLS decoders, and zero-trust mesh networking.',
    host: CURRENT_USER,
    state: 'LIVE',
    startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    currentViewersCount: 3420,
    peakViewersCount: 4890,
    likesCount: 18450,
    coverImageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&auto=format&fit=crop&q=80',
    allowReplay: true,
    tags: ['E2EE', 'Architecture', 'HLS', 'Keynote'],
    latencyMs: 380,
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'stream_gapak_02',
    title: 'Cyberpunk Synthwave DJ Set & Live Visual Coding Session',
    description: 'Relaxing ambient electronic audio synthesis live stream with generative graphics rendered in WebGL.',
    host: SAMPLE_USERS[0],
    state: 'LIVE',
    startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    currentViewersCount: 1280,
    peakViewersCount: 1950,
    likesCount: 9340,
    coverImageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&auto=format&fit=crop&q=80',
    allowReplay: true,
    tags: ['Music', 'Synthwave', 'LiveCoding'],
    latencyMs: 420,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'stream_gapak_03',
    title: 'Global Cybersecurity AMA: Zero-Trust Security & Key Management',
    description: 'Interactive security Q&A answering member questions on trusted device revocation and key exchange security.',
    host: SAMPLE_USERS[1],
    state: 'SCHEDULED',
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    currentViewersCount: 0,
    peakViewersCount: 0,
    likesCount: 420,
    coverImageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&auto=format&fit=crop&q=80',
    allowReplay: true,
    tags: ['Security', 'AMA', 'Privacy'],
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
  },
  {
    id: 'stream_gapak_04',
    title: 'Replay: GAPAK Phase 3 Realtime Messaging Protocol Demo',
    description: 'Recorded live broadcast demonstrating key distribution, double ratchet state recovery, and receipt batching.',
    host: SAMPLE_USERS[2],
    state: 'REPLAY',
    startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    endedAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    currentViewersCount: 850,
    peakViewersCount: 2100,
    likesCount: 4120,
    coverImageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80',
    allowReplay: true,
    replayMediaId: 'med_replay_04',
    replayStatus: 'READY',
    tags: ['Replay', 'Protocol', 'E2EE'],
    createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
  },
];

export const INITIAL_LIVE_CHAT_MESSAGES: Record<string, LiveChatMessage[]> = {
  stream_gapak_01: [
    {
      id: 'lc_01',
      streamId: 'stream_gapak_01',
      sender: SAMPLE_USERS[0],
      text: 'Welcome everyone to the GAPAK 2026 Keynote stream!',
      isSystem: false,
      isPinned: true,
      badges: ['MOD'],
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
    {
      id: 'lc_02',
      streamId: 'stream_gapak_01',
      sender: SAMPLE_USERS[1],
      text: 'Is HLS playback grant renewal supported on mobile web?',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'lc_03',
      streamId: 'stream_gapak_01',
      sender: CURRENT_USER,
      text: 'Yes! Signed grants automatically refresh before expiration.',
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'lc_04',
      streamId: 'stream_gapak_01',
      sender: SAMPLE_USERS[2],
      text: 'The video latency looks super low 🔥',
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
  ],
};

export const INITIAL_LIVE_EVENTS: Record<string, LiveStreamEvent[]> = {
  stream_gapak_01: [
    {
      id: 'evt_01',
      streamId: 'stream_gapak_01',
      type: 'viewer_joined',
      user: SAMPLE_USERS[1],
      timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    },
    {
      id: 'evt_02',
      streamId: 'stream_gapak_01',
      type: 'tip',
      user: SAMPLE_USERS[2],
      payload: { amount: 500, token: 'GPK' },
      timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    },
  ],
};

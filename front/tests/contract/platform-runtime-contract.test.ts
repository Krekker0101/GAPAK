import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

test('platform pages use the backend routes exposed by their controllers', () => {
  const api = read('src/domains/platform/api/platformApi.ts');
  for (const route of [
    '/trust-rooms',
    '/battles',
    '/presence/me',
    '/presence/query',
    '/moderation/reports',
    '/admin/moderation/reports',
    '/subscriptions/following',
    '/subscriptions/requests/pending',
    '/subscriptions/block',
    '/admin/overview',
    '/admin/users',
    '/admin/content/pages',
  ]) assert.match(api, new RegExp(route.replaceAll('/', '\\/')));

  const pages = read('src/pages/DomainPages.tsx');
  for (const component of ['TrustRoomsPage', 'BattlesPage', 'PresencePage', 'ModerationPage', 'SubscriptionsPage', 'AdminPage']) {
    assert.match(pages, new RegExp(component));
  }
  assert.doesNotMatch(pages, /ContractPage|mock|placeholder/i);
});

test('live page performs server-authoritative lifecycle, events and idempotent chat', () => {
  const api = read('src/domains/live/api/liveApi.ts');
  const page = read('src/domains/live/LivePage.tsx');
  for (const suffix of ['/start', '/end', '/join', '/events', '/chat']) assert.match(api, new RegExp(suffix));
  assert.match(page, /existingClientMessageId \?\? crypto\.randomUUID\(\)/);
  assert.match(page, /liveApi\.postChat/);
  assert.doesNotMatch(page, /mock|fake|simulate/i);
});

test('push registration is server-backed and revocation also removes the browser subscription', () => {
  const api = read('src/domains/notifications/api/pushApi.ts');
  const section = read('src/domains/security/components/PushDevicesSection.tsx');
  const worker = read('public/push-sw.js');
  for (const method of ['get', 'post', 'delete']) assert.match(api, new RegExp(`httpClient\\.${method}`));
  assert.match(api, /\/notifications\/devices/);
  assert.match(section, /VITE_WEB_PUSH_PUBLIC_KEY/);
  assert.match(section, /pushManager\.subscribe/);
  assert.match(section, /subscription\.unsubscribe\(\)/);
  assert.match(worker, /showNotification/);
  assert.match(worker, /notificationclick/);
});

test('incremental sync advances and persists backend cursors without a fixed page truncation', () => {
  const sync = read('src/shared/sync/SyncBridge.tsx');
  assert.match(sync, /httpClient\.get<SyncResponse>\('\/sync'/);
  assert.match(sync, /while \(true\)/);
  assert.match(sync, /non-advancing cursor/);
  assert.match(sync, /sync\.cursor_expired/);
  assert.match(sync, /sessionStorage\.setItem/);
  assert.doesNotMatch(sync, /page < 20/);
});

test('chat UI exposes only implemented outbound encrypted content and device registration uses backend binding', () => {
  const composer = read('src/domains/chats/Composer.tsx');
  const devices = read('src/domains/security/components/DevicesSection.tsx');
  const media = read('src/domains/media/api/mediaApi.ts');
  assert.match(composer, /contentType: 'TEXT'/);
  assert.doesNotMatch(composer, /Paperclip|startVoiceRecording|encryptAttachment|ephemeralTimer/);
  assert.match(devices, /cryptoApi\.registerCurrentDevice/);
  assert.doesNotMatch(devices, /web_\$\{crypto\.randomUUID|e2eeCryptoEngine\.registerCurrentDevice/);
  assert.doesNotMatch(media, /UnsupportedMediaContractError|Promise<never>|list:\s*async|albums:\s*async/);
});


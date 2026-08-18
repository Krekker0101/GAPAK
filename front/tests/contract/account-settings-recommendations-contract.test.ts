import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), 'utf8');

test('profile exposes backend-backed account settings', () => {
  const profile = read('src/pages/ProfilePage.tsx');
  const settings = read('src/pages/AccountSettingsPage.tsx');
  const router = read('src/app/router/AppRouter.tsx');
  assert.match(profile, /ariaLabel="Account settings"/);
  assert.match(profile, /navigate\('\/settings'\)/);
  assert.match(router, /path="\/settings"/);
  assert.match(settings, /usersApi\.me/);
  assert.match(settings, /usersApi\.updatePrivacy/);
  assert.match(settings, /profileVisibility:\s*enabled \? 'PUBLIC' : 'PRIVATE'/);
  assert.doesNotMatch(settings, /localStorage|sessionStorage/);
});

test('main feed recommendations use only real backend APIs', () => {
  const feed = read('src/pages/FeedPage.tsx');
  const panel = read('src/domains/connections/RecommendationsPanel.tsx');
  const usersApi = read('src/domains/users/api/usersApi.ts');
  const connectionsApi = read('src/domains/connections/api/connectionsApi.ts');
  assert.match(feed, /<RecommendationsPanel \/>/);
  assert.match(panel, /usersApi\.discover/);
  assert.match(panel, /connectionsApi\.suggestions/);
  assert.match(usersApi, /'\/users\/discover'/);
  assert.match(connectionsApi, /'\/connections\/suggestions'/);
  assert.doesNotMatch(panel, /mock|fixture|Math\.random/i);
});

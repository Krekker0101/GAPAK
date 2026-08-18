import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), 'utf8');

test('auth pages mount exactly one isolated visual showcase', () => {
  const authPage = read('src/pages/AuthPage.tsx');
  const showcase = read('src/pages/auth/AuthShowcase.tsx');
  assert.match(authPage, /import \{ AuthShowcase \}/);
  assert.equal((authPage.match(/<AuthShowcase \/>/g) ?? []).length, 1);
  assert.match(showcase, /const lanes = \[/);
  assert.match(showcase, /auth-showcase-track-down/);
  assert.match(showcase, /auth-showcase-track-up/);
  assert.match(showcase, /aria-hidden="true"/);
  assert.doesNotMatch(showcase, /httpClient|postsApi|useQuery|https?:\/\//);
});

test('showcase media is local, optimized and bounded', () => {
  const names = [
    'rooftop-friends.jpg',
    'urban-skate.jpg',
    'pottery-studio.jpg',
    'mountain-hike.jpg',
    'home-cooking.jpg',
    'live-concert.jpg',
  ];
  let total = 0;
  for (const name of names) {
    const file = join(root, 'public', 'auth-showcase', name);
    const size = statSync(file).size;
    const signature = readFileSync(file).subarray(0, 2);
    assert.deepEqual([...signature], [0xff, 0xd8], `${name} must be a JPEG`);
    assert.ok(size < 120_000, `${name} exceeds the per-image budget`);
    total += size;
  }
  assert.ok(total < 600_000, 'auth showcase exceeds the total media budget');
});

test('showcase animation is seamless, pausable and motion-safe', () => {
  const css = read('src/shared/design-system/tokens.css');
  assert.match(css, /@keyframes auth-marquee-up/);
  assert.match(css, /@keyframes auth-marquee-down/);
  assert.match(css, /animation-play-state:\s*paused/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
});


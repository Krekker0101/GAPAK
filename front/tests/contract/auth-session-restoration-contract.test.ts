import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), 'utf8');

test('session restoration is single-flight and preserves the protected route', () => {
  const context = read('src/domains/auth/AuthContext.tsx');
  const router = read('src/app/router/AppRouter.tsx');
  const authPage = read('src/pages/AuthPage.tsx');

  assert.match(context, /hydrationPromiseRef/);
  assert.match(context, /if \(hydrationPromiseRef\.current\) return hydrationPromiseRef\.current/);
  assert.match(router, /returnTo: `\$\{location\.pathname\}\$\{location\.search\}\$\{location\.hash\}`/);
  assert.match(authPage, /navigate\(returnTo, \{ replace: true \}\)/);
  assert.match(authPage, /!requestedReturnTo\.startsWith\('\/\/'\)/);
});

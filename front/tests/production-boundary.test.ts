import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(process.cwd(), 'src');
const productionFiles: string[] = [];

const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'devtools') continue;
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry)) productionFiles.push(full);
  }
};
walk(root);

const source = productionFiles.map((file) => ({ file, text: readFileSync(file, 'utf8') }));

test('production source does not import development mocks', () => {
  const violations = source.filter(({ file, text }) => file.replaceAll('\\', '/').endsWith('shared/api/httpClient.ts') ? false : /devtools\/mocks|mockBackend|MOCK_USER|MOCK_CURRENT_USER/.test(text));
  assert.deepEqual(violations.map(({ file }) => relative(process.cwd(), file)), [], 'development fixtures leaked into production source');
});

test('production source does not contain fake security primitives', () => {
  const violations = source.filter(({ text }) => /btoa\(|atob\(|fake crypto|fake token|fake OAuth|fake 2FA|MockWebSocket/i.test(text));
  assert.deepEqual(violations.map(({ file }) => relative(process.cwd(), file)), [], 'fake security implementation detected');
});

test('production source has no raw HTML injection sink', () => {
  const violations = source.filter(({ text }) => /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(text));
  assert.deepEqual(violations.map(({ file }) => relative(process.cwd(), file)), [], 'raw HTML sink detected');
});

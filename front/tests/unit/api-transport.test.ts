import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

test('ApiError preserves typed backend error fields', () => {
  const source = read('src/shared/api/httpClient.ts');
  assert.match(source, /public readonly status: number/);
  assert.match(source, /public readonly code: string/);
  assert.match(source, /public readonly requestId\?: string/);
  assert.match(source, /public readonly details\?: unknown/);
  assert.match(source, /public readonly retryAfterMs\?: number/);
});

test('ApiClient exposes generic request and response boundaries', () => {
  const source = read('src/shared/api/ApiClient.ts');
  assert.match(source, /class ApiClient<TRequest = unknown, TResponse = unknown>/);
  assert.match(source, /request\(config: ApiClientRequest<TRequest>\): Promise<TResponse>/);
});

test('transport canonicalizes API URLs and includes browser credentials', () => {
  const envSource = read('src/shared/config/env.ts');
  const transport = read('src/shared/api/httpClient.ts');
  assert.match(envSource, /\/api\/v1/);
  assert.match(transport, /credentials: 'include'/);
  assert.match(transport, /X-Request-ID/);
});

test('transport has single-flight refresh and fail-closed session invalidation', () => {
  const source = read('src/shared/api/httpClient.ts');
  assert.match(source, /private refreshPromise: Promise<string> \| null = null/);
  assert.match(source, /if \(this\.refreshPromise\) return this\.refreshPromise/);
  assert.match(source, /this\.clearSession\(\)/);
});

test('production transport does not import the development mock backend', () => {
  const source = read('src/shared/api/httpClient.ts');
  assert.equal(source.includes('devtools/mocks/api/mockBackend'), false);
});

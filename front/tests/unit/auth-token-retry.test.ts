import test from 'node:test';
import assert from 'node:assert/strict';
import { TokenManager } from '../../src/shared/api/tokenManager.ts';
import { isRetryableMethod, shouldRetry, retryDelayMs } from '../../src/shared/api/retryPolicy.ts';

test('token manager keeps access token memory-only and clears deterministically', () => {
  const manager = new TokenManager();
  assert.equal(manager.getAccessToken(), null);
  manager.setAccessToken('access-token');
  assert.equal(manager.getAccessToken(), 'access-token');
  manager.clear();
  assert.equal(manager.getAccessToken(), null);
});

test('retry policy only retries safe methods or explicitly idempotent mutations', () => {
  assert.equal(isRetryableMethod('GET'), true);
  assert.equal(isRetryableMethod('POST'), false);
  assert.equal(isRetryableMethod('POST', 'idem-1'), true);
  assert.equal(shouldRetry({ method: 'POST', attempt: 0, maxAttempts: 3, errorStatus: 500 }), false);
  assert.equal(shouldRetry({ method: 'POST', idempotencyKey: 'idem-1', attempt: 0, maxAttempts: 3, errorStatus: 500 }), true);
  assert.equal(shouldRetry({ method: 'GET', attempt: 2, maxAttempts: 3, errorStatus: 500 }), true);
  assert.equal(shouldRetry({ method: 'GET', attempt: 3, maxAttempts: 3, errorStatus: 500 }), false);
  assert.equal(shouldRetry({ method: 'GET', attempt: 0, maxAttempts: 3, errorStatus: 403 }), false);
});

test('retry delay is bounded and deterministic with injected jitter', () => {
  assert.equal(retryDelayMs(0, undefined, () => 0), 250);
  assert.equal(retryDelayMs(3, undefined, () => 0), 2000);
  assert.equal(retryDelayMs(20, undefined, () => 0), 8000);
  assert.equal(retryDelayMs(1, 1200, () => 0.9), 1200);
});

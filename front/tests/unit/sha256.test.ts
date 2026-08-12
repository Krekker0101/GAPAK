import test from 'node:test';
import assert from 'node:assert/strict';
import { Sha256Incremental } from '../../src/shared/crypto/sha256.ts';

test('incremental SHA-256 is independent of chunk boundaries', () => {
  const one = new Sha256Incremental().update(new TextEncoder().encode('abc')).digestHex();
  const two = new Sha256Incremental().update(new TextEncoder().encode('a')).update(new TextEncoder().encode('bc')).digestHex();
  assert.equal(one, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(two, one);
});

test('finalized SHA-256 cannot be mutated', () => {
  const hash = new Sha256Incremental();
  hash.update(new Uint8Array([1])).digestHex();
  assert.throws(() => hash.update(new Uint8Array([2])), /already finalized/);
});

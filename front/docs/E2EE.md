# GAPAK Front — E2EE

## Current implementation

The browser uses Web Crypto primitives:

- ECDH P-256
- HKDF-SHA-256
- AES-256-GCM
- ECDSA P-256/SHA-256
- non-extractable private keys in IndexedDB

Each message gets a fresh ephemeral ECDH key pair and authenticated ciphertext. Recipient device bundles are requested from the backend.

## Explicit non-claims

This is **not** a Signal/Double-Ratchet implementation. The frontend does not claim full end-to-end security until the backend satisfies the device and message protocol contract.

Required server guarantees:

- authenticated device identity keys;
- verified recipient bundles;
- device revocation and rotation;
- replay protection and message counters;
- membership enforcement;
- key lifecycle and compromise recovery semantics;
- stable sender signing keys.

## Attachments

Encrypted chat attachments are intentionally rejected by the production chat UI until the secure media key-wrapping contract is complete. No raw attachment key material is serialized as a production message fallback.

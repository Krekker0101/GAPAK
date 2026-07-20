# GAPAK Messaging System - Encryption Scheme

## Overview

End-to-end encryption (E2EE) implementation based on the Signal Protocol with Perfect Forward Secrecy (PFS), inspired by Signal, WhatsApp, and Telegram's security architecture.

---

## Cryptographic Foundations

### Algorithms Used

| Purpose | Algorithm | Key Size | Notes |
|---------|----------|----------|-------|
| Key Exchange | X25519 (Curve25519) | 256-bit | ECDH for key agreement |
| Signature | Ed25519 | 256-bit | EdDSA for authentication |
| Symmetric Encryption | AES-256-GCM | 256-bit | Authenticated encryption |
| Hash | SHA-256 | 256-bit | Key derivation, checksums |
| Key Derivation | HKDF-SHA256 | 256-bit | KDF for key material |
| Random Generation | CSPRNG | - | Cryptographically secure |

### Security Properties

- **End-to-End Encryption**: Server cannot access message content
- **Perfect Forward Secrecy**: Compromise of long-term keys doesn't compromise past messages
- **Post-Compromise Security**: Compromise of current state doesn't compromise future messages
- **Authentication**: All messages are authenticated with sender's identity
- **Replay Protection**: Messages cannot be replayed
- **Integrity**: Messages cannot be tampered with

---

## Key Architecture

### Key Types

#### 1. Identity Key Pair
- **Purpose**: Long-term identity for each user
- **Lifetime**: Permanent (rotated only on compromise)
- **Storage**: Encrypted at rest in HSM/Vault
- **Distribution**: Public key shared with all contacts

```go
type IdentityKeyPair struct {
    PrivateKey []byte // Ed25519 private key
    PublicKey  []byte // Ed25519 public key
    KeyID      string // Unique identifier
    CreatedAt  time.Time
}
```

#### 2. Signed Pre-Key
- **Purpose**: Medium-term key for X3DH handshake
- **Lifetime**: 7-30 days (rotated periodically)
- **Storage**: Encrypted at rest
- **Distribution**: Public key signed by identity key

```go
type SignedPreKey struct {
    KeyID      string
    PrivateKey []byte // X25519 private key
    PublicKey  []byte // X25519 public key
    Signature  []byte // Ed25519 signature
    CreatedAt  time.Time
    ExpiresAt  time.Time
}
```

#### 3. One-Time Pre-Key
- **Purpose**: Single-use key for X3DH handshake
- **Lifetime**: Single use, then deleted
- **Storage**: Encrypted at rest
- **Distribution**: Pool of 100+ keys per device

```go
type OneTimePreKey struct {
    KeyID      string
    PrivateKey []byte // X25519 private key
    PublicKey  []byte // X25519 public key
    CreatedAt  time.Time
    IsUsed     bool
}
```

#### 4. Root Key
- **Purpose**: Long-term key for Double Ratchet
- **Lifetime**: Per conversation
- **Storage**: Derived from X3DH, never stored
- **Usage**: Generates chain keys

#### 5. Chain Key
- **Purpose**: Message keys for sending/receiving
- **Lifetime**: Per message chain
- **Storage**: In-memory only
- **Usage**: Derives message keys

#### 6. Message Key
- **Purpose**: Encrypt individual messages
- **Lifetime**: Single use
- **Storage**: In-memory only
- **Usage**: AES-256-GCM encryption

---

## X3DH Key Exchange Protocol

### Overview

Extended Triple Diffie-Hellman (X3DH) for initial key establishment between two devices who have never communicated before.

### Protocol Steps

#### 1. Key Generation (Initial Setup)

Each device generates:
- Identity Key Pair (IK) - Long-term
- Signed Pre-Key (SPK) - Medium-term, signed by IK
- One-Time Pre-Key Pool (OPK) - Single-use

```go
func GenerateDeviceKeys() (*DeviceKeys, error) {
    // Generate identity key pair
    identityKey := ed25519.GenerateKey(nil)
    
    // Generate signed pre-key
    signedPreKey := x25519.GenerateKey(nil)
    signedPreKeySig := ed25519.Sign(identityKey, signedPreKey.Public)
    
    // Generate one-time pre-key pool
    oneTimePreKeys := make([]*OneTimePreKey, 100)
    for i := range oneTimePreKeys {
        key := x25519.GenerateKey(nil)
        oneTimePreKeys[i] = &OneTimePreKey{
            KeyID:      generateKeyID(),
            PrivateKey: key.Private,
            PublicKey:  key.Public,
            CreatedAt:  time.Now(),
        }
    }
    
    return &DeviceKeys{
        IdentityKey:     identityKey,
        SignedPreKey:    signedPreKey,
        OneTimePreKeys:  oneTimePreKeys,
    }, nil
}
```

#### 2. Key Publication

Device publishes public keys to server:
- Identity Key Public
- Signed Pre-Key Public + Signature
- One-Time Pre-Key Public (pool)

```go
type PreKeyBundle struct {
    UserID              string
    DeviceID            string
    IdentityKeyPublic   []byte
    SignedPreKeyPublic  []byte
    SignedPreKeySignature []byte
    OneTimePreKeyPublic []byte // Optional
}
```

#### 3. X3DH Handshake (Initiator)

Alice wants to message Bob:

```
Alice (Initiator)                    Bob (Recipient)
     |                                      |
     |  1. Fetch Bob's PreKeyBundle         |
     |<-------------------------------------|
     |                                      |
     |  2. Generate ephemeral key (EK_A)     |
     |                                      |
     |  3. Compute shared secrets:          |
     |     - DH1 = DH(IK_A, SPK_B)          |
     |     - DH2 = DH(EK_A, IK_B)          |
     |     - DH3 = DH(EK_A, SPK_B)          |
     |     - DH4 = DH(EK_A, OPK_B) [if OPK] |
     |                                      |
     |  4. Derive shared secret (SK)        |
     |     SK = KDF(DH1 || DH2 || DH3 || DH4)|
     |                                      |
     |  5. Send initial message with EK_A    |
     |------------------------------------->|
     |                                      |
```

```go
func PerformX3DH(initiatorKeys *DeviceKeys, recipientBundle *PreKeyBundle) (*SessionState, error) {
    // Generate ephemeral key
    ephemeralKey := x25519.GenerateKey(nil)
    
    // Compute DH shared secrets
    dh1 := x25519.DH(initiatorKeys.IdentityKey.Private, recipientBundle.SignedPreKeyPublic)
    dh2 := x25519.DH(ephemeralKey.Private, recipientBundle.IdentityKeyPublic)
    dh3 := x25519.DH(ephemeralKey.Private, recipientBundle.SignedPreKeyPublic)
    
    var dh4 []byte
    if recipientBundle.OneTimePreKeyPublic != nil {
        dh4 = x25519.DH(ephemeralKey.Private, recipientBundle.OneTimePreKeyPublic)
    }
    
    // Derive shared secret using HKDF
    salt := make([]byte, 32) // Or use context-specific salt
    inputKeyMaterial := concat(dh1, dh2, dh3, dh4)
    sharedSecret := hkdf.SHA256(salt, inputKeyMaterial, []byte("X3DH"))
    
    // Derive root key and chain keys
    rootKey := hkdf.SHA256(sharedSecret, nil, []byte("root"))
    sendingChainKey := hkdf.SHA256(rootKey, nil, []byte("sending_chain"))
    receivingChainKey := hkdf.SHA256(rootKey, nil, []byte("receiving_chain"))
    
    return &SessionState{
        RootKey:           rootKey,
        SendingChainKey:    sendingChainKey,
        ReceivingChainKey: receivingChainKey,
        RemoteIdentityKey: recipientBundle.IdentityKeyPublic,
        LocalEphemeralKey: ephemeralKey,
    }, nil
}
```

#### 4. X3DH Handshake (Recipient)

Bob receives Alice's initial message:

```
Alice (Initiator)                    Bob (Recipient)
     |                                      |
     |  5. Initial message with EK_A        |
     |------------------------------------->|
     |                                      |
     |  6. Compute shared secrets:          |
     |     - DH1 = DH(IK_B, EK_A)          |
     |     - DH2 = DH(SPK_B, EK_A)         |
     |     - DH3 = DH(IK_B, SPK_A) [if sent]|
     |     - DH4 = DH(OPK_B, EK_A) [if used]|
     |                                      |
     |  7. Derive shared secret (SK)        |
     |     SK = KDF(DH1 || DH2 || DH3 || DH4)|
     |                                      |
     |  8. Delete used one-time pre-key     |
     |                                      |
```

```go
func ReceiveX3DH(recipientKeys *DeviceKeys, initiatorEphemeralKey []byte) (*SessionState, error) {
    // Compute DH shared secrets
    dh1 := x25519.DH(recipientKeys.IdentityKey.Private, initiatorEphemeralKey)
    dh2 := x25519.DH(recipientKeys.SignedPreKey.Private, initiatorEphemeralKey)
    
    var dh3, dh4 []byte
    // DH3 and DH4 if applicable
    
    // Derive shared secret
    salt := make([]byte, 32)
    inputKeyMaterial := concat(dh1, dh2, dh3, dh4)
    sharedSecret := hkdf.SHA256(salt, inputKeyMaterial, []byte("X3DH"))
    
    // Derive root key and chain keys
    rootKey := hkdf.SHA256(sharedSecret, nil, []byte("root"))
    sendingChainKey := hkdf.SHA256(rootKey, nil, []byte("sending_chain"))
    receivingChainKey := hkdf.SHA256(rootKey, nil, []byte("receiving_chain"))
    
    return &SessionState{
        RootKey:           rootKey,
        SendingChainKey:    sendingChainKey,
        ReceivingChainKey: receivingChainKey,
        RemoteIdentityKey: initiatorEphemeralKey,
    }, nil
}
```

---

## Double Ratchet Algorithm

### Overview

Double Ratchet provides continuous key updates for ongoing conversations, ensuring Perfect Forward Secrecy and Post-Compromise Security.

### Components

1. **Symmetric-Key Ratchet**: Updates chain keys for each message
2. **Diffie-Hellman Ratchet**: Updates root key on each message exchange
3. **Skipping Message Keys**: Handles out-of-order delivery

### Ratchet Steps

#### Sending a Message

```go
func (r *DoubleRatchet) RatchetEncrypt(plaintext []byte) (*EncryptedMessage, error) {
    r.mutex.Lock()
    defer r.mutex.Unlock()
    
    // Derive message key from sending chain key
    messageKey, nextChainKey := kdf(r.sendingChainKey)
    r.sendingChainKey = nextChainKey
    
    // Encrypt message
    nonce := generateRandomNonce()
    ciphertext := aes256GCMEncrypt(messageKey, plaintext, nonce)
    
    // Increment send ratchet counter
    r.sendCounter++
    
    // Perform DH ratchet if needed
    if r.sendCounter%RATCHET_INTERVAL == 0 {
        r.performDHRatchet()
    }
    
    return &EncryptedMessage{
        Ciphertext:       ciphertext,
        Nonce:            nonce,
        DHPublicKey:      r.dhPublicKey,
        RatchetCounter:   r.sendCounter,
        PreviousChainLen: r.previousChainLength,
    }, nil
}
```

#### Receiving a Message

```go
func (r *DoubleRatchet) RatchetDecrypt(msg *EncryptedMessage) ([]byte, error) {
    r.mutex.Lock()
    defer r.mutex.Unlock()
    
    // Check if DH ratchet is needed
    if !bytes.Equal(msg.DHPublicKey, r.remoteDHPublicKey) {
        r.performDHRatchet(msg.DHPublicKey)
    }
    
    // Derive message key from receiving chain key
    messageKey, nextChainKey := kdf(r.receivingChainKey)
    r.receivingChainKey = nextChainKey
    
    // Decrypt message
    plaintext, err := aes256GCMDecrypt(messageKey, msg.Ciphertext, msg.Nonce)
    if err != nil {
        return nil, err
    }
    
    // Increment receive ratchet counter
    r.receiveCounter++
    
    return plaintext, nil
}
```

#### DH Ratchet

```go
func (r *DoubleRatchet) performDHRatchet(remotePublicKey []byte) {
    // Generate new DH key pair
    newDHKey := x25519.GenerateKey(nil)
    
    // Compute DH shared secret
    dhOutput := x25519.DH(newDHKey.Private, remotePublicKey)
    
    // Derive new root key and chain keys
    newRootKey := kdf(r.rootKey, dhOutput)
    r.rootKey = newRootKey
    
    // Derive new chain keys
    r.sendingChainKey = kdf(r.rootKey, []byte("sending_chain"))
    r.receivingChainKey = kdf(r.rootKey, []byte("receiving_chain"))
    
    // Update DH keys
    r.dhPublicKey = newDHKey.Public
    r.remoteDHPublicKey = remotePublicKey
    
    // Reset counters
    r.sendCounter = 0
    r.receiveCounter = 0
}
```

---

## Message Encryption

### Message Structure

```go
type EncryptedMessage struct {
    // Version
    Version uint32 = 3
    
    // Ratchet information
    DHPublicKey      []byte
    RatchetCounter   uint64
    PreviousChainLen uint32
    
    // Message content
    Ciphertext []byte
    Nonce      []byte
    
    // Authentication
    MAC []byte
    
    // Metadata
    Timestamp uint64
}
```

### Encryption Process

```go
func EncryptMessage(plaintext []byte, session *SessionState) (*EncryptedMessage, error) {
    // 1. Ratchet encrypt
    encrypted, err := session.DoubleRatchet.RatchetEncrypt(plaintext)
    if err != nil {
        return nil, err
    }
    
    // 2. Add timestamp
    encrypted.Timestamp = uint64(time.Now().Unix())
    
    // 3. Compute MAC for authentication
    mac := hmacSHA256(concat(
        encrypted.Ciphertext,
        encrypted.Nonce,
        encrypted.DHPublicKey,
    ))
    encrypted.MAC = mac
    
    return encrypted, nil
}
```

### Decryption Process

```go
func DecryptMessage(encrypted *EncryptedMessage, session *SessionState) ([]byte, error) {
    // 1. Verify MAC
    expectedMAC := hmacSHA256(concat(
        encrypted.Ciphertext,
        encrypted.Nonce,
        encrypted.DHPublicKey,
    ))
    if !hmac.Equal(encrypted.MAC, expectedMAC) {
        return nil, errors.New("MAC verification failed")
    }
    
    // 2. Check timestamp (replay protection)
    messageTime := time.Unix(int64(encrypted.Timestamp), 0)
    if time.Since(messageTime) > 5*time.Minute {
        return nil, errors.New("message too old")
    }
    
    // 3. Ratchet decrypt
    plaintext, err := session.DoubleRatchet.RatchetDecrypt(encrypted)
    if err != nil {
        return nil, err
    }
    
    return plaintext, nil
}
```

---

## Key Storage and Management

### Key Storage Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Key Storage Layers                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Client Device (Encrypted at Rest)              │  │
│  │  - Identity Key (encrypted with device key)      │  │
│  │  - Session States (encrypted)                    │  │
│  │  - Pre-Keys (encrypted)                          │  │
│  └─────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Server (Encrypted at Rest)                     │  │
│  │  - Public Keys (stored in PostgreSQL)           │  │
│  │  - Private Keys (encrypted in Vault/HSM)        │  │
│  │  - Session Metadata (PostgreSQL)                │  │
│  └─────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  ┌─────────────────────────────────────────────────┐  │
│  │  HSM / Vault (Hardware Security Module)        │  │
│  │  - Master Encryption Keys                       │  │
│  │  - Key Encryption Keys (KEKs)                   │  │
│  │  - Audit Logging                               │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Rotation Strategy

#### Identity Key Rotation
- Trigger: Key compromise or annual rotation
- Process: Generate new identity key, re-sign all pre-keys
- Transition: Support old key for 30 days during migration

#### Signed Pre-Key Rotation
- Frequency: Every 7-30 days
- Process: Generate new signed pre-key, sign with identity key
- Transition: Support old key until expiration

#### One-Time Pre-Key Rotation
- Frequency: Continuous
- Process: Generate new keys when pool < 50
- Transition: Immediate

#### Session Key Rotation
- Frequency: Every message (Double Ratchet)
- Process: Automatic via ratchet algorithm
- Transition: N/A (continuous)

### Key Backup and Recovery

#### Secure Backup

```go
type KeyBackup struct {
    UserID           string
    EncryptedBackup  []byte // Encrypted with user's backup key
    BackupKeyID      string
    CreatedAt        time.Time
    Version          int
}

func CreateKeyBackup(keys *DeviceKeys, backupKey []byte) (*KeyBackup, error) {
    // Serialize keys
    keyData := serializeKeys(keys)
    
    // Encrypt with backup key
    encryptedBackup := aes256GCMEncrypt(backupKey, keyData, generateNonce())
    
    return &KeyBackup{
        EncryptedBackup: encryptedBackup,
        BackupKeyID:    hash(backupKey),
        CreatedAt:      time.Now(),
        Version:        1,
    }, nil
}
```

#### Recovery

```go
func RestoreKeyBackup(backup *KeyBackup, backupKey []byte) (*DeviceKeys, error) {
    // Decrypt backup
    keyData, err := aes256GCMDecrypt(backupKey, backup.EncryptedBackup, backup.Nonce)
    if err != nil {
        return nil, err
    }
    
    // Deserialize keys
    keys, err := deserializeKeys(keyData)
    if err != nil {
        return nil, err
    }
    
    return keys, nil
}
```

---

## Security Features

### Replay Attack Prevention

1. **Timestamp Validation**: Reject messages older than 5 minutes
2. **Message Counters**: Track highest received counter per session
3. **Nonce Tracking**: Ensure nonces are never reused
4. **Duplicate Detection**: Track message IDs in sliding window

```go
func (s *SessionState) ValidateMessage(msg *EncryptedMessage) error {
    // Check timestamp
    if time.Since(time.Unix(int64(msg.Timestamp), 0)) > 5*time.Minute {
        return errors.New("message timestamp too old")
    }
    
    // Check counter
    if msg.RatchetCounter <= s.lastReceivedCounter {
        return errors.New("duplicate or out-of-order message")
    }
    
    // Check nonce
    if s.usedNonces[msg.Nonce] {
        return errors.New("nonce already used")
    }
    
    return nil
}
```

### MITM Protection

1. **X3DH Signature Verification**: Verify signed pre-key signatures
2. **Identity Key Fingerprint**: Display key fingerprint to users
3. **Safety Number**: Compute and compare safety numbers

```go
func ComputeSafetyNumber(identityKeyA, identityKeyB []byte) string {
    // Concatenate identity keys
    combined := concat(identityKeyA, identityKeyB)
    
    // Compute SHA-256 hash
    hash := sha256.Sum256(combined)
    
    // Encode as hex string (typically 60 digits)
    return hex.EncodeToString(hash[:])[:60]
}
```

### Perfect Forward Secrecy

- **X3DH**: Initial key exchange uses ephemeral keys
- **Double Ratchet**: Each message uses new key
- **Key Deletion**: Delete message keys after use
- **No Key Storage**: Never store derived keys

### Post-Compromise Security

- **DH Ratchet**: Regular DH ratchet updates root key
- **Self-Healing**: Compromise is healed after a few messages
- **Key Rotation**: Regular rotation of long-term keys

---

## Implementation Best Practices

### 1. Constant-Time Operations

```go
// Use constant-time comparison for secrets
if subtle.ConstantTimeCompare(mac1, mac2) != 1 {
    return errors.New("MAC mismatch")
}
```

### 2. Secure Random Generation

```go
func generateRandomBytes(n int) []byte {
    b := make([]byte, n)
    _, err := rand.Read(b)
    if err != nil {
        panic(err) // Should never happen
    }
    return b
}
```

### 3. Memory Security

```go
// Securely wipe sensitive data from memory
func secureWipe(data []byte) {
    for i := range data {
        data[i] = 0
    }
    runtime.KeepAlive(data) // Prevent optimization
}
```

### 4. Error Handling

```go
// Never leak sensitive information in errors
func decryptMessage(key, ciphertext []byte) ([]byte, error) {
    plaintext, err := aes256GCMDecrypt(key, ciphertext)
    if err != nil {
        return nil, errors.New("decryption failed") // Generic error
    }
    return plaintext, nil
}
```

### 5. Key Validation

```go
func validatePublicKey(key []byte) error {
    if len(key) != 32 {
        return errors.New("invalid key length")
    }
    // Additional validation as needed
    return nil
}
```

---

## Compliance and Auditing

### Key Usage Logging

```go
type KeyUsageLog struct {
    KeyID      string
    UserID     string
    Action     string // generated, used, rotated, deleted
    Timestamp  time.Time
    IPAddress  string
    UserAgent  string
}

func LogKeyUsage(log *KeyUsageLog) {
    // Send to audit service
    auditService.LogKeyUsage(log)
}
```

### Key Access Monitoring

- Log all key access attempts
- Alert on unusual access patterns
- Require approval for sensitive operations
- Regular security audits

---

## Performance Considerations

### Caching Strategy

- Cache public keys in Redis (TTL: 1 hour)
- Cache pre-key bundles (TTL: 5 minutes)
- Cache session states in memory (per connection)

### Batch Operations

- Batch key generation for pre-key pools
- Batch encryption for message batches
- Batch decryption for message sync

### Optimization

- Use hardware acceleration for AES-NI
- Pre-compute DH operations where possible
- Use connection pooling for database access
- Implement message batching for high throughput

---

## Testing and Validation

### Cryptographic Testing

```go
func TestX3DH(t *testing.T) {
    // Generate keys for both parties
    aliceKeys := GenerateDeviceKeys()
    bobKeys := GenerateDeviceKeys()
    
    // Alice performs X3DH
    bobBundle := bobKeys.GetPreKeyBundle()
    aliceSession, err := PerformX3DH(aliceKeys, bobBundle)
    assert.NoError(t, err)
    
    // Bob receives X3DH
    bobSession, err := ReceiveX3DH(bobKeys, aliceSession.LocalEphemeralKey)
    assert.NoError(t, err)
    
    // Verify shared secrets match
    assert.Equal(t, aliceSession.RootKey, bobSession.RootKey)
}
```

### Security Testing

- Penetration testing by security firm
- Fuzz testing for cryptographic implementations
- Side-channel attack resistance testing
- Formal verification of protocols

---

## References

- Signal Protocol: https://signal.org/docs/
- X3DH Specification: https://signal.org/docs/specifications/x3dh/
- Double Ratchet: https://signal.org/docs/specifications/doubleratchet/
- NIST Cryptographic Standards: https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines

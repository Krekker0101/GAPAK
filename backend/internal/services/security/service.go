package security

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/hkdf"
)

// Service handles cryptographic operations
type Service struct {
	keyStore KeyStore
	logger   Logger
}

// KeyStore interface for key storage
type KeyStore interface {
	StoreKey(ctx context.Context, keyID string, keyData []byte) error
	GetKey(ctx context.Context, keyID string) ([]byte, error)
	DeleteKey(ctx context.Context, keyID string) error
}

// Logger interface for logging
type Logger interface {
	Error(msg string, fields ...interface{})
	Info(msg string, fields ...interface{})
}

// NewService creates a new security service
func NewService(keyStore KeyStore, logger Logger) *Service {
	return &Service{
		keyStore: keyStore,
		logger:   logger,
	}
}

// GenerateIdentityKeyPair generates an Ed25519 identity key pair
func (s *Service) GenerateIdentityKeyPair(ctx context.Context) (*IdentityKeyPair, error) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to generate identity key pair: %w", err)
	}

	keyID := generateKeyID()

	// Store private key encrypted
	encryptedPrivateKey, err := s.encryptPrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt private key: %w", err)
	}

	if err := s.keyStore.StoreKey(ctx, keyID, encryptedPrivateKey); err != nil {
		return nil, fmt.Errorf("failed to store private key: %w", err)
	}

	return &IdentityKeyPair{
		KeyID:      keyID,
		PublicKey:  publicKey,
		PrivateKey: privateKey,
		CreatedAt:  time.Now(),
	}, nil
}

// GenerateSignedPreKey generates an X25519 signed pre-key
func (s *Service) GenerateSignedPreKey(ctx context.Context, identityKey ed25519.PrivateKey) (*SignedPreKey, error) {
	// Generate X25519 key pair
	curve := ecdh.X25519()
	privateKey, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate signed pre-key: %w", err)
	}
	publicKey := privateKey.PublicKey().Bytes()

	// Sign with identity key
	signature := ed25519.Sign(identityKey, publicKey)

	keyID := generateKeyID()

	// Store private key encrypted
	encryptedPrivateKey, err := s.encryptPrivateKey(privateKey.Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt private key: %w", err)
	}

	if err := s.keyStore.StoreKey(ctx, keyID, encryptedPrivateKey); err != nil {
		return nil, fmt.Errorf("failed to store private key: %w", err)
	}

	return &SignedPreKey{
		KeyID:      keyID,
		PublicKey:  publicKey,
		PrivateKey: privateKey.Bytes(),
		Signature:  signature,
		CreatedAt:  time.Now(),
		ExpiresAt:  time.Now().Add(30 * 24 * time.Hour), // 30 days
	}, nil
}

// GenerateOneTimePreKey generates a one-time pre-key
func (s *Service) GenerateOneTimePreKey(ctx context.Context) (*OneTimePreKey, error) {
	// Generate X25519 key pair
	curve := ecdh.X25519()
	privateKey, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate one-time pre-key: %w", err)
	}
	publicKey := privateKey.PublicKey().Bytes()

	keyID := generateKeyID()

	// Store private key encrypted
	encryptedPrivateKey, err := s.encryptPrivateKey(privateKey.Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt private key: %w", err)
	}

	if err := s.keyStore.StoreKey(ctx, keyID, encryptedPrivateKey); err != nil {
		return nil, fmt.Errorf("failed to store private key: %w", err)
	}

	return &OneTimePreKey{
		KeyID:      keyID,
		PublicKey:  publicKey,
		PrivateKey: privateKey.Bytes(),
		CreatedAt:  time.Now(),
		IsUsed:     false,
	}, nil
}

// PerformX3DH performs the X3DH key exchange
func (s *Service) PerformX3DH(ctx context.Context, initiatorKeys *DeviceKeys, recipientBundle *PreKeyBundle) (*SessionState, error) {
	// Generate ephemeral key
	curve := ecdh.X25519()
	ephemeralKey, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate ephemeral key: %w", err)
	}

	// Compute DH shared secrets
	dh1, err := s.computeDH(initiatorKeys.IdentityKey, recipientBundle.SignedPreKeyPublic)
	if err != nil {
		return nil, fmt.Errorf("failed to compute DH1: %w", err)
	}

	dh2, err := s.computeDH(ephemeralKey.Bytes(), recipientBundle.IdentityKeyPublic)
	if err != nil {
		return nil, fmt.Errorf("failed to compute DH2: %w", err)
	}

	dh3, err := s.computeDH(ephemeralKey.Bytes(), recipientBundle.SignedPreKeyPublic)
	if err != nil {
		return nil, fmt.Errorf("failed to compute DH3: %w", err)
	}

	var dh4 []byte
	if recipientBundle.OneTimePreKeyPublic != nil {
		dh4, err = s.computeDH(ephemeralKey.Bytes(), recipientBundle.OneTimePreKeyPublic)
		if err != nil {
			return nil, fmt.Errorf("failed to compute DH4: %w", err)
		}
	}

	// Derive shared secret using HKDF
	salt := make([]byte, 32)
	if _, err := rand.Read(salt); err != nil {
		return nil, fmt.Errorf("failed to generate salt: %w", err)
	}

	inputKeyMaterial := concat(dh1, dh2, dh3, dh4)
	sharedSecret := s.hkdfSHA256(salt, inputKeyMaterial, []byte("X3DH"))

	// Derive root key and chain keys
	rootKey := s.hkdfSHA256(sharedSecret, nil, []byte("root"))
	sendingChainKey := s.hkdfSHA256(rootKey, nil, []byte("sending_chain"))
	receivingChainKey := s.hkdfSHA256(rootKey, nil, []byte("receiving_chain"))

	return &SessionState{
		SessionID:         generateSessionID(),
		RootKey:           rootKey,
		SendingChainKey:   sendingChainKey,
		ReceivingChainKey: receivingChainKey,
		RemoteIdentityKey: recipientBundle.IdentityKeyPublic,
		LocalEphemeralKey: ephemeralKey.Bytes(),
		CreatedAt:         time.Now(),
	}, nil
}

// EncryptMessage encrypts a message using AES-256-GCM
func (s *Service) EncryptMessage(plaintext []byte, key []byte) (*EncryptedMessage, error) {
	if len(key) != 32 {
		return nil, errors.New("key must be 32 bytes")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)

	return &EncryptedMessage{
		Ciphertext: ciphertext,
		Nonce:      nonce,
	}, nil
}

// DecryptMessage decrypts a message using AES-256-GCM
func (s *Service) DecryptMessage(ciphertext []byte, nonce []byte, key []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, errors.New("key must be 32 bytes")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	return plaintext, nil
}

// VerifySignature verifies an Ed25519 signature
func (s *Service) VerifySignature(message []byte, signature []byte, publicKey ed25519.PublicKey) bool {
	return ed25519.Verify(publicKey, message, signature)
}

// ComputeSafetyNumber computes a safety number for two identity keys
func (s *Service) ComputeSafetyNumber(identityKeyA, identityKeyB []byte) string {
	combined := concat(identityKeyA, identityKeyB)
	hash := sha256.Sum256(combined)
	return hex.EncodeToString(hash[:])[:60]
}

// computeDH computes Diffie-Hellman shared secret
func (s *Service) computeDH(privateKey, publicKey []byte) ([]byte, error) {
	curve := ecdh.X25519()

	priv, err := curve.NewPrivateKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create private key: %w", err)
	}

	pub, err := curve.NewPublicKey(publicKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create public key: %w", err)
	}

	sharedSecret, err := priv.ECDH(pub)
	if err != nil {
		return nil, fmt.Errorf("failed to compute ECDH: %w", err)
	}

	return sharedSecret, nil
}

// hkdfSHA256 performs HKDF-SHA256 key derivation
func (s *Service) hkdfSHA256(salt, ikm, info []byte) []byte {
	hkdf := hkdf.New(sha256.New, ikm, salt, info)
	key := make([]byte, 32)
	if _, err := hkdf.Read(key); err != nil {
		panic(err) // Should never happen with correct parameters
	}
	return key
}

// encryptPrivateKey encrypts a private key using a master key
func (s *Service) encryptPrivateKey(privateKey []byte) ([]byte, error) {
	// In production, use a master key from HSM/Vault
	masterKey := make([]byte, 32)
	if _, err := rand.Read(masterKey); err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	encrypted := gcm.Seal(nil, nonce, privateKey, nil)
	return append(nonce, encrypted...), nil
}

// concat concatenates byte slices
func concat(slices ...[]byte) []byte {
	var totalLen int
	for _, s := range slices {
		totalLen += len(s)
	}

	result := make([]byte, totalLen)
	var offset int
	for _, s := range slices {
		copy(result[offset:], s)
		offset += len(s)
	}

	return result
}

// generateKeyID generates a unique key ID
func generateKeyID() string {
	return fmt.Sprintf("key_%d", time.Now().UnixNano())
}

// generateSessionID generates a unique session ID
func generateSessionID() string {
	return fmt.Sprintf("session_%d", time.Now().UnixNano())
}

// IdentityKeyPair represents an identity key pair
type IdentityKeyPair struct {
	KeyID      string
	PublicKey  ed25519.PublicKey
	PrivateKey ed25519.PrivateKey
	CreatedAt  time.Time
}

// SignedPreKey represents a signed pre-key
type SignedPreKey struct {
	KeyID      string
	PublicKey  []byte
	PrivateKey []byte
	Signature  []byte
	CreatedAt  time.Time
	ExpiresAt  time.Time
}

// OneTimePreKey represents a one-time pre-key
type OneTimePreKey struct {
	KeyID      string
	PublicKey  []byte
	PrivateKey []byte
	CreatedAt  time.Time
	IsUsed     bool
}

// DeviceKeys represents all keys for a device
type DeviceKeys struct {
	IdentityKey    ed25519.PrivateKey
	SignedPreKey   *SignedPreKey
	OneTimePreKeys []*OneTimePreKey
}

// PreKeyBundle represents a pre-key bundle for X3DH
type PreKeyBundle struct {
	UserID                string
	DeviceID              string
	IdentityKeyPublic     []byte
	SignedPreKeyPublic    []byte
	SignedPreKeySignature []byte
	OneTimePreKeyPublic   []byte
}

// SessionState represents a session state after X3DH
type SessionState struct {
	SessionID         string
	RootKey           []byte
	SendingChainKey   []byte
	ReceivingChainKey []byte
	RemoteIdentityKey []byte
	LocalEphemeralKey []byte
	CreatedAt         time.Time
}

// EncryptedMessage represents an encrypted message
type EncryptedMessage struct {
	Ciphertext []byte
	Nonce      []byte
}

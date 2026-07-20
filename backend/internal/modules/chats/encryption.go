package chats

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

var (
	ErrInvalidKeyLength = errors.New("invalid key length: must be 32 bytes for AES-256")
	ErrInvalidNonce     = errors.New("invalid nonce: must be 12 bytes for GCM")
)

type EncryptionService struct {
	key []byte
}

func NewEncryptionService(key string) (*EncryptionService, error) {
	keyBytes, err := base64.StdEncoding.DecodeString(key)
	if err != nil {
		return nil, err
	}

	if len(keyBytes) != 32 {
		return nil, ErrInvalidKeyLength
	}

	return &EncryptionService{
		key: keyBytes,
	}, nil
}

func (s *EncryptionService) Encrypt(plaintext []byte) (string, string, error) {
	block, err := aes.NewCipher(s.key)
	if err != nil {
		return "", "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", "", err
	}

	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)

	ciphertextBase64 := base64.StdEncoding.EncodeToString(ciphertext)
	nonceBase64 := base64.StdEncoding.EncodeToString(nonce)

	return ciphertextBase64, nonceBase64, nil
}

func (s *EncryptionService) Decrypt(ciphertextBase64, nonceBase64 string) ([]byte, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextBase64)
	if err != nil {
		return nil, err
	}

	nonce, err := base64.StdEncoding.DecodeString(nonceBase64)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(s.key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, err
	}

	return plaintext, nil
}

func (s *EncryptionService) GenerateKey() (string, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(key), nil
}

func (s *EncryptionService) GenerateNonce() (string, error) {
	nonce := make([]byte, 12)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(nonce), nil
}

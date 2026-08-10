package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

var ErrInvalidKeyLength = errors.New("crypto: key must be 32 bytes for AES-256")

type Encryptor struct {
	key []byte
}

func NewEncryptor(base64Key string) (*Encryptor, error) {
	key, err := base64.StdEncoding.DecodeString(base64Key)
	if err != nil {
		return nil, err
	}
	return NewEncryptorFromBytes(key)
}

func NewEncryptorFromBytes(key []byte) (*Encryptor, error) {
	if len(key) != 32 {
		return nil, ErrInvalidKeyLength
	}
	return &Encryptor{key: key}, nil
}

func (e *Encryptor) Encrypt(plaintext string) (string, string, error) {
	return e.EncryptWithAAD(plaintext, "")
}

func (e *Encryptor) EncryptWithAAD(plaintext, aad string) (string, string, error) {
	ciphertext, nonce, err := e.EncryptRaw([]byte(plaintext), []byte(aad))
	if err != nil {
		return "", "", err
	}
	return base64.StdEncoding.EncodeToString(ciphertext), base64.StdEncoding.EncodeToString(nonce), nil
}

func (e *Encryptor) Decrypt(ciphertext, nonce string) (string, error) {
	return e.DecryptWithAAD(ciphertext, nonce, "")
}

func (e *Encryptor) DecryptWithAAD(ciphertext, nonce, aad string) (string, error) {
	rawCiphertext, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	rawNonce, err := base64.StdEncoding.DecodeString(nonce)
	if err != nil {
		return "", err
	}
	plaintext, err := e.DecryptRaw(rawCiphertext, rawNonce, []byte(aad))
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

func (e *Encryptor) EncryptRaw(plaintext, aad []byte) ([]byte, []byte, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return nil, nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, err
	}
	ciphertext := gcm.Seal(nil, nonce, plaintext, aad)
	return ciphertext, nonce, nil
}

func (e *Encryptor) DecryptRaw(ciphertext, nonce, aad []byte) ([]byte, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, nonce, ciphertext, aad)
}

func EncryptWithKey(plaintext, key, aad []byte) ([]byte, []byte, error) {
	if len(key) != 32 {
		return nil, nil, ErrInvalidKeyLength
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, err
	}
	ciphertext := gcm.Seal(nil, nonce, plaintext, aad)
	return ciphertext, nonce, nil
}

func DecryptWithKey(ciphertext, nonce, key, aad []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, ErrInvalidKeyLength
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, nonce, ciphertext, aad)
}

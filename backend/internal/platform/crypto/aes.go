package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"io"
)

type Encryptor struct {
	key []byte
}

func NewEncryptor(base64Key string) (*Encryptor, error) {
	key, err := base64.StdEncoding.DecodeString(base64Key)
	if err != nil {
		return nil, err
	}
	return &Encryptor{key: key}, nil
}

func (e *Encryptor) Encrypt(plaintext string) (string, string, error) {
	block, err := aes.NewCipher(e.key)
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
	ciphertext := gcm.Seal(nil, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), base64.StdEncoding.EncodeToString(nonce), nil
}

func (e *Encryptor) Decrypt(ciphertext, nonce string) (string, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	rawCiphertext, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	rawNonce, err := base64.StdEncoding.DecodeString(nonce)
	if err != nil {
		return "", err
	}
	plaintext, err := gcm.Open(nil, rawNonce, rawCiphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}

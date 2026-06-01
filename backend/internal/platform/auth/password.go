package auth

import (
	"strings"

	"github.com/alexedwards/argon2id"
)

type PasswordManager struct {
	pepper string
	params *argon2id.Params
}

func NewPasswordManager(pepper string) *PasswordManager {
	return &PasswordManager{
		pepper: pepper,
		params: &argon2id.Params{
			Memory:      256 * 1024,
			Iterations:  3,
			Parallelism: 2,
			SaltLength:  16,
			KeyLength:   32,
		},
	}
}

func (m *PasswordManager) Hash(password string) (string, error) {
	return argon2id.CreateHash(strings.TrimSpace(password)+m.pepper, m.params)
}

func (m *PasswordManager) Compare(password, hash string) (bool, error) {
	return argon2id.ComparePasswordAndHash(strings.TrimSpace(password)+m.pepper, hash)
}

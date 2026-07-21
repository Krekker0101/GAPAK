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
			// OWASP 2023 recommends at least 19 MiB; 64 MiB with 4 iterations is
			// a reasonable high-load balance between brute-force resistance and
			// login latency. Existing hashes remain valid because argon2id's
			// encoded hash stores the parameters used at creation time.
			Memory:      64 * 1024 * 1024,
			Iterations:  4,
			Parallelism: 4,
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

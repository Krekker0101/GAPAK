package csrf

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const defaultBootstrapTTL = 15 * time.Minute
const redisKeyPrefix = "gapak:csrf:"

type Store interface {
	Issue(ctx context.Context, sessionID string, ttl time.Duration) (string, error)
	Validate(ctx context.Context, sessionID, token string) (bool, error)
	Delete(ctx context.Context, sessionID string) error
}

// MemoryStore is the development/test implementation. Only a digest of each
// CSRF token is retained by the server; the plaintext token is never stored.
type MemoryStore struct {
	mu      sync.Mutex
	entries map[string]memoryEntry
}

type memoryEntry struct {
	digest  string
	expires time.Time
}

func NewMemoryStore() *MemoryStore { return &MemoryStore{entries: make(map[string]memoryEntry)} }

func (s *MemoryStore) Issue(_ context.Context, sessionID string, ttl time.Duration) (string, error) {
	if ttl <= 0 {
		ttl = defaultBootstrapTTL
	}
	token, err := randomToken(32)
	if err != nil {
		return "", err
	}
	key := storageKey(sessionID, token)
	now := time.Now().UTC()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.purgeExpiredLocked(now)
	s.entries[key] = memoryEntry{digest: digest(token), expires: now.Add(ttl)}
	return token, nil
}

func (s *MemoryStore) Validate(_ context.Context, sessionID, token string) (bool, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return false, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.entries[storageKey(sessionID, token)]
	if !ok {
		return false, nil
	}
	if !entry.expires.After(time.Now().UTC()) {
		delete(s.entries, storageKey(sessionID, token))
		return false, nil
	}
	return subtle.ConstantTimeCompare([]byte(entry.digest), []byte(digest(token))) == 1, nil
}

func (s *MemoryStore) Delete(_ context.Context, sessionID string) error {
	if sessionID == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	prefix := sessionKeyPrefix(sessionID)
	for key := range s.entries {
		if strings.HasPrefix(key, prefix) {
			delete(s.entries, key)
		}
	}
	return nil
}

func (s *MemoryStore) purgeExpiredLocked(now time.Time) {
	for key, entry := range s.entries {
		if !entry.expires.After(now) {
			delete(s.entries, key)
		}
	}
}

type RedisStore struct{ redis *redis.Client }

func NewRedisStore(client *redis.Client) *RedisStore { return &RedisStore{redis: client} }

func (s *RedisStore) Issue(ctx context.Context, sessionID string, ttl time.Duration) (string, error) {
	if s == nil || s.redis == nil {
		return "", errors.New("csrf redis store is unavailable")
	}
	if ttl <= 0 {
		ttl = defaultBootstrapTTL
	}
	token, err := randomToken(32)
	if err != nil {
		return "", err
	}
	if err := s.redis.Set(ctx, storageKey(sessionID, token), digest(token), ttl).Err(); err != nil {
		return "", err
	}
	return token, nil
}

func (s *RedisStore) Validate(ctx context.Context, sessionID, token string) (bool, error) {
	if s == nil || s.redis == nil {
		return false, errors.New("csrf redis store is unavailable")
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return false, nil
	}
	stored, err := s.redis.Get(ctx, storageKey(sessionID, token)).Result()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return subtle.ConstantTimeCompare([]byte(stored), []byte(digest(token))) == 1, nil
}

func (s *RedisStore) Delete(ctx context.Context, sessionID string) error {
	if s == nil || s.redis == nil || sessionID == "" {
		return nil
	}
	pattern := sessionKeyPrefix(sessionID) + "*"
	var cursor uint64
	keysToDelete := make([]string, 0, 8)
	for {
		keys, next, err := s.redis.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			return err
		}
		keysToDelete = append(keysToDelete, keys...)
		cursor = next
		if cursor == 0 {
			break
		}
	}
	// Do not mutate the scanned keyspace until iteration is complete; deleting
	// during SCAN can make later cursor pages unstable. Session revocation still
	// protects against a token issued concurrently with this cleanup.
	for len(keysToDelete) > 0 {
		batchSize := min(100, len(keysToDelete))
		if err := s.redis.Unlink(ctx, keysToDelete[:batchSize]...).Err(); err != nil {
			return err
		}
		keysToDelete = keysToDelete[batchSize:]
	}
	return nil
}

func storageKey(sessionID, token string) string {
	if sessionID == "" {
		return redisKeyPrefix + "bootstrap:" + digest(token)
	}
	return sessionKeyPrefix(sessionID) + digest(token)
}

func sessionKeyPrefix(sessionID string) string {
	return redisKeyPrefix + "session:" + sessionID + ":"
}

func digest(token string) string {
	sum := sha256.Sum256([]byte(token))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func randomToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

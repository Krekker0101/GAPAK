package sync

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type cursorPayload struct {
	Version  int    `json:"v"`
	Scope    string `json:"s"`
	UserHash string `json:"u"`
	Snapshot int64  `json:"p"`
	After    int64  `json:"a"`
	IssuedAt int64  `json:"t"`
}

type CursorCodec struct {
	secret []byte
	ttl    time.Duration
}

func NewCursorCodec(secret string) *CursorCodec {
	sum := sha256.Sum256([]byte("gapak-sync-v1:" + secret))
	return &CursorCodec{secret: sum[:], ttl: 24 * time.Hour}
}

func (c *CursorCodec) Encode(userID string, snapshot, after int64, now time.Time) (string, error) {
	if c == nil || len(c.secret) == 0 || userID == "" || snapshot < 0 || after < 0 || (snapshot != 0 && after > snapshot) {
		return "", fmt.Errorf("invalid sync cursor state")
	}
	now = now.UTC()
	payload := cursorPayload{
		Version:  1,
		Scope:    "sync-v1",
		UserHash: hashUser(userID),
		Snapshot: snapshot,
		After:    after,
		IssuedAt: now.Unix(),
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	body := base64.RawURLEncoding.EncodeToString(raw)
	sig := c.sign(body, userID)
	return body + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

func (c *CursorCodec) Decode(userID, raw string, now time.Time) (snapshot, after int64, err error) {
	if c == nil || len(c.secret) == 0 {
		return 0, 0, fmt.Errorf("sync cursor codec unavailable")
	}
	parts := strings.Split(raw, ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return 0, 0, fmt.Errorf("sync cursor invalid")
	}
	expected := c.sign(parts[0], userID)
	got, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || !hmac.Equal(expected, got) {
		return 0, 0, fmt.Errorf("sync cursor invalid")
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return 0, 0, fmt.Errorf("sync cursor invalid")
	}
	var payload cursorPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return 0, 0, fmt.Errorf("sync cursor invalid")
	}
	if payload.Version != 1 || payload.Scope != "sync-v1" || payload.UserHash != hashUser(userID) || payload.Snapshot < 0 || payload.After < 0 || (payload.Snapshot != 0 && payload.After > payload.Snapshot) {
		return 0, 0, fmt.Errorf("sync cursor invalid")
	}
	now = now.UTC()
	issued := time.Unix(payload.IssuedAt, 0).UTC()
	if payload.IssuedAt <= 0 || issued.After(now.Add(2*time.Minute)) || now.Sub(issued) > c.ttl {
		return 0, 0, fmt.Errorf("sync cursor expired")
	}
	return payload.Snapshot, payload.After, nil
}

func (c *CursorCodec) sign(body, userID string) []byte {
	mac := hmac.New(sha256.New, c.secret)
	mac.Write([]byte(userID))
	mac.Write([]byte{0})
	mac.Write([]byte(body))
	return mac.Sum(nil)
}

func hashUser(userID string) string {
	sum := sha256.Sum256([]byte(userID))
	return hexString(sum[:])
}

func hexString(b []byte) string {
	const hexdigits = "0123456789abcdef"
	out := make([]byte, len(b)*2)
	for i, v := range b {
		out[i*2] = hexdigits[v>>4]
		out[i*2+1] = hexdigits[v&0x0f]
	}
	return string(out)
}

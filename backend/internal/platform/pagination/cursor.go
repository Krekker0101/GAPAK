package pagination

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"
)

// Cursor is an opaque, deterministic keyset cursor for DESC time/id feeds.
type Cursor struct {
	Time time.Time `json:"t"`
	ID   string    `json:"i"`
}

func Encode(c Cursor) (string, error) {
	if c.ID == "" || c.Time.IsZero() {
		return "", fmt.Errorf("invalid cursor")
	}
	raw, err := json.Marshal(c)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func Decode(raw string) (Cursor, error) {
	var c Cursor
	if raw == "" {
		return c, fmt.Errorf("empty cursor")
	}
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return c, fmt.Errorf("invalid cursor encoding")
	}
	if err := json.Unmarshal(data, &c); err != nil {
		return c, fmt.Errorf("invalid cursor payload")
	}
	if c.ID == "" || c.Time.IsZero() {
		return c, fmt.Errorf("invalid cursor")
	}
	return c, nil
}

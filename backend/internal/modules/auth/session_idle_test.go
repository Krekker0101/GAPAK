package auth

import (
	"testing"
	"time"
)

func TestSessionIdleExpired(t *testing.T) {
	now := time.Date(2026, time.August, 27, 12, 0, 0, 0, time.UTC)
	sevenDays := 7 * 24 * time.Hour

	if sessionIdleExpired(now.Add(-sevenDays).Add(time.Second), sevenDays, now) {
		t.Fatal("recently active session must remain valid")
	}
	if !sessionIdleExpired(now.Add(-sevenDays), sevenDays, now) {
		t.Fatal("session must expire exactly at the idle boundary")
	}
	if sessionIdleExpired(now.Add(-30*24*time.Hour), 0, now) {
		t.Fatal("disabled idle TTL must not expire a session")
	}
}

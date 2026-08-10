package logger

import "testing"

func TestSanitizeSensitiveData(t *testing.T) {
	input := `authorization: Bearer abc123 refresh_token=refresh-secret password=hunter2 secret=super-secret cookie=session-secret`
	got := Sanitize(input)
	for _, secret := range []string{"abc123", "refresh-secret", "hunter2", "super-secret", "session-secret"} {
		if contains(got, secret) {
			t.Fatalf("sensitive value leaked: %q in %q", secret, got)
		}
	}
	if !contains(got, "[REDACTED]") {
		t.Fatal("expected redaction marker")
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

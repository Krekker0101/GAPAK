package auth

import (
	"testing"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

func TestTOTPManager_ValidateWithWindow_RejectsInvalidLength(t *testing.T) {
	m := NewTOTPManager("TestApp", 1)
	secret := "JBSWY3DPEHPK3PXP"

	// Generate a valid code for the current time
	validCode, err := totp.GenerateCodeCustom(secret, time.Now().UTC(), totp.ValidateOpts{
		Period:    30,
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	})
	if err != nil {
		t.Fatalf("Failed to generate valid TOTP code: %v", err)
	}

	tests := []struct {
		code  string
		valid bool
	}{
		{"", false},
		{"12345", false},
		{"1234567", false},
		{"12345678", false},
		{"abc123", false},
		{validCode, true},
	}

	for _, tc := range tests {
		got := m.ValidateWithWindow(tc.code, secret)
		if got != tc.valid {
			t.Errorf("ValidateWithWindow(%q) = %v, want %v", tc.code, got, tc.valid)
		}
	}
}

func TestRandomToken_LengthIsCorrect(t *testing.T) {
	sizes := []int{16, 24, 32, 48}
	for _, size := range sizes {
		token, err := RandomToken(size)
		if err != nil {
			t.Errorf("RandomToken(%d) returned error: %v", size, err)
			continue
		}
		if len(token) < size {
			t.Errorf("RandomToken(%d) returned token of length %d, want >= %d", size, len(token), size)
		}
	}
}

func TestRandomToken_DifferentEachCall(t *testing.T) {
	token1, err := RandomToken(32)
	if err != nil {
		t.Fatalf("RandomToken(32) error: %v", err)
	}
	token2, err := RandomToken(32)
	if err != nil {
		t.Fatalf("RandomToken(32) error: %v", err)
	}
	if token1 == token2 {
		t.Error("expected different tokens on consecutive calls")
	}
}

func TestTOTPManager_Generate(t *testing.T) {
	m := NewTOTPManager("TestApp", 1)
	key, err := m.Generate("test@example.com")
	if err != nil {
		t.Fatalf("Generate error: %v", err)
	}
	if key.Secret() == "" {
		t.Error("expected non-empty secret")
	}
	if key.URL() == "" {
		t.Error("expected non-empty otpauth url")
	}
}

func TestTOTPManager_ValidateWithWindow_RejectsExpiredCode(t *testing.T) {
	m := NewTOTPManager("TestApp", 1)
	key, err := m.Generate("test@example.com")
	if err != nil {
		t.Fatalf("Generate error: %v", err)
	}

	now := time.Now().UTC()
	oldCode, err := generateTOTPForTime(key.Secret(), now.Add(-90*time.Second))
	if err == nil {
		if m.ValidateWithWindow(oldCode, key.Secret()) {
			t.Error("should reject code from 90 seconds ago (beyond window)")
		}
	}
}

func generateTOTPForTime(secret string, t time.Time) (string, error) {
	code, err := totp.GenerateCodeCustom(secret, t, totp.ValidateOpts{
		Period:    30,
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	})
	return code, err
}

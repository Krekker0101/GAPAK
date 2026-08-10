package auth

import (
	"github.com/gapak/backend/internal/domain/model"
	"testing"
)

func TestEnsureOAuthLoginAllowedRejects2FAAccounts(t *testing.T) {
	err := ensureOAuthLoginAllowed(&model.User{TwoFactorEnabled: true})
	if err == nil || err.Error() != "Two-factor authentication is required; use password login" {
		t.Fatalf("expected OAuth login to require local 2FA, got %v", err)
	}
}

func TestEnsureOAuthLoginAllowedAllowsNon2FAAccounts(t *testing.T) {
	if err := ensureOAuthLoginAllowed(&model.User{TwoFactorEnabled: false}); err != nil {
		t.Fatalf("unexpected rejection: %v", err)
	}
}

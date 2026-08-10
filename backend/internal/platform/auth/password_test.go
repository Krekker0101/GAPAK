package auth

import "testing"

func TestNewPasswordManagerUsesExpectedArgon2Memory(t *testing.T) {
	manager := NewPasswordManager("test-pepper-which-is-long-enough")
	const wantKiB uint32 = 64 * 1024
	if manager.params.Memory != wantKiB {
		t.Fatalf("Argon2 memory = %d KiB, want %d KiB (64 MiB)", manager.params.Memory, wantKiB)
	}
}

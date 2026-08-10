package auth

import (
	"strings"
	"testing"
)

func TestExtractUsernameBaseIsDeterministicAndBounded(t *testing.T) {
	cases := []struct{ display, email string }{{"John Doe", "john@example.com"}, {"", "User+tag@example.com"}, {"***", ""}}
	for _, tc := range cases {
		a := extractUsernameBase(tc.display, tc.email)
		b := extractUsernameBase(tc.display, tc.email)
		if a != b {
			t.Fatalf("non-deterministic username base: %q != %q", a, b)
		}
		if len(a) == 0 || len(a) > 30 {
			t.Fatalf("unexpected username base length: %d (%q)", len(a), a)
		}
		if strings.ContainsAny(a, " @\t\n") {
			t.Fatalf("username base contains unsafe whitespace: %q", a)
		}
	}
}

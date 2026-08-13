package concurrency

import (
	"context"
	"strings"
	"testing"
)

func TestETagIsStableAndOpaque(t *testing.T) {
	a := ETag("user_profile", "abc", 7, "secret")
	b := ETag("user_profile", "abc", 7, "secret")
	if a != b {
		t.Fatalf("ETag not stable: %q != %q", a, b)
	}
	if strings.Contains(a, "secret") {
		t.Fatal("ETag contains secret")
	}
	if ETag("user_profile", "abc", 8, "secret") == a {
		t.Fatal("ETag did not change with revision")
	}
}

func TestParseIfMatch(t *testing.T) {
	rev, ok, err := ParseIfMatch(`"gapak:user_profile:42:abc:signature"`)
	if err != nil || !ok || rev != 42 {
		t.Fatalf("unexpected parse result: %d %v %v", rev, ok, err)
	}
	if _, _, err := ParseIfMatch(`"bad"`); err == nil {
		t.Fatal("invalid If-Match accepted")
	}
}

func TestExpectedRevisionContext(t *testing.T) {
	ctx := WithSecret(WithExpectedRevision(context.Background(), 19), "secret")
	if rev, ok := ExpectedRevision(ctx); !ok || rev != 19 {
		t.Fatalf("revision missing")
	}
}

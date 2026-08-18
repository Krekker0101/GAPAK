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
	header := ETag("user_profile", "abc", 42, "secret")
	rev, ok, err := ParseIfMatch(header)
	if err != nil || !ok || rev != 42 {
		t.Fatalf("unexpected parse result: %d %v %v", rev, ok, err)
	}
	if _, _, err := ParseIfMatch(`"bad"`); err == nil {
		t.Fatal("invalid If-Match accepted")
	}
	if _, _, err := ParseIfMatch(`W/"gapak:user_profile:42:abc:signature"`); err == nil {
		t.Fatal("weak If-Match accepted")
	}
	if _, _, err := ParseIfMatch(strings.Trim(header, `"`)); err == nil {
		t.Fatal("unquoted If-Match accepted")
	}
}

func TestIfMatchSignatureIsBoundToResource(t *testing.T) {
	header := ETag("user_profile", "abc", 42, "secret")
	condition, ok, err := parseIfMatchCondition(header)
	if err != nil || !ok {
		t.Fatalf("parse generated ETag: %v", err)
	}
	if !validIfMatchSignature(condition, "secret") {
		t.Fatal("generated ETag signature was rejected")
	}
	condition.ResourceID = "other"
	if validIfMatchSignature(condition, "secret") {
		t.Fatal("signature remained valid for another resource")
	}
}

func TestExpectedRevisionContext(t *testing.T) {
	ctx := WithSecret(WithExpectedRevision(context.Background(), 19), "secret")
	if rev, ok := ExpectedRevision(ctx); !ok || rev != 19 {
		t.Fatalf("revision missing")
	}
}

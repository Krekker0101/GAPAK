package chats

import (
	"reflect"
	"testing"

	"github.com/gapak/backend/internal/domain/model"
)

func TestMetadataRoundTripInvariant(t *testing.T) {
	in := map[string]interface{}{"replyTo": "m-1", "mentions": []interface{}{"u-1", "u-2"}, "silent": true}
	raw, err := metadataToBytes(in)
	if err != nil {
		t.Fatal(err)
	}
	got := bytesToMetadata(raw)
	if !reflect.DeepEqual(got, in) {
		t.Fatalf("metadata invariant violated: %#v != %#v", got, in)
	}
}

func TestValidateUpdateColumnsRejectsUnknownColumns(t *testing.T) {
	if _, err := validateUpdateColumns("messages", map[string]interface{}{"not_a_column": 1}); err == nil {
		t.Fatal("expected unknown column to be rejected")
	}
}

func TestMessagePageCursorUsesOldestRowForBeforePagination(t *testing.T) {
	messages := []*model.Message{{ID: "oldest"}, {ID: "middle"}, {ID: "newest"}}
	if got := messagePageCursor(messages, true); got == nil || got.ID != "oldest" {
		t.Fatalf("before cursor = %#v, want oldest", got)
	}
	if got := messagePageCursor(messages, false); got == nil || got.ID != "newest" {
		t.Fatalf("after cursor = %#v, want newest", got)
	}
	if got := messagePageCursor(nil, true); got != nil {
		t.Fatalf("empty cursor = %#v, want nil", got)
	}
}

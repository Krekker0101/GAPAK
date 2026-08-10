package chats

import (
	"reflect"
	"testing"
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

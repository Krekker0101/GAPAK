package pagination

import (
	"testing"
	"time"
)

func TestCursorRoundTrip(t *testing.T) {
	in := Cursor{Time: time.Date(2026, 8, 9, 12, 30, 0, 123000000, time.UTC), ID: "abc"}
	raw, err := Encode(in)
	if err != nil {
		t.Fatal(err)
	}
	got, err := Decode(raw)
	if err != nil {
		t.Fatal(err)
	}
	if !got.Time.Equal(in.Time) || got.ID != in.ID {
		t.Fatalf("round trip mismatch: %#v", got)
	}
}

func BenchmarkCursorEncodeDecode(b *testing.B) {
	c := Cursor{Time: time.Unix(1_700_000_000, 123_000_000).UTC(), ID: "550e8400-e29b-41d4-a716-446655440000"}
	for i := 0; i < b.N; i++ {
		raw, err := Encode(c)
		if err != nil {
			b.Fatal(err)
		}
		if _, err := Decode(raw); err != nil {
			b.Fatal(err)
		}
	}
}

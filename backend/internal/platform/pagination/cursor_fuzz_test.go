package pagination

import (
	"testing"
	"time"
)

func FuzzDecodeNeverPanics(f *testing.F) {
	seeds := []string{"", "e30", "eyJ0IjoiMjAyNi0wOC0wOVQxMjozMDowMFoiLCJpIjoiYWJjIn0", "!!!!", "AA"}
	for _, seed := range seeds {
		f.Add(seed)
	}
	f.Fuzz(func(t *testing.T, raw string) {
		_, _ = Decode(raw)
	})
}

func FuzzCursorRoundTripInvariant(f *testing.F) {
	f.Add(int64(1700000000), "id-1")
	f.Add(int64(0), "uuid")
	f.Fuzz(func(t *testing.T, unix int64, id string) {
		if id == "" || unix < 0 || unix > 4102444800 {
			return
		}
		in := Cursor{Time: time.Unix(unix, 0).UTC(), ID: id}
		raw, err := Encode(in)
		if err != nil {
			t.Fatalf("Encode: %v", err)
		}
		got, err := Decode(raw)
		if err != nil {
			t.Fatalf("Decode: %v", err)
		}
		if !got.Time.Equal(in.Time) || got.ID != in.ID {
			t.Fatalf("round-trip invariant violated: %#v != %#v", got, in)
		}
	})
}

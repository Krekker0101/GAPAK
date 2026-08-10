package posts

import (
	"testing"
	"time"

	"github.com/gapak/backend/internal/platform/pagination"
)

func BenchmarkFeedCursorCodec(b *testing.B) {
	c := pagination.Cursor{Time: time.Unix(1_700_000_000, 123_000_000).UTC(), ID: "550e8400-e29b-41d4-a716-446655440000"}
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		raw, err := pagination.Encode(c)
		if err != nil {
			b.Fatal(err)
		}
		if _, err := pagination.Decode(raw); err != nil {
			b.Fatal(err)
		}
	}
}

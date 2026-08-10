package auth

import "testing"

func BenchmarkParseAccessToken(b *testing.B) {
	m := NewJWTManager(JWTConfig{Issuer: "gapak.api", Audience: "gapak.clients", AccessSecret: "01234567890123456789012345678901", RefreshSecret: "abcdefghijklmnopqrstuvwxyz123456", AccessTTL: 900000000000, RefreshTTL: 86400000000000})
	pair, err := m.Issue("user-1", "session-1", "USER", nil)
	if err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := m.ParseAccessToken(pair.AccessToken); err != nil {
			b.Fatal(err)
		}
	}
}

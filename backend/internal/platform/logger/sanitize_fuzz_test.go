package logger

import "testing"

func FuzzSanitizeNeverPanics(f *testing.F) {
	f.Add("authorization: Bearer secret password=hunter2")
	f.Add("refresh_token=abc secret=xyz")
	f.Fuzz(func(t *testing.T, input string) {
		_ = Sanitize(input)
	})
}

package websocket

import "testing"

func FuzzParseSequenceNeverPanics(f *testing.F) {
	f.Add("1")
	f.Add("0")
	f.Add("-1")
	f.Add("not-a-number")
	f.Fuzz(func(t *testing.T, raw string) {
		_, _ = parseSequence(raw)
	})
}

package push

import (
	"testing"
)

func TestRegisterDeviceValidationRules(t *testing.T) {
	cases := []struct {
		name, provider, endpoint, token, publicKey, authKey string
		ok                                                  bool
	}{
		{"web complete", "webpush", "https://push.example/x", "", "p256", "auth", true},
		{"web missing auth", "webpush", "https://push.example/x", "", "p256", "", false},
		{"fcm complete", "fcm", "", "token", "", "", true},
		{"fcm missing token", "fcm", "", "", "", "", false},
		{"apns complete", "apns", "", "token", "", "", true},
		{"apns missing token", "apns", "", "", "", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			valid := true
			if tc.provider == "webpush" && (tc.endpoint == "" || tc.publicKey == "" || tc.authKey == "") {
				valid = false
			}
			if (tc.provider == "fcm" || tc.provider == "apns") && tc.token == "" {
				valid = false
			}
			if valid != tc.ok {
				t.Fatalf("valid=%v want=%v", valid, tc.ok)
			}
		})
	}
}

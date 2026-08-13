package push

import (
	"testing"
)

func TestProviderNamesStable(t *testing.T) {
	if ProviderWebPush != "webpush" || ProviderFCM != "fcm" || ProviderAPNs != "apns" {
		t.Fatal("provider names changed")
	}
}

func TestProviderClassification(t *testing.T) {
	cases := []struct {
		name string
		got  DeliveryErrorKind
		want DeliveryErrorKind
	}{
		{"fcm invalid", fcmClassify(400), ErrKindInvalid},
		{"fcm not found", fcmClassify(404), ErrKindInvalid},
		{"fcm retry", fcmClassify(503), ErrKindRetryable},
		{"apns bad", apnsClassify(400, "{}"), ErrKindInvalid},
		{"apns retry", apnsClassify(503, "{}"), ErrKindRetryable},
		{"webpush invalid", webpushClassify(410), ErrKindInvalid},
		{"webpush retry", webpushClassify(429), ErrKindRetryable},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.got != tc.want {
				t.Fatalf("got %s want %s", tc.got, tc.want)
			}
		})
	}
}

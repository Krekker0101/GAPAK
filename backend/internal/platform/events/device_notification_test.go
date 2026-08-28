package events

import "testing"

func TestTrustedDeviceEventsDoNotNotifyTheActingUser(t *testing.T) {
	for _, eventType := range []EventType{TrustedDeviceAdded, TrustedDeviceRevoked} {
		if !suppressSelfNotification(eventType) {
			t.Fatalf("%s must not create a notification for the same user inside device registration", eventType)
		}
	}
}

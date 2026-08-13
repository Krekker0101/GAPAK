package subscriptions

import (
	"encoding/json"
	"testing"

	"github.com/gapak/backend/internal/platform/httpx"
)

func TestFollowingResponseIsArrayInsideSuccessEnvelope(t *testing.T) {
	payload := httpx.OK([]CreatorsListResponse{{
		ID:               "11111111-1111-4111-8111-111111111111",
		Username:         "creator",
		DisplayName:      "Creator",
		SubscriptionType: "VISIBLE",
	}}, "req-1", nil)
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded["success"] != true {
		t.Fatalf("success=%v", decoded["success"])
	}
	if _, ok := decoded["data"].([]any); !ok {
		t.Fatalf("data is %T, want array", decoded["data"])
	}
}

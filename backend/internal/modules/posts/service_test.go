package posts

import (
	"testing"
	"time"
)

func TestValidatePostRequestRequiresAudienceForPrivatePost(t *testing.T) {
	_, err := validatePostRequest(CreatePostRequest{
		Body:    "secret",
		Privacy: "PRIVATE",
	})
	if err == nil {
		t.Fatal("expected private post without audience to fail validation")
	}
}

func TestValidatePostRequestDefaultsOneTimeLimit(t *testing.T) {
	req, err := validatePostRequest(CreatePostRequest{
		Body:            "single",
		Privacy:         "ONE_TIME",
		AudienceUserIDs: []string{"11111111-1111-1111-1111-111111111111"},
	})
	if err != nil {
		t.Fatalf("expected valid one-time request: %v", err)
	}
	if req.OneTimeViewLimit == nil || *req.OneTimeViewLimit != 1 {
		t.Fatal("expected one-time view limit to default to 1")
	}
}

func TestValidatePostBusinessRulesRequiresFutureExpiryForTimedPost(t *testing.T) {
	past := time.Now().Add(-time.Minute)
	err := validatePostBusinessRules("TIMED", &past, nil, []string{"11111111-1111-1111-1111-111111111111"})
	if err == nil {
		t.Fatal("expected timed post with past expiry to fail validation")
	}
}

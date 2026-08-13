package push

import (
	"encoding/json"
	"fmt"
)

func buildPayload(n Notification) ([]byte, error) {
	payload := map[string]any{
		"notification": map[string]any{
			"id":    n.ID,
			"type":  n.Type,
			"title": n.TitleKey,
			"body":  n.BodyKey,
		},
		"data": n.Data,
	}
	return json.Marshal(payload)
}

func requireNotificationPayload(n Notification) ([]byte, error) {
	payload, err := buildPayload(n)
	if err != nil {
		return nil, fmt.Errorf("marshal push payload: %w", err)
	}
	if len(payload) > 3800 {
		return nil, fmt.Errorf("push payload exceeds provider-safe size")
	}
	return payload, nil
}

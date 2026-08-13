package push

import (
	"context"
	"time"
)

// ProviderName is the stable provider identifier stored in subscriptions.
type ProviderName string

const (
	ProviderWebPush ProviderName = "webpush"
	ProviderFCM     ProviderName = "fcm"
	ProviderAPNs    ProviderName = "apns"
)

type Device struct {
	ID           string
	UserID       string
	DeviceID     string
	Platform     string
	Provider     ProviderName
	Endpoint     string
	Token        string
	PublicKey    string
	AuthKey      string
	ExpirationAt *time.Time
}

type Notification struct {
	ID        string
	Type      string
	TitleKey  string
	BodyKey   string
	Data      map[string]any
	CreatedAt time.Time
}

type DeliveryResult struct {
	ProviderMessageID string
	StatusCode        int
}

type DeliveryErrorKind string

const (
	ErrKindRetryable DeliveryErrorKind = "retryable"
	ErrKindPermanent DeliveryErrorKind = "permanent"
	ErrKindInvalid   DeliveryErrorKind = "invalid"
	ErrKindDisabled  DeliveryErrorKind = "disabled"
)

type DeliveryError struct {
	Kind       DeliveryErrorKind
	StatusCode int
	Err        error
}

func (e *DeliveryError) Error() string { return e.Err.Error() }
func (e *DeliveryError) Unwrap() error { return e.Err }

// PushProvider delivers a notification to exactly one subscription.
// Providers are intentionally independent from domain events and services.
type PushProvider interface {
	Name() ProviderName
	Send(context.Context, Device, Notification) (DeliveryResult, error)
}

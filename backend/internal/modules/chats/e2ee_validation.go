package chats

import (
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

const gapakE2EEEncryptionAlgorithm = "GAPAK-E2EE-V1:AES-256-GCM+ECDH-P256+HKDF-SHA256+ECDSA-P256"
const gapakE2EEProtocolVersion = "gapak-e2ee-v1"

func validateE2EEPublicJWK(raw, field string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return apperrors.New(400, "chats.e2ee.invalid_key_material", fmt.Sprintf("%s is required", field))
	}

	var jwk map[string]any
	if err := json.Unmarshal([]byte(raw), &jwk); err != nil {
		return apperrors.New(400, "chats.e2ee.invalid_key_material", fmt.Sprintf("%s must be a valid public JWK", field))
	}
	if _, ok := jwk["d"]; ok {
		return apperrors.New(400, "chats.e2ee.private_key_rejected", fmt.Sprintf("%s must not contain private key material", field))
	}
	if jwk["kty"] != "EC" || jwk["crv"] != "P-256" {
		return apperrors.New(400, "chats.e2ee.unsupported_key", fmt.Sprintf("%s must be an EC P-256 public JWK", field))
	}

	x, ok := jwk["x"].(string)
	if !ok || !validBase64URL32(x) {
		return apperrors.New(400, "chats.e2ee.invalid_key_material", fmt.Sprintf("%s.x is invalid", field))
	}
	y, ok := jwk["y"].(string)
	if !ok || !validBase64URL32(y) {
		return apperrors.New(400, "chats.e2ee.invalid_key_material", fmt.Sprintf("%s.y is invalid", field))
	}
	return nil
}

func validBase64URL32(value string) bool {
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	return err == nil && len(decoded) == 32
}

func validateHex(value, field string, minBytes, maxBytes int) error {
	value = strings.TrimSpace(value)
	if value == "" || len(value)%2 != 0 {
		return apperrors.New(400, "chats.e2ee.invalid_encoding", fmt.Sprintf("%s must be non-empty even-length hex", field))
	}
	if len(value)/2 < minBytes || len(value)/2 > maxBytes {
		return apperrors.New(400, "chats.e2ee.invalid_length", fmt.Sprintf("%s has an invalid length", field))
	}
	if _, err := hex.DecodeString(value); err != nil {
		return apperrors.New(400, "chats.e2ee.invalid_encoding", fmt.Sprintf("%s must be hexadecimal", field))
	}
	return nil
}

func validateE2EECiphertext(req SendMessageRequest) error {
	if err := validateHex(req.Ciphertext, "ciphertext", 16, 25000); err != nil {
		return err
	}
	if err := validateHex(req.Nonce, "nonce", 12, 12); err != nil {
		return err
	}
	if err := validateHex(req.AuthenticationTag, "authenticationTag", 64, 64); err != nil {
		return err
	}
	if req.EncryptionAlgorithm != gapakE2EEEncryptionAlgorithm {
		return apperrors.New(400, "chats.e2ee.unsupported_algorithm", "Unsupported GAPAK E2EE encryption algorithm")
	}
	if !strings.HasPrefix(req.SenderKeyID, strings.TrimSpace(req.SenderDeviceID)+":identity:v1") {
		return apperrors.New(400, "chats.e2ee.invalid_sender_key_id", "senderKeyId does not match senderDeviceId")
	}
	return nil
}

func validateMessageEnvelopeJSON(raw string, recipientUserID, recipientDeviceID string, keyVersion int) error {
	var payload struct {
		ProtocolVersion    string          `json:"protocolVersion"`
		RecipientDeviceID  string          `json:"recipientDeviceId"`
		RecipientUserID    string          `json:"recipientUserId"`
		IdentityKeyID      string          `json:"identityKeyId"`
		EphemeralPublicKey json.RawMessage `json:"ephemeralPublicKey"`
		Salt               string          `json:"salt"`
		WrappedKey         string          `json:"wrappedKey"`
		KeyVersion         int             `json:"keyVersion"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return apperrors.New(400, "chats.e2ee.invalid_key_envelope", "encryptedKey must be a valid GAPAK E2EE envelope")
	}
	if payload.ProtocolVersion != gapakE2EEProtocolVersion {
		return apperrors.New(400, "chats.e2ee.unsupported_protocol", "Unsupported GAPAK E2EE protocol version")
	}
	if payload.RecipientDeviceID != recipientDeviceID || payload.RecipientUserID != recipientUserID {
		return apperrors.New(400, "chats.e2ee.recipient_mismatch", "Encrypted key envelope recipient does not match its routing fields")
	}
	expectedKeyID := recipientDeviceID + ":identity:v1"
	if payload.IdentityKeyID != expectedKeyID {
		return apperrors.New(400, "chats.e2ee.invalid_key_id", "Encrypted key envelope identity key ID is invalid")
	}
	if payload.KeyVersion != keyVersion || keyVersion != 1 {
		return apperrors.New(400, "chats.e2ee.invalid_key_version", "Unsupported GAPAK E2EE key version")
	}
	if len(payload.EphemeralPublicKey) == 0 {
		return apperrors.New(400, "chats.e2ee.invalid_key_material", "Encrypted key envelope is missing ephemeral public key")
	}
	if err := validateE2EEPublicJWK(string(payload.EphemeralPublicKey), "ephemeralPublicKey"); err != nil {
		return err
	}
	if err := validateHex(payload.Salt, "salt", 32, 32); err != nil {
		return err
	}
	if err := validateHex(payload.WrappedKey, "wrappedKey", 16, 4096); err != nil {
		return err
	}
	return nil
}

func validateGapakE2EEKeyEnvelope(req MessageKeyEnvelopeRequest) error {
	if req.RecipientUserID == "" || req.RecipientDeviceID == "" || req.KeyID == "" || req.Algorithm == "" || req.EncryptedKey == "" {
		return apperrors.New(400, "chats.key_envelope_invalid", "Key envelope fields are required")
	}
	if req.KeyVersion != 1 {
		return apperrors.New(400, "chats.e2ee.invalid_key_version", "Only GAPAK E2EE key version 1 is supported")
	}
	if req.KeyID != req.RecipientDeviceID+":identity:v1" {
		return apperrors.New(400, "chats.e2ee.invalid_key_id", "Key envelope keyId must identify the recipient identity key")
	}
	if req.Algorithm != gapakE2EEEncryptionAlgorithm {
		return apperrors.New(400, "chats.e2ee.unsupported_algorithm", "Unsupported GAPAK E2EE key envelope algorithm")
	}
	if err := validateMessageEnvelopeJSON(req.EncryptedKey, req.RecipientUserID, req.RecipientDeviceID, req.KeyVersion); err != nil {
		return err
	}
	if req.Nonce != "" {
		if err := validateHex(req.Nonce, "keyEnvelope.nonce", 12, 12); err != nil {
			return err
		}
	}
	return nil
}

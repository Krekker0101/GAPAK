package chats

import "testing"

const validPublicJWK = `{"kty":"EC","crv":"P-256","x":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8","y":"ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8"}`

func TestValidateE2EEPublicJWKRejectsPrivateMaterial(t *testing.T) {
	private := `{"kty":"EC","crv":"P-256","x":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8","y":"ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8","d":"secret"}`
	if err := validateE2EEPublicJWK(private, "identityKeyPublic"); err == nil {
		t.Fatal("expected private key material to be rejected")
	}
}

func TestValidateHexRejectsOddOrInvalidHex(t *testing.T) {
	if err := validateHex("abc", "nonce", 1, 10); err == nil {
		t.Fatal("expected odd-length hex to be rejected")
	}
	if err := validateHex("zz", "nonce", 1, 10); err == nil {
		t.Fatal("expected invalid hex to be rejected")
	}
}

func TestValidateE2EECiphertextRejectsWrongNonceLength(t *testing.T) {
	req := SendMessageRequest{
		Ciphertext:          "00112233445566778899aabbccddeeff",
		Nonce:               "0011",
		SenderKeyID:         "device:identity:v1",
		SenderDeviceID:      "device",
		EncryptionAlgorithm: gapakE2EEEncryptionAlgorithm,
		AuthenticationTag:   "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
	}
	if err := validateE2EECiphertext(req); err == nil {
		t.Fatal("expected invalid nonce length to be rejected")
	}
}

func TestValidateMessageEnvelopeRejectsRecipientMismatch(t *testing.T) {
	raw := `{"protocolVersion":"gapak-e2ee-v1","recipientDeviceId":"device-b","recipientUserId":"user-b","identityKeyId":"device-b:identity:v1","ephemeralPublicKey":` + validPublicJWK + `,"salt":"0000000000000000000000000000000000000000000000000000000000000000","wrappedKey":"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000","keyVersion":1}`
	if err := validateMessageEnvelopeJSON(raw, "user-a", "device-b", 1); err == nil {
		t.Fatal("expected recipient mismatch to be rejected")
	}
}

func TestValidateGapakE2EEKeyEnvelopeRejectsWrongAlgorithm(t *testing.T) {
	req := MessageKeyEnvelopeRequest{
		RecipientUserID:   "11111111-1111-4111-8111-111111111111",
		RecipientDeviceID: "22222222-2222-4222-8222-222222222222",
		KeyID:             "22222222-2222-4222-8222-222222222222:identity:v1",
		Algorithm:         "UNSUPPORTED",
		EncryptedKey:      "{}",
		KeyVersion:        1,
	}
	if err := validateGapakE2EEKeyEnvelope(req); err == nil {
		t.Fatal("expected unsupported algorithm to be rejected")
	}
}

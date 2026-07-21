package auth

import (
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

type TOTPManager struct {
	issuer string
	window int
}

func NewTOTPManager(issuer string, window int) *TOTPManager {
	return &TOTPManager{issuer: issuer, window: window}
}

// generateTOTPAlgorithms lists algorithms to try during validation.
// SHA-256 is preferred for new setups; SHA-1 is kept for backwards compatibility.
var generateTOTPAlgorithm = otp.AlgorithmSHA256

var validateTOTPAlgorithms = []otp.Algorithm{
	otp.AlgorithmSHA256,
	otp.AlgorithmSHA1,
}

func (m *TOTPManager) Generate(accountName string) (*otp.Key, error) {
	return totp.Generate(totp.GenerateOpts{
		Issuer:      m.issuer,
		AccountName: accountName,
		Period:      30,
		Digits:      otp.DigitsSix,
		SecretSize:  32,
		Algorithm:   generateTOTPAlgorithm,
	})
}

func (m *TOTPManager) ValidateWithWindow(code, secret string) bool {
	if len(code) != 6 {
		return false
	}
	if !isNumeric(code) {
		return false
	}
	now := time.Now().UTC()
	for _, alg := range validateTOTPAlgorithms {
		valid, err := totp.ValidateCustom(code, secret, now, totp.ValidateOpts{
			Period:    30,
			Skew:      uint(m.window),
			Digits:    otp.DigitsSix,
			Algorithm: alg,
		})
		if err == nil && valid {
			return true
		}
	}
	return false
}

func isNumeric(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

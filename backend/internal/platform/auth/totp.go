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

func (m *TOTPManager) Generate(accountName string) (*otp.Key, error) {
	return totp.Generate(totp.GenerateOpts{
		Issuer:      m.issuer,
		AccountName: accountName,
		Period:      30,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
}

func (m *TOTPManager) ValidateWithWindow(code, secret string) bool {
	if len(code) != 6 {
		return false
	}
	if !isNumeric(code) {
		return false
	}
	valid, err := totp.ValidateCustom(code, secret, time.Now().UTC(), totp.ValidateOpts{
		Period:    30,
		Skew:      uint(m.window),
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	})
	return err == nil && valid
}

func isNumeric(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

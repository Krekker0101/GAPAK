package privacy

import apperrors "github.com/gapak/backend/internal/platform/errors"

var (
	ErrAnonymousSignupDisabled  = apperrors.New(403, "privacy.anonymous_signup_disabled", "Anonymous sign-up is disabled")
	ErrEmailSignupDisabled      = apperrors.New(403, "privacy.email_signup_disabled", "Email sign-up is disabled in anonymity-first mode")
	ErrPasswordRecoveryDisabled = apperrors.New(403, "privacy.password_recovery_disabled", "Password recovery is disabled in anonymity-first mode")
)

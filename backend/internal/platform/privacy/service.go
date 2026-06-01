package privacy

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/config"
	"github.com/gapak/backend/internal/domain/common"
	"github.com/gapak/backend/internal/domain/enums"
	"github.com/gapak/backend/internal/domain/model"
)

type Service struct {
	cfg config.AnonymityConfig
}

type PrivacyDefaults struct {
	ProfileVisibility    enums.ProfileVisibility
	LastSeenVisibility   enums.LastSeenVisibility
	AllowFriendRequests  bool
	AllowTrustedInvites  bool
	SearchableByEmail    bool
	SearchableByUsername bool
	PostDefaultPrivacy   enums.PostPrivacy
	ShowOnlineStatus     bool
}

func NewService(cfg config.AnonymityConfig) *Service {
	return &Service{cfg: cfg}
}

func (s *Service) RequestMeta(c *fiber.Ctx, deviceName, deviceFingerprint string) common.RequestMeta {
	meta := common.RequestMeta{
		DeviceName: strings.TrimSpace(deviceName),
	}
	if s.cfg.StoreIP {
		meta.IP = strings.TrimSpace(s.ClientIP(c))
	}
	if s.cfg.StoreUserAgent {
		meta.UserAgent = strings.TrimSpace(c.Get(fiber.HeaderUserAgent))
	}
	if s.cfg.StoreDeviceFingerprint {
		meta.DeviceFingerprint = s.HashToken(strings.TrimSpace(deviceFingerprint))
	}
	return meta
}

func (s *Service) RateLimitKey(c *fiber.Ctx) string {
	return s.HashToken(strings.Join([]string{
		strings.TrimSpace(s.ClientIP(c)),
		strings.TrimSpace(c.Get(fiber.HeaderUserAgent)),
		strings.TrimSpace(c.Get(fiber.HeaderAcceptLanguage)),
	}, "|"))
}

func (s *Service) ClientIP(c *fiber.Ctx) string {
	if s.cfg.TrustProxyHeaders {
		for _, header := range s.cfg.ProxyHeaders {
			raw := strings.TrimSpace(c.Get(header))
			if raw == "" {
				continue
			}
			if strings.EqualFold(header, "X-Forwarded-For") {
				raw = strings.TrimSpace(strings.Split(raw, ",")[0])
			}
			if raw != "" {
				return raw
			}
		}
	}
	return strings.TrimSpace(c.IP())
}

func (s *Service) LogClientHint(c *fiber.Ctx) string {
	if !s.cfg.LogNetworkMetadata {
		return ""
	}
	return "anon:" + s.HashToken(strings.TrimSpace(s.ClientIP(c)))[:16]
}

func (s *Service) NormalizeRegistrationEmail(rawEmail string) (*string, bool, error) {
	email := strings.ToLower(strings.TrimSpace(rawEmail))
	if s.cfg.RequirePseudonymousSignup || email == "" {
		if !s.cfg.AllowAnonymousSignup {
			return nil, false, ErrAnonymousSignupDisabled
		}
		return nil, true, nil
	}
	if !s.cfg.AllowEmailSignup {
		return nil, false, ErrEmailSignupDisabled
	}
	return &email, false, nil
}

func (s *Service) CanUsePasswordRecovery() bool {
	return s.cfg.AllowPasswordRecovery && s.cfg.AllowEmailSignup
}

func (s *Service) TOTPLabel(user *model.User) string {
	if user.Email != nil && strings.TrimSpace(*user.Email) != "" {
		return *user.Email
	}
	return user.Username
}

func (s *Service) PublicEmail(user *model.User) *string {
	if user == nil || user.IsAnonymous || !s.cfg.ExposeEmailInResponses {
		return nil
	}
	if user.Email == nil {
		return nil
	}
	value := strings.TrimSpace(*user.Email)
	if value == "" {
		return nil
	}
	return &value
}

func (s *Service) SessionIPAddress(session *model.DeviceSession) string {
	if session == nil || !s.cfg.StoreIP || session.IPAddress == nil {
		return ""
	}
	return strings.TrimSpace(*session.IPAddress)
}

func (s *Service) SessionCountryCode(session *model.DeviceSession) string {
	if session == nil || !s.cfg.StoreIP || session.CountryCode == nil {
		return ""
	}
	return strings.TrimSpace(*session.CountryCode)
}

func (s *Service) SessionCity(session *model.DeviceSession) string {
	if session == nil || !s.cfg.StoreIP || session.City == nil {
		return ""
	}
	return strings.TrimSpace(*session.City)
}

func (s *Service) SessionUserAgent(session *model.DeviceSession) string {
	if session == nil || !s.cfg.StoreUserAgent || session.UserAgent == nil {
		return ""
	}
	return strings.TrimSpace(*session.UserAgent)
}

func (s *Service) SessionDeviceName(session *model.DeviceSession) string {
	if session == nil || session.DeviceName == nil {
		return ""
	}
	return strings.TrimSpace(*session.DeviceName)
}

func (s *Service) SanitizeAuditMetadata(metadata map[string]any) map[string]any {
	if metadata == nil {
		return map[string]any{}
	}
	if !s.cfg.Enabled {
		return metadata
	}
	sanitized := map[string]any{}
	for key, value := range metadata {
		switch strings.ToLower(key) {
		case "ip", "useragent", "user_agent", "fingerprint", "devicefingerprint", "email":
			continue
		default:
			sanitized[key] = value
		}
	}
	return sanitized
}

func (s *Service) DefaultsForUser(isAnonymous bool) PrivacyDefaults {
	if isAnonymous {
		return PrivacyDefaults{
			ProfileVisibility:    enums.ProfileVisibilityPrivate,
			LastSeenVisibility:   enums.LastSeenNobody,
			AllowFriendRequests:  false,
			AllowTrustedInvites:  true,
			SearchableByEmail:    false,
			SearchableByUsername: false,
			PostDefaultPrivacy:   enums.PostPrivacyPrivate,
			ShowOnlineStatus:     false,
		}
	}
	return PrivacyDefaults{
		ProfileVisibility:    enums.ProfileVisibilityConnections,
		LastSeenVisibility:   enums.LastSeenConnections,
		AllowFriendRequests:  true,
		AllowTrustedInvites:  true,
		SearchableByEmail:    false,
		SearchableByUsername: true,
		PostDefaultPrivacy:   enums.PostPrivacyFriends,
		ShowOnlineStatus:     true,
	}
}

func (s *Service) HashToken(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "anonymous"
	}
	mac := hmac.New(sha256.New, []byte(s.cfg.HashSecret))
	mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

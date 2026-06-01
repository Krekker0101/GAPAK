package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"github.com/google/uuid"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

const (
	defaultUserLimit = 25
	maxUserLimit     = 100
	maxBlocksPerPage = 80
)

var slugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,118}[a-z0-9]$|^[a-z0-9]$`)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Overview(ctx context.Context) (OverviewResponse, error) {
	return s.repo.Overview(ctx)
}

func (s *Service) ListUsers(ctx context.Context, params ListUsersParams) (ListUsersResponse, error) {
	params.Search = strings.TrimSpace(params.Search)
	params.Role = strings.TrimSpace(params.Role)
	params.Status = strings.TrimSpace(params.Status)
	if params.Limit <= 0 {
		params.Limit = defaultUserLimit
	}
	if params.Limit > maxUserLimit {
		params.Limit = maxUserLimit
	}
	if params.Offset < 0 {
		params.Offset = 0
	}
	return s.repo.ListUsers(ctx, params)
}

func (s *Service) UpdateUser(ctx context.Context, actorUserID, targetUserID string, req UpdateUserRequest) (AdminUserResponse, error) {
	current, err := s.repo.FindUser(ctx, targetUserID)
	if err != nil {
		return AdminUserResponse{}, err
	}

	if actorUserID == targetUserID {
		if req.Role != nil && strings.TrimSpace(*req.Role) != current.Role {
			return AdminUserResponse{}, apperrors.New(http.StatusForbidden, "admin.self_role_change_forbidden", "Administrators cannot change their own role")
		}
		if req.AccountStatus != nil && strings.TrimSpace(*req.AccountStatus) != "ACTIVE" {
			return AdminUserResponse{}, apperrors.New(http.StatusForbidden, "admin.self_status_change_forbidden", "Administrators cannot suspend or delete their own account")
		}
	}

	nextRole := current.Role
	if req.Role != nil {
		nextRole = strings.TrimSpace(*req.Role)
	}
	nextStatus := current.AccountStatus
	if req.AccountStatus != nil {
		nextStatus = strings.TrimSpace(*req.AccountStatus)
	}
	if current.Role == "ADMIN" && (nextRole != "ADMIN" || nextStatus != "ACTIVE") {
		admins, err := s.repo.CountAdmins(ctx)
		if err != nil {
			return AdminUserResponse{}, err
		}
		if admins <= 1 {
			return AdminUserResponse{}, apperrors.New(http.StatusConflict, "admin.last_admin_protected", "At least one active administrator must remain")
		}
	}

	return s.repo.UpdateUser(ctx, targetUserID, req)
}

func (s *Service) ListPages(ctx context.Context, locale string) ([]PageSummaryResponse, error) {
	return s.repo.ListPages(ctx, strings.TrimSpace(locale))
}

func (s *Service) GetPage(ctx context.Context, slug, locale, actorUserID string) (PageResponse, error) {
	slug, locale, err := normalizePageIdentity(slug, locale)
	if err != nil {
		return PageResponse{}, err
	}
	return s.repo.EnsurePage(ctx, slug, locale, actorUserID)
}

func (s *Service) UpdatePage(ctx context.Context, slug, actorUserID string, req UpdatePageRequest) (PageResponse, error) {
	slug, locale, err := normalizePageIdentity(slug, req.Locale)
	if err != nil {
		return PageResponse{}, err
	}

	content, err := validateContent(req.Content)
	if err != nil {
		return PageResponse{}, err
	}

	if _, err := s.repo.EnsurePage(ctx, slug, locale, actorUserID); err != nil {
		return PageResponse{}, err
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Status = strings.TrimSpace(req.Status)
	return s.repo.UpdatePage(ctx, slug, locale, actorUserID, req, content)
}

func normalizePageIdentity(slug, locale string) (string, string, error) {
	slug = strings.ToLower(strings.TrimSpace(slug))
	locale = strings.ToLower(strings.TrimSpace(locale))
	if locale == "" {
		locale = "en"
	}
	if locale != "en" && locale != "ru" && locale != "tj" {
		return "", "", apperrors.New(http.StatusBadRequest, "admin.locale_invalid", "Unsupported page locale")
	}
	if !slugPattern.MatchString(slug) {
		return "", "", apperrors.New(http.StatusBadRequest, "admin.slug_invalid", "Page slug is invalid")
	}
	return slug, locale, nil
}

func validateContent(raw json.RawMessage) (PageContent, error) {
	var content PageContent
	if len(raw) == 0 {
		return PageContent{}, apperrors.New(http.StatusBadRequest, "admin.content_required", "Page content is required")
	}
	if err := json.Unmarshal(raw, &content); err != nil {
		return PageContent{}, apperrors.New(http.StatusBadRequest, "admin.content_invalid", "Page content JSON is invalid")
	}
	if content.Blocks == nil {
		content.Blocks = []ContentBlock{}
	}
	if len(content.Blocks) > maxBlocksPerPage {
		return PageContent{}, apperrors.New(http.StatusBadRequest, "admin.content_too_large", "Page contains too many blocks")
	}
	for index := range content.Blocks {
		block := &content.Blocks[index]
		block.ID = strings.TrimSpace(block.ID)
		if block.ID == "" {
			block.ID = uuid.NewString()
		}
		block.Type = strings.TrimSpace(block.Type)
		if !allowedBlockType(block.Type) {
			return PageContent{}, apperrors.New(http.StatusBadRequest, "admin.block_type_invalid", "Page contains an unsupported block type")
		}
		if block.Props == nil {
			block.Props = map[string]any{}
		}
		trimBlockProps(block.Props)
	}
	return content, nil
}

func allowedBlockType(blockType string) bool {
	switch blockType {
	case "hero", "feature", "stats", "cta":
		return true
	default:
		return false
	}
}

func trimBlockProps(props map[string]any) {
	for key, value := range props {
		switch typed := value.(type) {
		case string:
			trimmed := strings.TrimSpace(typed)
			if len(trimmed) > 4000 {
				trimmed = trimmed[:4000]
			}
			props[key] = trimmed
		case []any:
			for index, item := range typed {
				if text, ok := item.(string); ok {
					typed[index] = strings.TrimSpace(text)
				}
			}
			props[key] = typed
		}
	}
}

func defaultPageTitle(slug string) string {
	if slug == "home" {
		return "Home"
	}
	words := strings.Fields(strings.ReplaceAll(slug, "-", " "))
	for index, word := range words {
		if word == "" {
			continue
		}
		words[index] = strings.ToUpper(word[:1]) + word[1:]
	}
	return strings.Join(words, " ")
}

func defaultBlocks(slug, locale string) []ContentBlock {
	headline := map[string]string{
		"en": "Build private trust spaces with Gapak",
		"ru": "Создавайте приватные пространства доверия с Gapak",
		"tj": "Бо Gapak фазоҳои хусусии эътимод созед",
	}[locale]
	body := map[string]string{
		"en": "A secure social layer for rooms, posts, chats, and identity control.",
		"ru": "Защищенный социальный слой для комнат, постов, чатов и контроля идентичности.",
		"tj": "Қабати иҷтимоии бехатар барои утоқҳо, постҳо, чатҳо ва назорати шахсият.",
	}[locale]

	return []ContentBlock{
		{
			ID:   uuid.NewString(),
			Type: "hero",
			Props: map[string]any{
				"eyebrow":     "Gapak",
				"headline":    headline,
				"body":        body,
				"buttonLabel": "Start",
				"buttonHref":  "/register",
				"imageUrl":    "",
				"accent":      "cyan",
			},
		},
		{
			ID:   uuid.NewString(),
			Type: "feature",
			Props: map[string]any{
				"eyebrow":  "Trust",
				"headline": "Privacy, rooms, and secure sessions",
				"body":     "Use the builder to tune this page without touching code.",
				"accent":   "amber",
			},
		},
	}
}

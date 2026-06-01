package media

import (
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"github.com/gapak/backend/internal/platform/httpx"
	"github.com/gapak/backend/internal/platform/middleware"
)

type Controller struct {
	service  *Service
	validate *validator.Validate
}

func NewController(service *Service, validate *validator.Validate) *Controller {
	return &Controller{service: service, validate: validate}
}

func (ctl *Controller) RegisterRoutes(router fiber.Router, requireAuth fiber.Handler) {
	gateway := router.Group("/media")
	gateway.Put("/gateway/multipart/upload", ctl.gatewayUpload)
	gateway.Get("/protected/object", ctl.playbackObject)

	group := router.Group("/media", requireAuth)
	group.Post("/upload-sessions", ctl.createUploadSession)
	group.Get("/upload-sessions/:sessionId", ctl.getUploadSession)
	group.Post("/upload-sessions/:sessionId/parts", ctl.requestUploadPart)
	group.Post("/upload-sessions/:sessionId/complete", ctl.completeUploadSession)
	group.Post("/upload-sessions/:sessionId/abort", ctl.abortUploadSession)
	group.Get("/assets/:mediaId", ctl.getAsset)
	group.Post("/assets/:mediaId/playback-grants", ctl.createPlaybackGrant)

	legacy := router.Group("/media", requireAuth)
	legacy.Post("/upload-intents", ctl.createLegacyIntent)
	legacy.Post("/:sessionId/finalize", ctl.finalizeLegacy)
	legacy.Get("/:mediaId/access", ctl.accessLegacy)
}

func (ctl *Controller) createUploadSession(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[CreateUploadSessionRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.CreateUploadSession(c.UserContext(), claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) getUploadSession(c *fiber.Ctx) error {
	sessionID, err := httpx.UUIDParam(c, "sessionId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.GetUploadSession(c.UserContext(), claims.UserID, sessionID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) requestUploadPart(c *fiber.Ctx) error {
	sessionID, err := httpx.UUIDParam(c, "sessionId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[RequestUploadPartRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.RequestUploadPart(c.UserContext(), claims.UserID, sessionID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) completeUploadSession(c *fiber.Ctx) error {
	sessionID, err := httpx.UUIDParam(c, "sessionId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[CompleteUploadSessionRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.CompleteUploadSession(c.UserContext(), claims.UserID, sessionID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) abortUploadSession(c *fiber.Ctx) error {
	sessionID, err := httpx.UUIDParam(c, "sessionId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.AbortUploadSession(c.UserContext(), claims.UserID, sessionID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) getAsset(c *fiber.Ctx) error {
	mediaID, err := httpx.UUIDParam(c, "mediaId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.GetAsset(c.UserContext(), claims.UserID, mediaID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) createPlaybackGrant(c *fiber.Ctx) error {
	mediaID, err := httpx.UUIDParam(c, "mediaId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[CreatePlaybackGrantRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.CreatePlaybackGrant(c.UserContext(), claims.UserID, mediaID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) createLegacyIntent(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[CreateUploadIntentRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.CreateIntent(c.UserContext(), claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) finalizeLegacy(c *fiber.Ctx) error {
	sessionID, err := httpx.UUIDParam(c, "sessionId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[FinalizeUploadRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Finalize(c.UserContext(), claims.UserID, sessionID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) accessLegacy(c *fiber.Ctx) error {
	mediaID, err := httpx.UUIDParam(c, "mediaId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Access(c.UserContext(), claims.UserID, mediaID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) gatewayUpload(c *fiber.Ctx) error {
	query, err := httpx.BindQuery[SignedUploadQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	etag, err := ctl.service.UploadPart(c.UserContext(), query, c.Body(), c.Get(fiber.HeaderContentType))
	if err != nil {
		return err
	}
	c.Set("ETag", etag)
	return c.SendStatus(fiber.StatusNoContent)
}

func (ctl *Controller) playbackObject(c *fiber.Ctx) error {
	query, err := httpx.BindQuery[SignedPlaybackQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	object, err := ctl.service.ResolvePlayback(c.UserContext(), query)
	if err != nil {
		return err
	}

	dispositionType := "attachment"
	if strings.HasPrefix(object.MIMEType, "image/") || strings.HasPrefix(object.MIMEType, "video/") || object.MIMEType == "application/pdf" || object.MIMEType == "application/vnd.apple.mpegurl" {
		dispositionType = "inline"
	}
	c.Set(fiber.HeaderContentType, object.MIMEType)
	c.Set(fiber.HeaderContentDisposition, fmt.Sprintf(`%s; filename="%s"`, dispositionType, sanitizeDispositionFilename(object.FileName)))
	return c.SendFile(object.Path)
}

func sanitizeDispositionFilename(fileName string) string {
	cleaned := strings.TrimSpace(fileName)
	cleaned = strings.ReplaceAll(cleaned, `"`, "")
	if cleaned == "" {
		return "download.bin"
	}
	return cleaned
}

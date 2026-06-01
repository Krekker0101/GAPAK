package posts

import (
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
	group := router.Group("/posts", requireAuth)
	group.Get("/feed", ctl.feed)
	group.Get("/clips", ctl.clips)
	group.Get("/:postId", ctl.get)
	group.Get("/:postId/comments", ctl.getComments)
	group.Get("/:postId/likes", ctl.getPostLikes)
	group.Post("/", ctl.create)
	group.Post("/:postId/like", ctl.likePost)
	group.Delete("/:postId/like", ctl.unlikePost)
	group.Post("/:postId/comments", ctl.createComment)
	group.Patch("/:postId", ctl.update)
	group.Patch("/comments/:commentId", ctl.updateComment)
	group.Delete("/:postId", ctl.remove)
	group.Delete("/comments/:commentId", ctl.deleteComment)
	group.Post("/comments/:commentId/like", ctl.likeComment)
	group.Delete("/comments/:commentId/like", ctl.unlikeComment)
}

func (ctl *Controller) clips(c *fiber.Ctx) error {
	query, err := httpx.BindQuery[FeedQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	query.ContentType = "CLIP"
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Feed(c.UserContext(), claims.UserID, query.Page, query.Limit, query.ContentType)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) feed(c *fiber.Ctx) error {
	query, err := httpx.BindQuery[FeedQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Feed(c.UserContext(), claims.UserID, query.Page, query.Limit, query.ContentType)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) get(c *fiber.Ctx) error {
	postID, err := httpx.UUIDParam(c, "postId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Get(c.UserContext(), claims.UserID, postID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) create(c *fiber.Ctx) error {
	payload, err := httpx.BindBody[CreatePostRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Create(c.UserContext(), claims.UserID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) update(c *fiber.Ctx) error {
	postID, err := httpx.UUIDParam(c, "postId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[UpdatePostRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Update(c.UserContext(), claims.UserID, postID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) remove(c *fiber.Ctx) error {
	postID, err := httpx.UUIDParam(c, "postId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.Delete(c.UserContext(), claims.UserID, postID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) likePost(c *fiber.Ctx) error {
	postID, err := httpx.UUIDParam(c, "postId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	err = ctl.service.LikePost(c.UserContext(), claims.UserID, postID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(AcceptedResponse{Accepted: true}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) unlikePost(c *fiber.Ctx) error {
	postID, err := httpx.UUIDParam(c, "postId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	err = ctl.service.UnlikePost(c.UserContext(), claims.UserID, postID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(AcceptedResponse{Accepted: true}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) getPostLikes(c *fiber.Ctx) error {
	postID, err := httpx.UUIDParam(c, "postId")
	if err != nil {
		return err
	}
	query, err := httpx.BindQuery[FeedQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.GetPostLikes(c.UserContext(), claims.UserID, postID, query.Page, query.Limit)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) getComments(c *fiber.Ctx) error {
	postID, err := httpx.UUIDParam(c, "postId")
	if err != nil {
		return err
	}
	query, err := httpx.BindQuery[CommentQuery](c, ctl.validate)
	if err != nil {
		return err
	}
	if query.Page == 0 {
		query.Page = 1
	}
	if query.Limit == 0 {
		query.Limit = 20
	}
	if query.SortBy == "" {
		query.SortBy = "recent"
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.GetComments(c.UserContext(), claims.UserID, postID, query.Page, query.Limit, query.SortBy)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) createComment(c *fiber.Ctx) error {
	postID, err := httpx.UUIDParam(c, "postId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[CreateCommentRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.CreateComment(c.UserContext(), claims.UserID, postID, payload)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) updateComment(c *fiber.Ctx) error {
	commentID, err := httpx.UUIDParam(c, "commentId")
	if err != nil {
		return err
	}
	payload, err := httpx.BindBody[UpdateCommentRequest](c, ctl.validate)
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	response, err := ctl.service.UpdateComment(c.UserContext(), claims.UserID, commentID, payload)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(response, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) deleteComment(c *fiber.Ctx) error {
	commentID, err := httpx.UUIDParam(c, "commentId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	err = ctl.service.DeleteComment(c.UserContext(), claims.UserID, commentID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(AcceptedResponse{Accepted: true}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) likeComment(c *fiber.Ctx) error {
	commentID, err := httpx.UUIDParam(c, "commentId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	err = ctl.service.LikeComment(c.UserContext(), claims.UserID, commentID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(AcceptedResponse{Accepted: true}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

func (ctl *Controller) unlikeComment(c *fiber.Ctx) error {
	commentID, err := httpx.UUIDParam(c, "commentId")
	if err != nil {
		return err
	}
	claims := middleware.ClaimsFromContext(c)
	err = ctl.service.UnlikeComment(c.UserContext(), claims.UserID, commentID)
	if err != nil {
		return err
	}
	return c.JSON(httpx.OK(AcceptedResponse{Accepted: true}, c.GetRespHeader(fiber.HeaderXRequestID), nil))
}

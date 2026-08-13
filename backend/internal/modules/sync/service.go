package sync

import (
	"context"
	"errors"
	"sort"
	"time"

	apperrors "github.com/gapak/backend/internal/platform/errors"
)

type Service struct {
	repo  *Repository
	codec *CursorCodec
}

func NewService(repo *Repository, codec *CursorCodec) *Service {
	return &Service{repo: repo, codec: codec}
}

func (s *Service) Sync(ctx context.Context, userID, rawCursor string, limit int) (Response, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	var snapshot, after int64
	var cursor string
	if rawCursor == "" {
		current, err := s.repo.CurrentRevision(ctx)
		if err != nil {
			return Response{}, err
		}
		snapshot = current
		cursor, err = s.codec.Encode(userID, snapshot, 0, time.Now())
		if err != nil {
			return Response{}, err
		}
	} else {
		var err error
		snapshot, after, err = s.codec.Decode(userID, rawCursor, time.Now())
		if err != nil {
			if err.Error() == "sync cursor expired" {
				return Response{}, apperrors.New(400, "sync.cursor_expired", "Sync cursor expired")
			}
			return Response{}, apperrors.New(400, "sync.cursor_invalid", "Invalid sync cursor")
		}
		if snapshot == 0 {
			snapshot, err = s.repo.CurrentRevision(ctx)
			if err != nil {
				return Response{}, err
			}
		}
		cursor, err = s.codec.Encode(userID, snapshot, after, time.Now())
		if err != nil {
			return Response{}, err
		}
	}

	events, more, err := s.repo.Events(ctx, userID, after, snapshot, limit)
	if err != nil {
		return Response{}, err
	}

	changes := Changes{
		Users: make([]Change, 0), Connections: make([]Change, 0), Chats: make([]Change, 0), Messages: make([]Change, 0),
		Notifications: make([]Change, 0), Stories: make([]Change, 0), Subscriptions: make([]Change, 0), Live: make([]Change, 0),
	}
	deleted := make([]DeletedChange, 0)
	latest := make(map[string]Change)
	latestDeleted := make(map[string]DeletedChange)
	lastRevision := after

	for _, e := range events {
		if e.Revision > lastRevision {
			lastRevision = e.Revision
		}
		if ns, err := s.repo.NotificationsForEvent(ctx, userID, e.ID, e.Revision); err != nil {
			return Response{}, err
		} else {
			for _, n := range ns {
				latest["notification:"+n.ID] = n
			}
		}
		c, d, err := s.repo.LoadChange(ctx, userID, e)
		if err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return Response{}, err
			}
			return Response{}, err
		}
		if c.ID != "" {
			latest[c.EntityType+":"+c.ID] = c
			if c.EntityType == "message" {
				chatID, ok := c.Data["chatId"].(string)
				if ok && chatID != "" {
					chat, err := s.repo.ChatChange(ctx, userID, chatID, e.Revision)
					if err != nil {
						return Response{}, err
					}
					latest["chat:"+chat.ID] = chat
				}
			}
		}
		if d != nil {
			latestDeleted[d.EntityType+":"+d.ID] = *d
		}
	}

	for _, c := range latest {
		appendChange(&changes, c)
	}
	for _, d := range latestDeleted {
		deleted = append(deleted, d)
	}
	sortChanges(&changes)
	sort.Slice(deleted, func(i, j int) bool {
		if deleted[i].Revision == deleted[j].Revision {
			return deleted[i].EntityType < deleted[j].EntityType
		}
		return deleted[i].Revision < deleted[j].Revision
	})

	resp := Response{Cursor: cursor, HasMore: more, Changes: changes, Deleted: deleted}
	if more {
		next, err := s.codec.Encode(userID, snapshot, lastRevision, time.Now())
		if err != nil {
			return Response{}, err
		}
		resp.NextCursor = next
	} else {
		tail, err := s.codec.Encode(userID, 0, lastRevision, time.Now())
		if err != nil {
			return Response{}, err
		}
		resp.NextCursor = tail
	}
	return resp, nil
}

func appendChange(ch *Changes, c Change) {
	switch c.EntityType {
	case "user":
		ch.Users = append(ch.Users, c)
	case "connection":
		ch.Connections = append(ch.Connections, c)
	case "chat":
		ch.Chats = append(ch.Chats, c)
	case "message":
		ch.Messages = append(ch.Messages, c)
	case "notification":
		ch.Notifications = append(ch.Notifications, c)
	case "story":
		ch.Stories = append(ch.Stories, c)
	case "subscription":
		ch.Subscriptions = append(ch.Subscriptions, c)
	case "live":
		ch.Live = append(ch.Live, c)
	}
}

func sortChanges(ch *Changes) {
	lists := []*[]Change{&ch.Users, &ch.Connections, &ch.Chats, &ch.Messages, &ch.Notifications, &ch.Stories, &ch.Subscriptions, &ch.Live}
	for _, list := range lists {
		sort.Slice(*list, func(i, j int) bool {
			if (*list)[i].Revision == (*list)[j].Revision {
				return (*list)[i].ID < (*list)[j].ID
			}
			return (*list)[i].Revision < (*list)[j].Revision
		})
	}
}

func (s *Service) BootstrapCursor(ctx context.Context, userID string) (string, error) {
	rev, err := s.repo.CurrentRevision(ctx)
	if err != nil {
		return "", err
	}
	return s.codec.Encode(userID, rev, 0, time.Now())
}

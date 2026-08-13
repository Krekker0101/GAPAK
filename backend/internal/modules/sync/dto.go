package sync

import "time"

type Query struct {
	Cursor string `query:"cursor" validate:"omitempty,max=2048"`
	Limit  int    `query:"limit" validate:"omitempty,min=1,max=100"`
}

type Change struct {
	ID         string         `json:"id"`
	EntityType string         `json:"entityType"`
	Operation  string         `json:"operation"`
	Revision   int64          `json:"revision"`
	UpdatedAt  *time.Time     `json:"updatedAt,omitempty"`
	DeletedAt  *time.Time     `json:"deletedAt,omitempty"`
	Data       map[string]any `json:"data,omitempty"`
}

type DeletedChange struct {
	ID         string     `json:"id"`
	EntityType string     `json:"entityType"`
	Revision   int64      `json:"revision"`
	DeletedAt  *time.Time `json:"deletedAt,omitempty"`
}

type Changes struct {
	Users         []Change `json:"users"`
	Connections   []Change `json:"connections"`
	Chats         []Change `json:"chats"`
	Messages      []Change `json:"messages"`
	Notifications []Change `json:"notifications"`
	Stories       []Change `json:"stories"`
	Subscriptions []Change `json:"subscriptions"`
	Live          []Change `json:"live"`
}

type Response struct {
	Cursor     string          `json:"cursor"`
	NextCursor string          `json:"nextCursor,omitempty"`
	HasMore    bool            `json:"hasMore"`
	Changes    Changes         `json:"changes"`
	Deleted    []DeletedChange `json:"deleted"`
}

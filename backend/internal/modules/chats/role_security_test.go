package chats

import (
	"github.com/gapak/backend/internal/domain/enums"
	"testing"
)

func TestCanGrantChatRole(t *testing.T) {
	cases := []struct {
		actor, requested enums.ChatMemberRole
		want             bool
	}{
		{enums.ChatRoleOwner, enums.ChatRoleAdmin, true},
		{enums.ChatRoleOwner, enums.ChatRoleModerator, true},
		{enums.ChatRoleAdmin, enums.ChatRoleModerator, true},
		{enums.ChatRoleAdmin, enums.ChatRoleAdmin, false},
		{enums.ChatRoleAdmin, enums.ChatRoleOwner, false},
		{enums.ChatRoleModerator, enums.ChatRoleAdmin, false},
		{enums.ChatRoleOwner, enums.ChatRoleOwner, false},
	}
	for _, tc := range cases {
		if got := canGrantChatRole(tc.actor, tc.requested); got != tc.want {
			t.Fatalf("actor=%s requested=%s got=%v want=%v", tc.actor, tc.requested, got, tc.want)
		}
	}
}

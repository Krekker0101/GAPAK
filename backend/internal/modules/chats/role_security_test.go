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

func TestCanSendToChat(t *testing.T) {
	if !canSendToChat(enums.ChatTypeDirect, enums.ChatRoleMember) || !canSendToChat(enums.ChatTypeGroup, enums.ChatRoleMember) {
		t.Fatal("members must be able to send in direct and group chats")
	}
	for _, chatType := range []enums.ChatType{enums.ChatTypeChannel, enums.ChatTypeBroadcast} {
		if canSendToChat(chatType, enums.ChatRoleMember) {
			t.Fatalf("regular members must not publish to %s", chatType)
		}
		for _, role := range []enums.ChatMemberRole{enums.ChatRoleOwner, enums.ChatRoleAdmin, enums.ChatRoleModerator} {
			if !canSendToChat(chatType, role) {
				t.Fatalf("role %s must be able to publish to %s", role, chatType)
			}
		}
	}
}

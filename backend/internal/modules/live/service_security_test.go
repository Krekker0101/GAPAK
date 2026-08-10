package live

import (
	"github.com/gapak/backend/internal/domain/enums"
	"testing"
)

func TestAuthorizeJoinCannotSelfAssignPrivilegedRole(t *testing.T) {
	for _, role := range []enums.LiveParticipantRole{enums.LiveRoleCoHost, enums.LiveRoleModerator, enums.LiveRoleHost} {
		if _, _, ok := authorizeJoin("host", "viewer", role, false); ok {
			t.Fatalf("role %s was incorrectly authorized", role)
		}
	}
}

func TestAuthorizeJoinViewerAndGuest(t *testing.T) {
	for _, role := range []enums.LiveParticipantRole{enums.LiveRoleViewer, enums.LiveRoleGuest} {
		got, ghost, ok := authorizeJoin("host", "viewer", role, false)
		if !ok || ghost || got != role {
			t.Fatalf("unexpected authorization for %s: role=%s ghost=%v ok=%v", role, got, ghost, ok)
		}
	}
}

func TestAuthorizeJoinHostIsAlwaysHost(t *testing.T) {
	got, ghost, ok := authorizeJoin("host", "host", enums.LiveRoleViewer, true)
	if !ok || ghost || got != enums.LiveRoleHost {
		t.Fatalf("host was not normalized to HOST: role=%s ghost=%v ok=%v", got, ghost, ok)
	}
}

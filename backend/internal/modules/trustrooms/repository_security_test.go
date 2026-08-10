package trustrooms

import (
	"github.com/gapak/backend/internal/domain/enums"
	"testing"
)

func TestAllowedMemberRoleCannotMintOwner(t *testing.T) {
	if allowedMemberRole(enums.TrustRoleOwner, enums.TrustRoleOwner) || allowedMemberRole(enums.TrustRoleAdmin, enums.TrustRoleOwner) {
		t.Fatal("owner role can be minted by member-management endpoint")
	}
}

func TestAdminCannotMintAnotherAdmin(t *testing.T) {
	if allowedMemberRole(enums.TrustRoleAdmin, enums.TrustRoleAdmin) {
		t.Fatal("room admin can mint another room admin")
	}
}

func TestOwnerCanGrantAdmin(t *testing.T) {
	if !allowedMemberRole(enums.TrustRoleOwner, enums.TrustRoleAdmin) {
		t.Fatal("room owner should be able to grant ADMIN")
	}
}

package concurrency

import (
	"os"
	"strings"
	"testing"
)

func TestEntityVersionMigrationIsIdempotentAndHasProtectedDeletePath(t *testing.T) {
	data, err := os.ReadFile("../../../db/migrations/20260813040000_entity_versions_etag.sql")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(data)
	required := []string{
		"CREATE TABLE IF NOT EXISTS entity_versions",
		"ON CONFLICT (resource_type, entity_id)",
		"DROP TRIGGER IF EXISTS users_entity_version_trg",
		"IF TG_TABLE_NAME IN ('users','friend_connections','stories','live_streams','media_files')",
		"CREATE TRIGGER media_files_entity_version_trg",
	}
	for _, needle := range required {
		if !strings.Contains(sql, needle) {
			t.Fatalf("migration missing %q", needle)
		}
	}
}

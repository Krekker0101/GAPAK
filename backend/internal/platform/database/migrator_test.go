package database

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadMigrationsRejectsDuplicateVersions(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "0001_first.sql"), []byte("SELECT 1;"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "0001_second.sql"), []byte("SELECT 2;"), 0o600); err != nil {
		t.Fatal(err)
	}

	_, err := LoadMigrations(dir)
	if err == nil || !strings.Contains(err.Error(), "duplicate migration version") {
		t.Fatalf("expected duplicate version error, got %v", err)
	}
}

func TestParseMigrationName(t *testing.T) {
	version, name := parseMigrationName("20260809000000_distributed_state_hardening.sql")
	if version != "20260809000000" || name != "distributed_state_hardening" {
		t.Fatalf("unexpected parse result: %q %q", version, name)
	}
}

func TestMigrationChecksumIsDeterministic(t *testing.T) {
	dir := t.TempDir()
	content := []byte("CREATE TABLE example(id UUID PRIMARY KEY);\n")
	if err := os.WriteFile(filepath.Join(dir, "0001_example.sql"), content, 0o600); err != nil {
		t.Fatal(err)
	}
	first, err := LoadMigrations(dir)
	if err != nil {
		t.Fatal(err)
	}
	second, err := LoadMigrations(dir)
	if err != nil {
		t.Fatal(err)
	}
	if first[0].Checksum == "" || first[0].Checksum != second[0].Checksum {
		t.Fatalf("checksum is not deterministic: %q vs %q", first[0].Checksum, second[0].Checksum)
	}
}

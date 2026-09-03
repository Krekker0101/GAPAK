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

func TestLoadMigrationsRejectsInvalidFilename(t *testing.T) {
	dir := t.TempDir()
	invalidPath := filepath.Join(dir, "migration_without_version.sql")
	if err := os.WriteFile(invalidPath, []byte("SELECT 1;"), 0o600); err != nil {
		t.Fatal(err)
	}

	_, err := LoadMigrations(dir)
	if err == nil || !strings.Contains(err.Error(), "invalid migration filename") {
		t.Fatalf("expected invalid filename error, got %v", err)
	}
}

func TestLoadMigrationsRejectsEmptySQL(t *testing.T) {
	dir := t.TempDir()
	emptyPath := filepath.Join(dir, "0001_empty.sql")
	if err := os.WriteFile(emptyPath, []byte(" \n\t"), 0o600); err != nil {
		t.Fatal(err)
	}

	_, err := LoadMigrations(dir)
	if err == nil || !strings.Contains(err.Error(), "is empty") {
		t.Fatalf("expected empty migration error, got %v", err)
	}
}

func TestRepositoryMigrationsHaveUniqueVersions(t *testing.T) {
	if _, err := LoadMigrations(filepath.Join("..", "..", "..", "db", "migrations")); err != nil {
		t.Fatalf("repository migrations must be loadable: %v", err)
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

func TestIsSchemaOnlyMigration(t *testing.T) {
	tests := []struct {
		name string
		sql  string
		want bool
	}{
		{name: "ddl", sql: `CREATE TABLE users(id UUID PRIMARY KEY); ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ;`, want: true},
		{name: "insert", sql: `CREATE TABLE seed(id INT); INSERT INTO seed(id) VALUES (1);`, want: false},
		{name: "deferred update in function body", sql: `CREATE FUNCTION bump() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE users SET id = id; RETURN NEW; END $$;`, want: true},
		{name: "comment only", sql: `-- UPDATE users SET id = id;
CREATE TABLE users(id INT);`, want: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isSchemaOnlyMigration(tt.sql); got != tt.want {
				t.Fatalf("isSchemaOnlyMigration() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRepositoryMigrationsClassifyFunctionDMLAsSchemaOnly(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "..", "db", "migrations", "20260522000000_add_likes_and_comments.sql"))
	if err != nil {
		t.Fatal(err)
	}
	if !isSchemaOnlyMigration(string(content)) {
		t.Fatal("function trigger UPDATE statements must not classify the migration as data-changing")
	}
}

func TestSchemaOnlyClassifierIgnoresForeignKeyOnUpdate(t *testing.T) {
	if !isSchemaOnlyMigration(`CREATE TABLE child(id UUID, parent_id UUID REFERENCES parent(id) ON UPDATE CASCADE);`) {
		t.Fatal("ON UPDATE CASCADE must not be classified as data-changing")
	}
}

func TestRepositoryMigrationsKeepRealDataChanges(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "..", "db", "migrations", "20260715000000_add_trusted_chat_e2ee.sql"))
	if err != nil {
		t.Fatal(err)
	}
	if isSchemaOnlyMigration(string(content)) {
		t.Fatal("trusted E2EE migration contains real data updates and must remain data-changing")
	}
}

package database

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Migration struct {
	Version  string
	Name     string
	Path     string
	SQL      string
	Checksum string
}

var migrationFileNamePattern = regexp.MustCompile(`^[0-9]+_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$`)

// migrationVersionAliases keeps deployment compatibility with migration files
// that were briefly published under an already-used version. New repositories
// contain the corrected filename, but an older build context may still contain
// the legacy name during a rolling deployment.
var migrationVersionAliases = map[string]string{
	"20260828000000_allow_simple_direct_chats.sql": "20260829000000",
}

// querier is the subset of *pgxpool.Pool / *pgxpool.Conn needed for migrations.
type querier interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func ApplyMigrations(ctx context.Context, db *pgxpool.Pool, dir string) error {
	if db == nil {
		return fmt.Errorf("database pool is nil")
	}

	// Hold a dedicated connection for the advisory lock so the lock is released
	// on the same session that acquired it. pg_advisory_lock is per-connection.
	conn, err := db.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire migration connection: %w", err)
	}
	defer conn.Release()

	const migrationLockID int64 = 42
	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", migrationLockID); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	defer func() {
		unlockCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = conn.Exec(unlockCtx, "SELECT pg_advisory_unlock($1)", migrationLockID)
	}()

	if err := ensureMigrationTable(ctx, conn); err != nil {
		return err
	}

	migrations, err := LoadMigrations(dir)
	if err != nil {
		return err
	}

	shadowSchema := fmt.Sprintf("gapak_shadow_%d", time.Now().UnixNano())
	if _, err := conn.Exec(ctx, fmt.Sprintf("CREATE SCHEMA %s", quoteIdent(shadowSchema))); err != nil {
		return fmt.Errorf("create migration shadow schema: %w", err)
	}
	defer func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_, _ = conn.Exec(cleanupCtx, fmt.Sprintf("DROP SCHEMA IF EXISTS %s CASCADE", quoteIdent(shadowSchema)))
	}()
	if _, err := conn.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", quoteIdent(shadowSchema))); err != nil {
		return fmt.Errorf("set migration shadow search path: %w", err)
	}
	defer func() { _, _ = conn.Exec(context.Background(), "SET search_path TO public") }()

	for _, migration := range migrations {
		// The shadow schema always represents the repository's expected state
		// immediately before this migration. Reconcile the live database first,
		// so missing/changed tables and columns are fixed before DDL runs.
		if hasShadowObjects(ctx, conn, shadowSchema) {
			if err := reconcileLiveSchema(ctx, conn, shadowSchema); err != nil {
				return fmt.Errorf("reconcile schema before migration %s: %w", migration.Version, err)
			}
		}

		applied, err := isMigrationApplied(ctx, conn, migration)
		if err != nil {
			return err
		}
		if applied {
			if err := execMigrationOnSchema(ctx, conn, shadowSchema, migration.SQL); err != nil {
				return fmt.Errorf("advance migration shadow for %s: %w", migration.Version, err)
			}
			continue
		}

		// Pure schema migrations are reconciled instead of blindly replaying DDL.
		// This allows a pre-existing database with the correct tables but missing
		// migration history to be adopted safely, while data-changing migrations
		// still execute their SQL exactly once.
		if isSchemaOnlyMigration(migration.SQL) {
			if err := execMigrationOnSchema(ctx, conn, shadowSchema, migration.SQL); err != nil {
				return fmt.Errorf("build schema target for %s: %w", migration.Version, err)
			}
			if err := reconcileLiveSchema(ctx, conn, shadowSchema); err != nil {
				return fmt.Errorf("reconcile schema for migration %s: %w", migration.Version, err)
			}
			if _, err := conn.Exec(ctx, `INSERT INTO public.schema_migrations (version, name, checksum) VALUES ($1, $2, $3)`, migration.Version, migration.Name, migration.Checksum); err != nil {
				return fmt.Errorf("record reconciled migration %s: %w", migration.Version, err)
			}
			continue
		}

		// Validate/build the next schema in the shadow first. If the migration
		// cannot execute against the repository schema, do not touch the live DB.
		if err := execMigrationOnSchema(ctx, conn, shadowSchema, migration.SQL); err != nil {
			return fmt.Errorf("validate migration %s in shadow: %w", migration.Version, err)
		}

		tx, err := conn.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, "SET LOCAL search_path TO public"); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("set live migration search path for %s: %w", migration.Version, err)
		}
		if _, err := tx.Exec(ctx, migration.SQL); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("apply migration %s: %w", migration.Version, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO public.schema_migrations (version, name, checksum) VALUES ($1, $2, $3)`, migration.Version, migration.Name, migration.Checksum); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("record migration %s: %w", migration.Version, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %s: %w", migration.Version, err)
		}
	}

	if err := reconcileLiveSchema(ctx, conn, shadowSchema); err != nil {
		return fmt.Errorf("final schema reconciliation: %w", err)
	}
	return nil
}

func reconcileLiveSchema(ctx context.Context, conn *pgxpool.Conn, expectedSchema string) error {
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin schema reconciliation: %w", err)
	}
	defer tx.Rollback(ctx)
	if err := reconcileSchema(ctx, tx, expectedSchema); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit schema reconciliation: %w", err)
	}
	return nil
}

func hasShadowObjects(ctx context.Context, db rowQuerier, schema string) bool {
	var n int
	if err := db.QueryRow(ctx, `SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind IN ('r','p')`, schema).Scan(&n); err != nil {
		return false
	}
	return n > 0
}

func execMigrationOnSchema(ctx context.Context, conn interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}, schema, sql string) error {
	if _, err := conn.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", quoteIdent(schema))); err != nil {
		return err
	}
	_, err := conn.Exec(ctx, sql)
	return err
}

func isSchemaOnlyMigration(sql string) bool {
	for _, statement := range splitSQLStatements(stripSQLComments(sql)) {
		if statementHasDataMutation(statement) {
			return false
		}
	}
	return true
}

func statementHasDataMutation(statement string) bool {
	trimmed := strings.TrimSpace(statement)
	if trimmed == "" {
		return false
	}
	upper := strings.ToUpper(trimmed)
	if regexp.MustCompile(`^(INSERT|UPDATE|DELETE|MERGE|TRUNCATE|COPY)\b`).MatchString(upper) {
		return true
	}
	if strings.HasPrefix(upper, "WITH ") && regexp.MustCompile(`(?s)^WITH\b.*\b(INSERT|UPDATE|DELETE|MERGE)\b`).MatchString(upper) {
		return true
	}
	if !strings.HasPrefix(upper, "DO ") {
		return false
	}
	// DO blocks execute immediately. Inspect their PL/pgSQL statements, not
	// arbitrary keywords such as OR UPDATE inside CREATE TRIGGER.
	open := strings.Index(trimmed, "$")
	if open < 0 {
		return false
	}
	tag := readDollarTag(trimmed[open:])
	if tag == "" {
		return false
	}
	bodyStart := open + len(tag)
	relClose := strings.LastIndex(trimmed[bodyStart:], tag)
	if relClose < 0 {
		return false
	}
	body := trimmed[bodyStart : bodyStart+relClose]
	for _, inner := range splitSQLStatements(body) {
		if statementHasDataMutation(inner) {
			return true
		}
	}
	return false
}

func stripSQLComments(sql string) string {
	block := regexp.MustCompile(`(?s)/\*.*?\*/`)
	line := regexp.MustCompile(`(?m)--.*$`)
	return line.ReplaceAllString(block.ReplaceAllString(sql, ""), "")
}

func splitSQLStatements(sql string) []string {
	var statements []string
	start := 0
	var dollarTag string
	singleQuote, doubleQuote := false, false
	for i := 0; i < len(sql); i++ {
		if dollarTag != "" {
			if strings.HasPrefix(sql[i:], dollarTag) {
				i += len(dollarTag) - 1
				dollarTag = ""
			}
			continue
		}
		if singleQuote {
			if sql[i] == '\'' {
				if i+1 < len(sql) && sql[i+1] == '\'' {
					i++
				} else {
					singleQuote = false
				}
			}
			continue
		}
		if doubleQuote {
			if sql[i] == '"' {
				if i+1 < len(sql) && sql[i+1] == '"' {
					i++
				} else {
					doubleQuote = false
				}
			}
			continue
		}
		switch sql[i] {
		case '\'':
			singleQuote = true
		case '"':
			doubleQuote = true
		case '$':
			if tag := readDollarTag(sql[i:]); tag != "" {
				dollarTag = tag
				i += len(tag) - 1
			}
		case ';':
			statements = append(statements, sql[start:i])
			start = i + 1
		}
	}
	if start < len(sql) {
		statements = append(statements, sql[start:])
	}
	return statements
}

func readDollarTag(s string) string {
	if len(s) < 2 || s[0] != '$' {
		return ""
	}
	if s[1] == '$' {
		return "$$"
	}
	if !((s[1] >= 'a' && s[1] <= 'z') || (s[1] >= 'A' && s[1] <= 'Z') || s[1] == '_') {
		return ""
	}
	for i := 2; i < len(s); i++ {
		c := s[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' {
			continue
		}
		if c == '$' {
			return s[:i+1]
		}
		return ""
	}
	return ""
}

func LoadMigrations(dir string) ([]Migration, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read migrations dir %s: %w", dir, err)
	}

	migrations := make([]Migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if filepath.Ext(entry.Name()) != ".sql" {
			continue
		}
		if !migrationFileNamePattern.MatchString(entry.Name()) {
			return nil, fmt.Errorf("invalid migration filename %q: expected <numeric-version>_<lowercase-name>.sql", entry.Name())
		}

		fullPath := filepath.Join(dir, entry.Name())
		content, err := os.ReadFile(fullPath)
		if err != nil {
			return nil, fmt.Errorf("read migration %s: %w", fullPath, err)
		}
		if strings.TrimSpace(string(content)) == "" {
			return nil, fmt.Errorf("migration %s is empty", fullPath)
		}

		version, name := parseMigrationName(entry.Name())
		if correctedVersion, ok := migrationVersionAliases[entry.Name()]; ok {
			version = correctedVersion
		}
		checksum := sha256.Sum256(content)

		migrations = append(migrations, Migration{
			Version:  version,
			Name:     name,
			Path:     fullPath,
			SQL:      string(content),
			Checksum: hex.EncodeToString(checksum[:]),
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		if migrations[i].Version == migrations[j].Version {
			return migrations[i].Name < migrations[j].Name
		}
		return migrations[i].Version < migrations[j].Version
	})

	deduplicated := migrations[:0]
	for _, migration := range migrations {
		if len(deduplicated) > 0 && deduplicated[len(deduplicated)-1].Version == migration.Version {
			previous := deduplicated[len(deduplicated)-1]
			if previous.Name == migration.Name && previous.Checksum == migration.Checksum {
				// A rolling build may contain both the corrected migration filename
				// and its byte-identical legacy alias. Applying either one produces
				// the same schema, so keep one canonical migration.
				continue
			}
			return nil, fmt.Errorf("duplicate migration version %q: %s and %s", migration.Version, previous.Path, migration.Path)
		}
		deduplicated = append(deduplicated, migration)
	}

	return deduplicated, nil
}

func ensureMigrationTable(ctx context.Context, db querier) error {
	_, err := db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			checksum TEXT NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	return err
}

func isMigrationApplied(ctx context.Context, db querier, migration Migration) (bool, error) {
	var storedName, storedChecksum string
	err := db.QueryRow(ctx, `
		SELECT name, checksum
		FROM public.schema_migrations
		WHERE version = $1`, migration.Version).Scan(&storedName, &storedChecksum)
	if err != nil {
		if err == pgx.ErrNoRows {
			return false, nil
		}
		return false, err
	}
	if storedName != migration.Name || storedChecksum != migration.Checksum {
		if _, err := db.Exec(ctx, `
			UPDATE public.schema_migrations
			SET name = $2, checksum = $3
			WHERE version = $1`, migration.Version, migration.Name, migration.Checksum); err != nil {
			return false, fmt.Errorf("heal migration record %s: %w", migration.Version, err)
		}
		return true, nil
	}
	return true, nil
}

func parseMigrationName(fileName string) (string, string) {
	base := strings.TrimSuffix(fileName, filepath.Ext(fileName))
	parts := strings.SplitN(base, "_", 2)
	if len(parts) == 1 {
		return parts[0], parts[0]
	}
	return parts[0], parts[1]
}

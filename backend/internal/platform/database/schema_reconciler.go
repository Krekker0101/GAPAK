package database

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
)

// reconcileSchema aligns the live public schema with the schema represented by
// all migrations that have already been applied. It is intentionally additive
// and corrective: missing tables/columns/enums/indexes are created, incompatible
// types/defaults/nullability are corrected, while unknown extra columns are
// preserved to avoid destructive data loss.
func reconcileSchema(ctx context.Context, db querier, expectedSchema string) error {
	normalized := strings.TrimSpace(expectedSchema)
	if normalized == "" {
		return nil
	}
	// SQL emitted by reconciliation always targets public explicitly. Keep the
	// session search_path on public while executing constraints/indexes, then
	// restore the shadow schema used by the migration simulator.
	if _, err := db.Exec(ctx, "SET search_path TO public"); err != nil {
		return fmt.Errorf("set reconciliation search path: %w", err)
	}
	defer func() {
		_, _ = db.Exec(context.Background(), fmt.Sprintf("SET search_path TO %s, public", quoteIdent(expectedSchema)))
	}()

	if err := reconcileEnums(ctx, db, expectedSchema); err != nil {
		return err
	}
	if err := reconcileTablesAndColumns(ctx, db, expectedSchema); err != nil {
		return err
	}
	if err := reconcileConstraints(ctx, db, expectedSchema); err != nil {
		return err
	}
	if err := reconcileFunctions(ctx, db, expectedSchema); err != nil {
		return err
	}
	if err := reconcileTriggers(ctx, db, expectedSchema); err != nil {
		return err
	}
	if err := reconcileIndexes(ctx, db, expectedSchema); err != nil {
		return err
	}
	return nil
}

func reconcileEnums(ctx context.Context, db querier, schema string) error {
	want, err := listEnums(ctx, db, schema)
	if err != nil {
		return fmt.Errorf("inspect expected enums: %w", err)
	}
	got, err := listEnums(ctx, db, "public")
	if err != nil {
		return fmt.Errorf("inspect live enums: %w", err)
	}

	for name, values := range want {
		live, ok := got[name]
		if !ok {
			literals := make([]string, 0, len(values))
			for _, v := range values {
				literals = append(literals, quoteLiteral(v))
			}
			if _, err := db.Exec(ctx, fmt.Sprintf("CREATE TYPE public.%s AS ENUM (%s)", quoteIdent(name), strings.Join(literals, ", "))); err != nil {
				return fmt.Errorf("create enum %s: %w", name, err)
			}
			continue
		}

		seen := make(map[string]struct{}, len(live))
		for _, value := range live {
			seen[value] = struct{}{}
		}
		for _, expected := range values {
			if _, exists := seen[expected]; exists {
				continue
			}
			// PostgreSQL permits enum labels to be appended safely. It cannot
			// safely remove or reorder existing labels without a destructive type
			// rewrite, so preserve existing data/order and append missing labels.
			if _, err := db.Exec(ctx, fmt.Sprintf("ALTER TYPE public.%s ADD VALUE IF NOT EXISTS %s", quoteIdent(name), quoteLiteral(expected))); err != nil {
				return fmt.Errorf("add enum value %s.%s: %w", name, expected, err)
			}
			seen[expected] = struct{}{}
		}
	}
	return nil
}

type columnDef struct {
	Name       string
	Type       string
	NotNull    bool
	DefaultSQL string
	Position   int
}

type tableDef struct {
	Columns map[string]columnDef
}

func reconcileTablesAndColumns(ctx context.Context, db querier, schema string) error {
	want, err := listTables(ctx, db, schema)
	if err != nil {
		return fmt.Errorf("inspect expected tables: %w", err)
	}
	got, err := listTables(ctx, db, "public")
	if err != nil {
		return fmt.Errorf("inspect live tables: %w", err)
	}

	for table, expected := range want {
		live, exists := got[table]
		if !exists {
			if err := createMissingTable(ctx, db, schema, table, expected); err != nil {
				return err
			}
			live = tableDef{Columns: map[string]columnDef{}}
		}

		for column, exp := range expected.Columns {
			actual, ok := live.Columns[column]
			if !ok {
				if err := addMissingColumn(ctx, db, schema, table, exp); err != nil {
					return err
				}
				continue
			}

			if normalizeType(actual.Type) != normalizeType(exp.Type) {
				if err := alterColumnType(ctx, db, schema, table, column, exp.Type, actual.DefaultSQL); err != nil {
					return err
				}
			}
			if normalizeSQL(actual.DefaultSQL) != normalizeSQL(exp.DefaultSQL) {
				if exp.DefaultSQL == "" {
					if _, err := db.Exec(ctx, fmt.Sprintf("ALTER TABLE public.%s ALTER COLUMN %s DROP DEFAULT", quoteIdent(table), quoteIdent(column))); err != nil {
						return fmt.Errorf("drop default %s.%s: %w", table, column, err)
					}
				} else {
					if _, err := db.Exec(ctx, fmt.Sprintf("ALTER TABLE public.%s ALTER COLUMN %s SET DEFAULT %s", quoteIdent(table), quoteIdent(column), sanitizePublicExpr(exp.DefaultSQL, schema))); err != nil {
						return fmt.Errorf("set default %s.%s: %w", table, column, err)
					}
				}
			}
			if actual.NotNull != exp.NotNull {
				statement := "DROP NOT NULL"
				if exp.NotNull {
					statement = "SET NOT NULL"
				}
				if _, err := db.Exec(ctx, fmt.Sprintf("ALTER TABLE public.%s ALTER COLUMN %s %s", quoteIdent(table), quoteIdent(column), statement)); err != nil {
					return fmt.Errorf("align nullability %s.%s: %w", table, column, err)
				}
			}
		}
	}
	return nil
}

func createMissingTable(ctx context.Context, db querier, sourceSchema, table string, expected tableDef) error {
	cols := make([]columnDef, 0, len(expected.Columns))
	for _, col := range expected.Columns {
		cols = append(cols, col)
	}
	sort.Slice(cols, func(i, j int) bool { return cols[i].Position < cols[j].Position })
	parts := make([]string, 0, len(cols))
	for _, col := range cols {
		part := fmt.Sprintf("%s %s", quoteIdent(col.Name), sanitizePublicExpr(col.Type, sourceSchema))
		if col.DefaultSQL != "" {
			part += " DEFAULT " + sanitizePublicExpr(col.DefaultSQL, sourceSchema)
		}
		if col.NotNull {
			part += " NOT NULL"
		}
		parts = append(parts, part)
	}
	q := fmt.Sprintf("CREATE TABLE public.%s (%s)", quoteIdent(table), strings.Join(parts, ", "))
	if _, err := db.Exec(ctx, q); err != nil {
		return fmt.Errorf("create missing table %s: %w", table, err)
	}
	return nil
}

func addMissingColumn(ctx context.Context, db querier, sourceSchema, table string, col columnDef) error {
	var b strings.Builder
	fmt.Fprintf(&b, "ALTER TABLE public.%s ADD COLUMN %s %s", quoteIdent(table), quoteIdent(col.Name), sanitizePublicExpr(col.Type, sourceSchema))
	if col.DefaultSQL != "" {
		fmt.Fprintf(&b, " DEFAULT %s", sanitizePublicExpr(col.DefaultSQL, sourceSchema))
	}
	if col.NotNull {
		b.WriteString(" NOT NULL")
	}
	if _, err := db.Exec(ctx, b.String()); err != nil {
		return fmt.Errorf("add missing column %s.%s: %w", table, col.Name, err)
	}
	return nil
}

func alterColumnType(ctx context.Context, db querier, sourceSchema, table, column, expectedType, currentDefault string) error {
	if currentDefault != "" {
		if _, err := db.Exec(ctx, fmt.Sprintf("ALTER TABLE public.%s ALTER COLUMN %s DROP DEFAULT", quoteIdent(table), quoteIdent(column))); err != nil {
			return fmt.Errorf("drop incompatible default %s.%s: %w", table, column, err)
		}
	}
	publicType := sanitizePublicExpr(expectedType, sourceSchema)
	q := fmt.Sprintf("ALTER TABLE public.%s ALTER COLUMN %s TYPE %s USING %s::%s", quoteIdent(table), quoteIdent(column), publicType, quoteIdent(column), publicType)
	if _, err := db.Exec(ctx, q); err != nil {
		return fmt.Errorf("alter column type %s.%s to %s: %w", table, column, expectedType, err)
	}
	return nil
}

func reconcileConstraints(ctx context.Context, db querier, schema string) error {
	want, err := listConstraints(ctx, db, schema)
	if err != nil {
		return fmt.Errorf("inspect expected constraints: %w", err)
	}
	got, err := listConstraints(ctx, db, "public")
	if err != nil {
		return fmt.Errorf("inspect live constraints: %w", err)
	}
	for key, expected := range want {
		actual, ok := got[key]
		if !ok {
			parts := strings.SplitN(key, ":", 2)
			if len(parts) != 2 {
				return fmt.Errorf("invalid constraint key %s", key)
			}
			stmt := fmt.Sprintf("ALTER TABLE public.%s ADD CONSTRAINT %s %s", quoteIdent(parts[0]), quoteIdent(parts[1]), sanitizePublicExpr(expected, schema))
			if _, err := db.Exec(ctx, stmt); err != nil {
				return fmt.Errorf("add missing constraint %s: %w", key, err)
			}
			continue
		}
		if normalizeSQL(actual) != normalizeSQL(sanitizePublicExpr(expected, schema)) {
			return fmt.Errorf("constraint %s exists with incompatible definition; refusing destructive rewrite", key)
		}
	}
	return nil
}

func listConstraints(ctx context.Context, db querier, schema string) (map[string]string, error) {
	rows, err := dbQuery(ctx, db, `SELECT r.relname, c.conname, pg_get_constraintdef(c.oid, true) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=$1 AND c.contype IN ('p','u','f','c','x') ORDER BY r.relname, c.conname`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]string)
	for rows.Next() {
		var table, name, def string
		if err := rows.Scan(&table, &name, &def); err != nil {
			return nil, err
		}
		result[table+":"+name] = def
	}
	return result, rows.Err()
}

type functionDef struct{ Name, Args, Def string }

func reconcileFunctions(ctx context.Context, db querier, schema string) error {
	want, err := listFunctions(ctx, db, schema)
	if err != nil {
		return fmt.Errorf("inspect expected functions: %w", err)
	}
	got, err := listFunctions(ctx, db, "public")
	if err != nil {
		return fmt.Errorf("inspect live functions: %w", err)
	}
	for key, expected := range want {
		actual, ok := got[key]
		if !ok {
			if _, err := db.Exec(ctx, sanitizePublicExpr(expected, schema)); err != nil {
				return fmt.Errorf("create missing function %s: %w", key, err)
			}
			continue
		}
		if normalizeSQL(actual) != normalizeSQL(sanitizePublicExpr(expected, schema)) {
			return fmt.Errorf("function %s exists with incompatible definition; refusing destructive rewrite", key)
		}
	}
	return nil
}
func listFunctions(ctx context.Context, db querier, schema string) (map[string]string, error) {
	rows, err := dbQuery(ctx, db, `SELECT p.proname, pg_get_function_identity_arguments(p.oid), pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.prokind='f' ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]string)
	for rows.Next() {
		var name, args, def string
		if err := rows.Scan(&name, &args, &def); err != nil {
			return nil, err
		}
		result[name+":"+args] = def
	}
	return result, rows.Err()
}

func reconcileTriggers(ctx context.Context, db querier, schema string) error {
	want, err := listTriggers(ctx, db, schema)
	if err != nil {
		return fmt.Errorf("inspect expected triggers: %w", err)
	}
	got, err := listTriggers(ctx, db, "public")
	if err != nil {
		return fmt.Errorf("inspect live triggers: %w", err)
	}
	for key, expected := range want {
		actual, ok := got[key]
		if !ok {
			if _, err := db.Exec(ctx, sanitizePublicExpr(expected, schema)); err != nil {
				return fmt.Errorf("create missing trigger %s: %w", key, err)
			}
			continue
		}
		if normalizeSQL(actual) != normalizeSQL(sanitizePublicExpr(expected, schema)) {
			return fmt.Errorf("trigger %s exists with incompatible definition; refusing destructive rewrite", key)
		}
	}
	return nil
}
func listTriggers(ctx context.Context, db querier, schema string) (map[string]string, error) {
	rows, err := dbQuery(ctx, db, `SELECT r.relname, t.tgname, pg_get_triggerdef(t.oid, true) FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname=$1 AND NOT t.tgisinternal ORDER BY r.relname, t.tgname`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]string)
	for rows.Next() {
		var table, name, def string
		if err := rows.Scan(&table, &name, &def); err != nil {
			return nil, err
		}
		result[table+":"+name] = def
	}
	return result, rows.Err()
}

func reconcileIndexes(ctx context.Context, db querier, schema string) error {
	want, err := listIndexes(ctx, db, schema)
	if err != nil {
		return fmt.Errorf("inspect expected indexes: %w", err)
	}
	got, err := listIndexes(ctx, db, "public")
	if err != nil {
		return fmt.Errorf("inspect live indexes: %w", err)
	}
	for name, expected := range want {
		actual, ok := got[name]
		if !ok {
			if _, err := db.Exec(ctx, sanitizePublicExpr(expected, schema)); err != nil {
				return fmt.Errorf("create missing index %s: %w", name, err)
			}
			continue
		}
		if normalizeSQL(actual) != normalizeSQL(sanitizePublicExpr(expected, schema)) {
			// Do not drop constraint-backed indexes. Their name is present in the
			// index list only when it is not attached to a table constraint.
			if _, err := db.Exec(ctx, fmt.Sprintf("DROP INDEX public.%s", quoteIdent(name))); err != nil {
				return fmt.Errorf("replace drifted index %s: %w", name, err)
			}
			if _, err := db.Exec(ctx, sanitizePublicExpr(expected, schema)); err != nil {
				return fmt.Errorf("recreate drifted index %s: %w", name, err)
			}
		}
	}
	return nil
}

func listEnums(ctx context.Context, db querier, schema string) (map[string][]string, error) {
	result := make(map[string][]string)
	rows, err := dbQuery(ctx, db, `SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname=$1 ORDER BY t.typname, e.enumsortorder`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var name, value string
		if err := rows.Scan(&name, &value); err != nil {
			return nil, err
		}
		result[name] = append(result[name], value)
	}
	return result, rows.Err()
}

func listTables(ctx context.Context, db querier, schema string) (map[string]tableDef, error) {
	rows, err := dbQuery(ctx, db, `
		SELECT c.relname,
		       a.attname,
		       a.attnum,
		       format_type(a.atttypid, a.atttypmod),
		       a.attnotnull,
		       COALESCE(pg_get_expr(ad.adbin, ad.adrelid), '')
		FROM pg_class c
		JOIN pg_namespace n ON n.oid=c.relnamespace
		JOIN pg_attribute a ON a.attrelid=c.oid
		LEFT JOIN pg_attrdef ad ON ad.adrelid=a.attrelid AND ad.adnum=a.attnum
		WHERE n.nspname=$1 AND c.relkind IN ('r','p') AND a.attnum > 0 AND NOT a.attisdropped
		ORDER BY c.relname, a.attnum`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]tableDef)
	for rows.Next() {
		var table, col, typ, def string
		var position int
		var notNull bool
		if err := rows.Scan(&table, &col, &position, &typ, &notNull, &def); err != nil {
			return nil, err
		}
		if _, ok := result[table]; !ok {
			result[table] = tableDef{Columns: map[string]columnDef{}}
		}
		result[table].Columns[col] = columnDef{Name: col, Type: typ, NotNull: notNull, DefaultSQL: def, Position: position}
	}
	return result, rows.Err()
}

func listIndexes(ctx context.Context, db querier, schema string) (map[string]string, error) {
	rows, err := dbQuery(ctx, db, `
		SELECT i.relname, pg_get_indexdef(i.oid)
		FROM pg_class t
		JOIN pg_namespace n ON n.oid=t.relnamespace
		JOIN pg_index x ON x.indrelid=t.oid
		JOIN pg_class i ON i.oid=x.indexrelid
		LEFT JOIN pg_constraint c ON c.conindid=i.oid
		WHERE n.nspname=$1 AND c.oid IS NULL
		ORDER BY i.relname`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]string)
	for rows.Next() {
		var name, def string
		if err := rows.Scan(&name, &def); err != nil {
			return nil, err
		}
		result[name] = def
	}
	return result, rows.Err()
}

type rowQuerier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func dbQuery(ctx context.Context, db querier, sql string, args ...any) (pgx.Rows, error) {
	q, ok := db.(rowQuerier)
	if !ok {
		return nil, fmt.Errorf("migration database handle does not support Query")
	}
	return q.Query(ctx, sql, args...)
}

func normalizeType(s string) string { return strings.Join(strings.Fields(strings.TrimSpace(s)), " ") }
func normalizeSQL(s string) string  { return strings.Join(strings.Fields(strings.TrimSpace(s)), " ") }

func sanitizePublicExpr(expr, sourceSchema string) string {
	if sourceSchema == "" {
		return expr
	}
	// pg_get_* definitions may emit either quoted or bare schema qualification.
	// Normalize both forms when moving a definition from the shadow schema to
	// the live public schema.
	result := strings.ReplaceAll(expr, quoteIdent(sourceSchema)+".", "public.")
	result = strings.ReplaceAll(result, sourceSchema+".", "public.")
	return result
}

func quoteIdent(s string) string   { return `"` + strings.ReplaceAll(s, `"`, `""`) + `"` }
func quoteLiteral(s string) string { return `'` + strings.ReplaceAll(s, `'`, `''`) + `'` }

/**
 * Detects database constraint errors across D1 (Cloudflare) and SQLite (local dev).
 *
 * D1 format: error.message = "D1_ERROR: UNIQUE constraint failed: <table>.<col>: SQLITE_CONSTRAINT"
 *            error.code usually undefined
 * SQLite (better-sqlite3): error.code = "SQLITE_CONSTRAINT_UNIQUE" or starts with "SQLITE_CONSTRAINT"
 */

export function isUniqueConstraintError(
  e: unknown,
  field?: string,
): boolean {
  if (!(e instanceof Error)) return false;

  const code = (e as { code?: string }).code;
  const message = e.message || '';

  const isCodeMatch =
    typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT');
  const isMessageMatch = /UNIQUE constraint failed/i.test(message);

  if (!isCodeMatch && !isMessageMatch) return false;

  if (field) {
    return new RegExp(`UNIQUE constraint failed:.*\\.${field}\\b`, 'i').test(
      message,
    );
  }

  return true;
}

export function isForeignKeyError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;

  const code = (e as { code?: string }).code;
  const message = e.message || '';

  const isCodeMatch =
    typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT_FOREIGNKEY');
  const isMessageMatch = /FOREIGN KEY constraint failed/i.test(message);

  return isCodeMatch || isMessageMatch;
}

export function isNotNullError(e: unknown, field?: string): boolean {
  if (!(e instanceof Error)) return false;

  const code = (e as { code?: string }).code;
  const message = e.message || '';

  const isCodeMatch =
    typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT_NOTNULL');
  const isMessageMatch = /NOT NULL constraint failed/i.test(message);

  if (!isCodeMatch && !isMessageMatch) return false;

  if (field) {
    return new RegExp(`NOT NULL constraint failed:.*\\.${field}\\b`, 'i').test(
      message,
    );
  }

  return true;
}

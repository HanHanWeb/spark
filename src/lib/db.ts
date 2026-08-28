import { createClient } from "@libsql/client";

let client: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;
    if (!url || !token) {
      throw new Error("Turso 未配置：缺少 TURSO_DATABASE_URL 或 TURSO_AUTH_TOKEN");
    }
    client = createClient({ url, authToken: token });
  }
  return client;
}

const DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    current_workspace_id TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id)`,
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_categories_ws ON categories(workspace_id)`,
  `CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_notes_ws ON notes(workspace_id)`,
];

let schemaPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = getDb()
      .batch(DDL, "write")
      .then(async () => {
        // ALTER ADD COLUMN 不可重复执行，逐列探测后再补
        const db = getDb();
        const ensureColumn = async (table: string, column: string, ddl: string) => {
          const cols = await db.execute(`PRAGMA table_info(${table})`);
          if (!cols.rows.some((r) => String(r.name) === column)) {
            await db.execute(ddl);
          }
        };
        await ensureColumn(
          "notes",
          "done",
          "ALTER TABLE notes ADD COLUMN done INTEGER NOT NULL DEFAULT 0"
        );
        await ensureColumn(
          "notes",
          "priority",
          "ALTER TABLE notes ADD COLUMN priority TEXT"
        );
        await ensureColumn(
          "workspaces",
          "view_mode",
          "ALTER TABLE workspaces ADD COLUMN view_mode TEXT"
        );
        await ensureColumn(
          "workspaces",
          "last_type_id",
          "ALTER TABLE workspaces ADD COLUMN last_type_id TEXT"
        );
        await ensureColumn(
          "users",
          "prefs",
          "ALTER TABLE users ADD COLUMN prefs TEXT"
        );
      });
  }
  return schemaPromise;
}

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
        await rebuildCategoriesPk();
      });
  }
  return schemaPromise;
}

/**
 * categories 主键从全局 id 迁移为 (workspace_id, id)：
 * 默认分类 id（todo/idea 等）在多个工作区重复属合法数据，
 * 全局唯一主键会让多工作区用户的推送永远撞 UNIQUE 约束。
 * SQLite 不支持 ALTER 主键，需建新表拷贝后替换。
 */
async function rebuildCategoriesPk(): Promise<void> {
  const db = getDb();
  const cols = await db.execute("PRAGMA table_info(categories)");
  // 复合主键下 workspace_id 与 id 的 pk 序号均 > 0；旧结构仅 id 有 pk=1
  const pkCols = cols.rows.filter((r) => Number(r.pk) > 0);
  const isLegacy = pkCols.length === 1 && String(pkCols[0].name) === "id";
  if (!isLegacy) return;
  await db.batch(
    [
      `CREATE TABLE categories_new (
        id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        PRIMARY KEY (workspace_id, id)
      )`,
      "INSERT INTO categories_new (id, workspace_id, name, icon, color) SELECT id, workspace_id, name, icon, color FROM categories",
      "DROP TABLE categories",
      "ALTER TABLE categories_new RENAME TO categories",
      "CREATE INDEX IF NOT EXISTS idx_categories_ws ON categories(workspace_id)",
    ],
    "write"
  );
}

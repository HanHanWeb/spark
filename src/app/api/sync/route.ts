import { NextResponse } from "next/server";
import { getDb, ensureSchema } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

interface WorkspaceSnapshot {
  categories: {
    id: string;
    name: string;
    icon: string;
    color: string;
  }[];
  notes: {
    id: string;
    categoryId: string;
    content: string;
    createdAt: number;
    done?: boolean;
    priority?: string;
  }[];
}

export interface CloudPrefs {
  beam?: unknown;
}

interface SyncPayload {
  currentWorkspaceId: string | null;
  workspaces: {
    id: string;
    name: string;
    createdAt?: number;
    viewMode?: string;
    lastTypeId?: string | null;
  }[];
  state: Record<string, WorkspaceSnapshot>;
  prefs?: CloudPrefs;
}

const PRIORITIES = new Set(["low", "medium", "high"]);
const VIEW_MODES = new Set(["list", "kanban"]);
/** prefs 为 JSON 文本入库，限制大小防滥用 */
const MAX_PREFS_LENGTH = 8192;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  await ensureSchema();
  const db = getDb();

  const userRes = await db.execute({
    sql: "SELECT current_workspace_id, prefs FROM users WHERE id = ?",
    args: [user.id],
  });
  if (userRes.rows.length === 0) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }
  const currentWorkspaceId =
    userRes.rows[0].current_workspace_id == null
      ? null
      : String(userRes.rows[0].current_workspace_id);
  let prefs: CloudPrefs | null = null;
  if (userRes.rows[0].prefs != null) {
    try {
      prefs = JSON.parse(String(userRes.rows[0].prefs)) as CloudPrefs;
    } catch {}
  }

  const wsRes = await db.execute({
    sql: "SELECT id, name, created_at, view_mode, last_type_id FROM workspaces WHERE user_id = ? ORDER BY created_at",
    args: [user.id],
  });
  const workspaces = wsRes.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    viewMode: r.view_mode == null ? undefined : String(r.view_mode),
    lastTypeId: r.last_type_id == null ? null : String(r.last_type_id),
  }));

  const state: Record<string, WorkspaceSnapshot> = {};
  for (const ws of workspaces) {
    const [catRes, noteRes] = await Promise.all([
      db.execute({
        sql: "SELECT id, name, icon, color FROM categories WHERE workspace_id = ?",
        args: [ws.id],
      }),
      db.execute({
        sql: "SELECT id, category_id, content, created_at, done, priority FROM notes WHERE workspace_id = ? ORDER BY created_at DESC",
        args: [ws.id],
      }),
    ]);
    state[ws.id] = {
      categories: catRes.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        icon: String(r.icon),
        color: String(r.color),
      })),
      notes: noteRes.rows.map((r) => ({
        id: String(r.id),
        categoryId: String(r.category_id),
        content: String(r.content),
        createdAt: Number(r.created_at),
        done: Number(r.done) === 1,
        priority: r.priority == null ? undefined : String(r.priority),
      })),
    };
  }

  return NextResponse.json({ currentWorkspaceId, workspaces, state, prefs });
}

export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: SyncPayload;
  try {
    body = (await req.json()) as SyncPayload;
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  if (
    !Array.isArray(body.workspaces) ||
    typeof body.state !== "object" ||
    body.state === null
  ) {
    return NextResponse.json({ error: "同步数据不完整" }, { status: 400 });
  }

  await ensureSchema();
  const db = getDb();

  // 全量替换该用户的云端数据（个人工具，规模小，简单可靠）
  const stmts: Parameters<typeof db.batch>[0] = [
    {
      sql: "DELETE FROM notes WHERE workspace_id IN (SELECT id FROM workspaces WHERE user_id = ?)",
      args: [user.id],
    },
    {
      sql: "DELETE FROM categories WHERE workspace_id IN (SELECT id FROM workspaces WHERE user_id = ?)",
      args: [user.id],
    },
    { sql: "DELETE FROM workspaces WHERE user_id = ?", args: [user.id] },
  ];

  for (const ws of body.workspaces) {
    if (!ws || typeof ws.id !== "string" || typeof ws.name !== "string") continue;
    const viewMode =
      typeof ws.viewMode === "string" && VIEW_MODES.has(ws.viewMode)
        ? ws.viewMode
        : null;
    const lastTypeId =
      typeof ws.lastTypeId === "string" && ws.lastTypeId.length > 0
        ? ws.lastTypeId
        : null;
    stmts.push({
      sql: "INSERT INTO workspaces (id, user_id, name, created_at, view_mode, last_type_id) VALUES (?, ?, ?, ?, ?, ?)",
      args: [ws.id, user.id, ws.name, ws.createdAt ?? Date.now(), viewMode, lastTypeId],
    });

    const snap = body.state[ws.id];
    if (!snap) continue;

    if (Array.isArray(snap.categories)) {
      for (const c of snap.categories) {
        if (!c || typeof c.id !== "string") continue;
        stmts.push({
          sql: "INSERT INTO categories (id, workspace_id, name, icon, color) VALUES (?, ?, ?, ?, ?)",
          args: [c.id, ws.id, c.name, c.icon, c.color],
        });
      }
    }
    if (Array.isArray(snap.notes)) {
      for (const n of snap.notes) {
        if (!n || typeof n.id !== "string") continue;
        const priority =
          typeof n.priority === "string" && PRIORITIES.has(n.priority)
            ? n.priority
            : null;
        stmts.push({
          sql: "INSERT INTO notes (id, workspace_id, category_id, content, created_at, done, priority) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [
            n.id,
            ws.id,
            n.categoryId,
            n.content,
            n.createdAt,
            n.done ? 1 : 0,
            priority,
          ],
        });
      }
    }
  }

  await db.batch(stmts, "write");

  const prefs =
    body.prefs && typeof body.prefs === "object"
      ? JSON.stringify(body.prefs)
      : null;
  await db.execute({
    sql: "UPDATE users SET current_workspace_id = ?, prefs = ? WHERE id = ?",
    args: [
      typeof body.currentWorkspaceId === "string" ? body.currentWorkspaceId : null,
      prefs != null && prefs.length <= MAX_PREFS_LENGTH ? prefs : null,
      user.id,
    ],
  });

  return NextResponse.json({ ok: true });
}

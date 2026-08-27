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
  }[];
}

interface SyncPayload {
  currentWorkspaceId: string | null;
  workspaces: { id: string; name: string; createdAt?: number }[];
  state: Record<string, WorkspaceSnapshot>;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  await ensureSchema();
  const db = getDb();

  const userRes = await db.execute({
    sql: "SELECT current_workspace_id FROM users WHERE id = ?",
    args: [user.id],
  });
  if (userRes.rows.length === 0) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }
  const currentWorkspaceId =
    userRes.rows[0].current_workspace_id == null
      ? null
      : String(userRes.rows[0].current_workspace_id);

  const wsRes = await db.execute({
    sql: "SELECT id, name, created_at FROM workspaces WHERE user_id = ? ORDER BY created_at",
    args: [user.id],
  });
  const workspaces = wsRes.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
  }));

  const state: Record<string, WorkspaceSnapshot> = {};
  for (const ws of workspaces) {
    const [catRes, noteRes] = await Promise.all([
      db.execute({
        sql: "SELECT id, name, icon, color FROM categories WHERE workspace_id = ?",
        args: [ws.id],
      }),
      db.execute({
        sql: "SELECT id, category_id, content, created_at FROM notes WHERE workspace_id = ? ORDER BY created_at DESC",
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
      })),
    };
  }

  return NextResponse.json({ currentWorkspaceId, workspaces, state });
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
    stmts.push({
      sql: "INSERT INTO workspaces (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
      args: [ws.id, user.id, ws.name, ws.createdAt ?? Date.now()],
    });

    const snap = body.state[ws.id];
    if (!snap) continue;

    if (Array.isArray(snap.categories)) {
      for (const c of snap.categories) {
        stmts.push({
          sql: "INSERT INTO categories (id, workspace_id, name, icon, color) VALUES (?, ?, ?, ?, ?)",
          args: [c.id, ws.id, c.name, c.icon, c.color],
        });
      }
    }
    if (Array.isArray(snap.notes)) {
      for (const n of snap.notes) {
        stmts.push({
          sql: "INSERT INTO notes (id, workspace_id, category_id, content, created_at) VALUES (?, ?, ?, ?, ?)",
          args: [n.id, ws.id, n.categoryId, n.content, n.createdAt],
        });
      }
    }
  }

  await db.batch(stmts, "write");

  await db.execute({
    sql: "UPDATE users SET current_workspace_id = ? WHERE id = ?",
    args: [
      typeof body.currentWorkspaceId === "string" ? body.currentWorkspaceId : null,
      user.id,
    ],
  });

  return NextResponse.json({ ok: true });
}

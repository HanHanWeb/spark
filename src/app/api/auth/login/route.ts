import { NextResponse } from "next/server";
import { getDb, ensureSchema } from "@/lib/db";
import { createSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT id, email, password_hash FROM users WHERE email = ?",
      args: [email],
    });
    const row = result.rows[0];
    if (!row || !verifyPassword(password, String(row.password_hash))) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    const user = { id: String(row.id), email: String(row.email) };
    await createSessionCookie(user);
    return NextResponse.json({ user });
  } catch (e) {
    console.error("login failed", e);
    return NextResponse.json({ error: "登录失败，请稍后重试" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb, ensureSchema } from "@/lib/db";
import { createSessionCookie, hashPassword } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
    }
    if (password.length < 6 || password.length > 64) {
      return NextResponse.json({ error: "密码长度需为 6–64 位" }, { status: 400 });
    }

    await ensureSchema();
    const db = getDb();
    const existing = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }

    const id = randomUUID();
    await db.execute({
      sql: "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
      args: [id, email, hashPassword(password), Date.now()],
    });

    const user = { id, email };
    await createSessionCookie(user);
    return NextResponse.json({ user });
  } catch (e) {
    console.error("register failed", e);
    return NextResponse.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}

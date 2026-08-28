import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getDb } from "@/lib/db";

export interface SessionUser {
  id: string;
  email: string;
}

const COOKIE_NAME = "spark_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("未配置 AUTH_SECRET");
  return new TextEncoder().encode(secret);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function createSessionCookie(user: SessionUser) {
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
    };
  } catch {
    return null;
  }
}

/**
 * 会话签名有效且用户仍存在才放行；「幽灵会话」（用户已被删除或更换数据库）
 * 静默清除 cookie 并视为未登录，避免客户端拿着失效会话反复请求报错。
 */
export async function getSessionUserStrict(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  try {
    const res = await getDb().execute({
      sql: "SELECT id FROM users WHERE id = ?",
      args: [user.id],
    });
    if (res.rows.length === 0) {
      await clearSessionCookie();
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

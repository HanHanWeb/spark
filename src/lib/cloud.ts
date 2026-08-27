import type { Category, Note } from "@/lib/notes";

export interface CloudUser {
  id: string;
  email: string;
}

export interface CloudWorkspaceMeta {
  id: string;
  name: string;
  createdAt?: number;
}

export interface CloudStatePayload {
  currentWorkspaceId: string | null;
  workspaces: CloudWorkspaceMeta[];
  state: Record<
    string,
    {
      categories: Pick<Category, "id" | "name" | "icon" | "color">[];
      notes: Pick<Note, "id" | "categoryId" | "content" | "createdAt">[];
    }
  >;
}

type SyncResponse = CloudStatePayload;

/** 统一包装 fetch：网络层失败（服务未启动/断网）给出友好中文提示 */
async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, { ...init, cache: "no-store" });
  } catch {
    throw new Error("无法连接服务器，请确认服务已启动");
  }
  return jsonOrThrow<T>(res);
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : "网络错误，请稍后重试";
    throw new Error(msg);
  }
  return data as T;
}

export function apiMe(): Promise<{ user: CloudUser | null }> {
  return request<{ user: CloudUser | null }>("/api/auth/me");
}

export function apiRegister(
  email: string,
  password: string
): Promise<{ user: CloudUser }> {
  return request<{ user: CloudUser }>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function apiLogin(
  email: string,
  password: string
): Promise<{ user: CloudUser }> {
  return request<{ user: CloudUser }>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function apiLogout(): Promise<void> {
  return fetch("/api/auth/logout", { method: "POST" }).then(() => undefined);
}

export function apiPull(): Promise<SyncResponse> {
  return request<SyncResponse>("/api/sync");
}

export function apiPush(payload: CloudStatePayload): Promise<void> {
  return request<{ ok: boolean }>("/api/sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(() => undefined);
}

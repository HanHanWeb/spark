"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  apiLogin,
  apiLogout,
  apiMe,
  apiPull,
  apiPush,
  apiRegister,
  type CloudStatePayload,
  type CloudUser,
} from "@/lib/cloud";
import type { Category, LegacyLocalData, Note } from "@/lib/notes";

export type CloudStatus = "idle" | "syncing" | "ok" | "error";

interface UseCloudSyncOptions {
  buildPayload: () => CloudStatePayload;
  applyRemote: (
    payload: CloudStatePayload,
    preferredCurrentId?: string | null
  ) => void;
  /** 每当登录态确定或变化（会话恢复/登录/注册/退出）时回调，参数为最新用户 */
  onAuthResolved?: (user: CloudUser | null) => void;
  /** 一次性读取旧版 localStorage 数据（无则返回 null），首次对账时并入云端 */
  readLegacy?: () => LegacyLocalData | null;
  /** 旧本地数据成功上传云端后清理本地残留 */
  clearLegacy?: () => void;
}

/**
 * 合并云端与旧本地数据：工作区与条目按 id 取并集，同 id 冲突以云端为准
 * （本地可能是任意一台设备的过期快照，没有可信的新旧关系）。
 * 只在迁移旧 localStorage 时执行一次；日常多端一致靠"先推后拉"。
 */
function mergeWithLegacy(
  remote: CloudStatePayload,
  local: LegacyLocalData
): CloudStatePayload {
  const localWsById = new Map(local.workspaces.map((w) => [w.id, w]));
  const remoteIds = new Set(remote.workspaces.map((w) => w.id));

  const workspaces: CloudStatePayload["workspaces"] = remote.workspaces.map(
    (w) => {
      const l = localWsById.get(w.id);
      return {
        ...w,
        viewMode: w.viewMode ?? l?.viewMode,
        lastTypeId: w.lastTypeId ?? l?.lastTypeId ?? null,
      };
    }
  );
  for (const l of local.workspaces) {
    if (!remoteIds.has(l.id)) {
      workspaces.push({
        id: l.id,
        name: l.name,
        createdAt: l.createdAt,
        viewMode: l.viewMode,
        lastTypeId: l.lastTypeId ?? null,
      });
    }
  }

  const state: CloudStatePayload["state"] = {};
  for (const ws of workspaces) {
    const rs = remote.state[ws.id];
    const ls = local.state[ws.id];
    const cats = new Map<string, Category>();
    for (const c of ls?.categories ?? []) cats.set(c.id, c);
    for (const c of rs?.categories ?? []) cats.set(c.id, c);
    const noteMap = new Map<string, Note>();
    for (const n of ls?.notes ?? []) noteMap.set(n.id, n);
    for (const n of rs?.notes ?? []) noteMap.set(n.id, n);
    state[ws.id] = {
      categories: [...cats.values()],
      notes: [...noteMap.values()],
    };
  }

  return {
    // 云端已有工作区时以云端指针为准；全新账号则沿用本地指针
    currentWorkspaceId:
      remote.workspaces.length > 0
        ? remote.currentWorkspaceId
        : local.currentWorkspaceId,
    workspaces,
    state,
    prefs: { beam: remote.prefs?.beam ?? local.beam },
  };
}

/* SSR 环境降级为 useEffect，避免 useLayoutEffect 警告 */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function useCloudSync({
  buildPayload,
  applyRemote,
  onAuthResolved,
  readLegacy,
  clearLegacy,
}: UseCloudSyncOptions) {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [status, setStatus] = useState<CloudStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  /** 完成首次对账（拉取云端）前禁止自动推送，防止空数据覆盖云端 */
  const [baselineReady, setBaselineReady] = useState(false);

  const buildRef = useRef(buildPayload);
  const authCallbackRef = useRef(onAuthResolved);
  const readLegacyRef = useRef(readLegacy);
  const clearLegacyRef = useRef(clearLegacy);
  /* commit 阶段同步刷新最新回调，保证防抖/微任务里的推送拿到最新数据 */
  useIsoLayoutEffect(() => {
    buildRef.current = buildPayload;
    authCallbackRef.current = onAuthResolved;
    readLegacyRef.current = readLegacy;
    clearLegacyRef.current = clearLegacy;
  });

  /** 登录态变更唯一入口：state 与 onAuthResolved 必须同步更新 */
  function updateUser(next: CloudUser | null) {
    setUser(next);
    authCallbackRef.current?.(next);
  }

  const suppressRef = useRef(false);
  const pendingDuringSuppressRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPullAtRef = useRef(0);
  const baselineRunningRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    apiMe()
      .then((d) => {
        if (!cancelled) updateUser(d.user);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 应用远端数据，同时短暂抑制自动推送回环 */
  function applyRemoteInternal(
    payload: CloudStatePayload,
    preferredCurrentId?: string | null
  ) {
    suppressRef.current = true;
    applyRemote(payload, preferredCurrentId);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      suppressRef.current = false;
      if (pendingDuringSuppressRef.current) {
        pendingDuringSuppressRef.current = false;
        schedulePush();
      }
    }, 600);
  }
  const applyRemoteRef = useRef(applyRemoteInternal);
  const establishBaselineRef = useRef(establishBaseline);
  useIsoLayoutEffect(() => {
    applyRemoteRef.current = applyRemoteInternal;
    establishBaselineRef.current = establishBaseline;
  });

  async function pushNow(): Promise<boolean> {
    if (!user) return false;
    setStatus("syncing");
    try {
      await apiPush(buildRef.current());
      setLastSyncedAt(Date.now());
      setStatus("ok");
      window.setTimeout(() => setStatus("idle"), 1500);
      return true;
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2500);
      return false;
    }
  }

  function schedulePush() {
    if (!user || !baselineReady) return;
    if (suppressRef.current) {
      pendingDuringSuppressRef.current = true;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void pushNow();
    }, 1200);
  }

  async function establishBaseline(): Promise<void> {
    if (baselineRunningRef.current) return;
    baselineRunningRef.current = true;
    try {
      // 云端是唯一数据源：登录/启动一律先拉取，旧本地数据只做一次性并集迁移。
      // 拉取失败保持 baselineReady=false（推送持续被门控），由重试与聚焦刷新兜底。
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const remote = await apiPull();
          const local = readLegacyRef.current?.() ?? null;
          applyRemoteInternal(local ? mergeWithLegacy(remote, local) : remote);
          if (local) {
            const ok = await pushNow();
            // 推送成功才清理旧数据；失败则保留，等下次对账再迁移
            if (ok) clearLegacyRef.current?.();
          }
          setBaselineReady(true);
          // 对账期间产生的本地变更（如引导中新建的工作区）在此立即补推
          schedulePush();
          return;
        } catch {
          setStatus("error");
          await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        }
      }
    } finally {
      baselineRunningRef.current = false;
    }
  }

  /* 对账失败后的自动重试 */
  useEffect(() => {
    if (!user || baselineReady) return;
    const t = setTimeout(() => void establishBaselineRef.current(), 5000);
    return () => clearTimeout(t);
  }, [user, baselineReady]);

  /* 窗口重新可见/聚焦时刷新：先把本地变更推上去，再拉云端合并，30s 节流 */
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastPullAtRef.current < 30_000) return;
      lastPullAtRef.current = Date.now();
      if (!baselineReady) {
        await establishBaselineRef.current();
        return;
      }
      await pushNow();
      try {
        const remote = await apiPull();
        if (alive) applyRemoteRef.current(remote);
      } catch {
        // 拉取失败时保留现有状态即可
      }
    };
    const onEvent = () => {
      void refresh();
    };
    document.addEventListener("visibilitychange", onEvent);
    window.addEventListener("focus", onEvent);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onEvent);
      window.removeEventListener("focus", onEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pushNow 闭包与 user 依赖同步更新
  }, [user, baselineReady]);

  async function login(email: string, password: string) {
    const d = await apiLogin(email, password);
    updateUser(d.user);
  }

  async function register(email: string, password: string) {
    const d = await apiRegister(email, password);
    updateUser(d.user);
  }

  async function logout() {
    await apiLogout();
    updateUser(null);
    setBaselineReady(false);
    setLastSyncedAt(null);
    lastPullAtRef.current = 0;
  }

  return {
    user,
    authReady,
    status,
    lastSyncedAt,
    baselineReady,
    login,
    register,
    logout,
    establishBaseline,
    applyRemote: applyRemoteInternal,
    schedulePush,
    pushNow,
  };
}

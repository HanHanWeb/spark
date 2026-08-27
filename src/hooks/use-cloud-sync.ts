"use client";

import { useEffect, useRef, useState } from "react";
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

export type CloudStatus = "idle" | "syncing" | "ok" | "error";

/** 本地曾与云端绑定过数据的哨兵键（防误判全新设备导致云端数据复活本地已删内容） */
const EVER_DATA_KEY = "spark.v2.everData";

function hasEverData(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(EVER_DATA_KEY) === "1";
  } catch {
    return false;
  }
}

function markEverData() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EVER_DATA_KEY, "1");
  } catch {}
}

interface UseCloudSyncOptions {
  buildPayload: () => CloudStatePayload;
  applyRemote: (
    payload: CloudStatePayload,
    preferredCurrentId?: string | null
  ) => void;
  /** 每当登录态确定或变化（会话恢复/登录/注册/退出）时回调，参数为最新用户 */
  onAuthResolved?: (user: CloudUser | null) => void;
}

export function useCloudSync({
  buildPayload,
  applyRemote,
  onAuthResolved,
}: UseCloudSyncOptions) {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [status, setStatus] = useState<CloudStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  /** 完成首次对账（拉取或上传）前禁止自动推送，防止空数据覆盖云端 */
  const [baselineReady, setBaselineReady] = useState(false);

  const buildRef = useRef(buildPayload);
  buildRef.current = buildPayload;
  const authCallbackRef = useRef(onAuthResolved);
  authCallbackRef.current = onAuthResolved;

  /** 统一的用户状态变更入口，保证回调与状态同步发生 */
  function updateUser(next: CloudUser | null) {
    setUser(next);
    authCallbackRef.current?.(next);
  }

  const suppressRef = useRef(false);
  const pendingDuringSuppressRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* 恢复会话 */
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

  async function pushNow(): Promise<boolean> {
    if (!user) return false;
    setStatus("syncing");
    try {
      await apiPush(buildRef.current());
      markEverData();
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
    try {
      const localPayload = buildRef.current();
      // 本地「曾经有过数据」的哨兵：即便用户删光了所有工作区，
      // 也不能把本次会话误判为全新设备而用云端复活旧数据
      const everData = hasEverData() || localPayload.workspaces.length > 0;

      if (everData) {
        // 本地为准：先上传本地全部状态，云端随之完全一致。
        // 这样删除操作即使没赶上上次的防抖推送，也会在启动对账时被真正上传。
        await pushNow();
      } else {
        // 全新环境（本地从未有过数据）：以云端为初始数据
        const remote = await apiPull();
        if (remote.workspaces.length > 0) {
          applyRemoteInternal(remote);
        }
        markEverData(); // 已与云端建立绑定
      }
    } catch {
      setStatus("error");
    } finally {
      setBaselineReady(true);
    }
  }

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

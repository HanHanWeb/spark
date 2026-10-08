"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  KanbanIcon,
  LayoutListIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  createId,
  nowMs,
  clearLegacyLocalData,
  readLegacyLocalData,
  normalizeBeam,
  normalizeCategories,
  normalizeNotes,
  DEFAULT_BEAM,
  DEFAULT_CATEGORIES,
  normalizePriority,
  type BeamSettings,
  type Category,
  type Note,
  type Priority,
  type ViewMode,
  type Workspace,
} from "@/lib/notes";
import { NoteKanban } from "@/components/spark/note-kanban";import { PriorityChip } from "@/components/spark/priority-chip";
import { PrioritySwitcher } from "@/components/spark/priority-switcher";
import { BorderBeam } from "border-beam";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/spark/category-chip";
import { CategorySwitcher } from "@/components/spark/category-switcher";
import { PageLoader } from "@/components/spark/loaders";
import { NoteDeleteConfirm } from "@/components/spark/note-delete-confirm";
import { WorkspaceOnboarding } from "@/components/spark/workspace-onboarding";
import { WorkspaceSwitcher } from "@/components/spark/workspace-switcher";
import {
  SettingsDialog,
  type SettingsSection,
} from "@/components/spark/settings-dialog";
import { WelcomeStepper } from "@/components/spark/welcome-stepper";
import { UserMenu } from "@/components/spark/user-menu";
import { useCloudSync } from "@/hooks/use-cloud-sync";
import { apiPull, type CloudStatePayload, type CloudUser } from "@/lib/cloud";
import { cn } from "@/lib/utils";
import Image from "next/image";

const ALL = "all";

/** 单个工作区的会话内数据快照；视图偏好随同步通道上云 */
interface WsData {
  categories: Category[];
  notes: Note[];
  viewMode?: ViewMode;
  lastTypeId?: string | null;
}

export function SparkApp() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [typeId, setTypeId] = useState<string>("");
  /** 已完成装载的工作区 id；装载完成前不写缓存、不触发推送 */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [tab, setTab] = useState<string>(ALL);
  const [tabDirection, setTabDirection] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [beam, setBeam] = useState<BeamSettings>({ ...DEFAULT_BEAM });

  /** 全部工作区的数据缓存（云端为数据源，此处仅是会话内镜像） */
  const wsDataRef = useRef<Record<string, WsData>>({});
  /** 各工作区条数统计的 state 镜像（渲染期不可读 ref，统计走 state） */
  const [wsCounts, setWsCounts] = useState<
    Record<string, { noteCount: number; categoryCount: number }>
  >({});

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] =
    useState<SettingsSection>("account");
  const [settingsCreate, setSettingsCreate] = useState(false);

  /**
   * 首次使用引导状态。pending 等待鉴权结果；done 放行进入主界面。
   * 由 use-cloud-sync 的 onAuthResolved 在登录态变化时机驱动：
   * 退出登录会从 done 回到 active 强制重新引导。
   */
  const [setupFlow, setSetupFlow] = useState<
    "pending" | "active" | "done"
  >("pending");

  function handleAuthResolved(user: CloudUser | null) {
    setSetupFlow((f) => {
      // 首次判定决定放行与否；此后登录不中断进行中的引导，退出重新触发
      if (f === "pending") return user ? "done" : "active";
      return user ? f : "active";
    });
  }

  function openSettings(section: SettingsSection = "account", create = false) {
    setSettingsSection(section);
    setSettingsCreate(create);
    setSettingsOpen(true);
  }

  // establishBaseline 只允许执行一次，否则会造成推拉循环
  const baselineStartedRef = useRef(false);
  /** 工作区切换请求序号；用于丢弃快速切换时乱序返回的云端拉取结果 */
  const switchSeqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function stashCounts(id: string, d: WsData | undefined) {
    setWsCounts((prev) => ({
      ...prev,
      [id]: {
        noteCount: d?.notes.length ?? 0,
        categoryCount: d?.categories.length ?? 0,
      },
    }));
  }

  /** 当前工作区数据写回会话缓存；必须与 setState 同步调用，保证推送拿到最新值 */
  function stashCurrent(patch: Partial<WsData>) {
    if (!currentId) return;
    const d = wsDataRef.current[currentId] ?? {
      categories: [],
      notes: [],
      lastTypeId: null,
    };
    const merged = { ...d, ...patch };
    wsDataRef.current[currentId] = merged;
    stashCounts(currentId, merged);
  }

  function buildPayload(): CloudStatePayload {
    const state: CloudStatePayload["state"] = {};
    const workspacesMeta: CloudStatePayload["workspaces"] = workspaces.map(
      (w) => {
        const isCurrent = w.id === currentId;
        const d = isCurrent
          ? { categories, notes, viewMode, lastTypeId: typeId || null }
          : (wsDataRef.current[w.id] ?? {
              categories: [],
              notes: [],
              lastTypeId: null,
            });
        state[w.id] = { categories: d.categories, notes: d.notes };
        return {
          id: w.id,
          name: w.name,
          createdAt: w.createdAt,
          viewMode: d.viewMode,
          lastTypeId: d.lastTypeId,
        };
      }
    );
    return {
      currentWorkspaceId: currentId,
      workspaces: workspacesMeta,
      state,
      prefs: { beam },
    };
  }

  function applyRemote(
    payload: CloudStatePayload,
    preferredCurrentId?: string | null
  ) {
    // 远端为主合并列表；仅本地存在的工作区保留不删，防止推送防抖期内被拉取抹掉
    const remoteList = payload.workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      createdAt: w.createdAt ?? nowMs(),
    }));
    const remoteIds = new Set(remoteList.map((w) => w.id));
    const localOnly = workspaces.filter((w) => !remoteIds.has(w.id));
    const merged = [...remoteList, ...localOnly];
    setWorkspaces(merged);

    // 远端快照整体替换缓存；本地独有工作区沿用原数据
    const nextData: Record<string, WsData> = {};
    for (const w of merged) {
      const snap = payload.state[w.id];
      if (snap) {
        const meta = payload.workspaces.find((m) => m.id === w.id);
        nextData[w.id] = {
          categories: normalizeCategories(snap.categories),
          notes: normalizeNotes(snap.notes),
          viewMode: meta?.viewMode,
          lastTypeId: meta?.lastTypeId ?? null,
        };
      } else {
        nextData[w.id] =
          wsDataRef.current[w.id] ?? { categories: [], notes: [], lastTypeId: null };
      }
    }
    wsDataRef.current = nextData;
    for (const w of merged) stashCounts(w.id, nextData[w.id]);

    const remoteBeam = payload.prefs?.beam;
    if (remoteBeam) setBeam(normalizeBeam(remoteBeam));

    const fallbackTarget = merged[0]?.id ?? null;
    let target =
      preferredCurrentId !== undefined
        ? preferredCurrentId
        : (payload.currentWorkspaceId ?? fallbackTarget);
    if (target && !merged.some((w) => w.id === target)) {
      target = fallbackTarget;
    }
    if (target !== currentId) {
      // 目标工作区变化：交给 currentId 加载 effect 从缓存装载（含视图偏好）
      setCurrentId(target || null);
      if (!target) {
        // 云端工作区已被全部删除：清空当前数据，回到工作区引导页
        setCategories([]);
        setNotes([]);
        setLoadedFor(null);
      }
    } else if (target) {
      // 同工作区刷新：仅合并数据，保留用户正在看的分类、搜索与视图状态
      const d = nextData[target];
      setCategories(d.categories);
      setNotes([...d.notes].sort((a, b) => b.createdAt - a.createdAt));
    }
  }

  const cloud = useCloudSync({
    buildPayload,
    applyRemote,
    onAuthResolved: handleAuthResolved,
    readLegacy: readLegacyLocalData,
    clearLegacy: clearLegacyLocalData,
  });

  useEffect(() => {
    if (!cloud.authReady || !cloud.user || !booted) return;
    if (baselineStartedRef.current) return;
    baselineStartedRef.current = true;
    queueMicrotask(() => {
      void cloud.establishBaseline();
    });
  }, [cloud.authReady, cloud.user, booted, cloud]);

  useEffect(() => {
    if (!cloud.user || !cloud.baselineReady) return;
    if (!currentId || loadedFor !== currentId) return;
    cloud.schedulePush();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 手动推送即全部依赖
  }, [notes, categories, workspaces, beam, currentId]);

  useEffect(() => {
    queueMicrotask(() => {
      setBooted(true);
    });
  }, []);

  /* 切换工作区：从会话缓存装载目标工作区数据 */
  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const d = wsDataRef.current[currentId] ?? {
        categories: [],
        notes: [],
        lastTypeId: null,
      };
      const cats = d.categories;
      const last = d.lastTypeId;
      setCategories(cats);
      setNotes([...d.notes].sort((a, b) => b.createdAt - a.createdAt));
      setTypeId(last && cats.some((c) => c.id === last) ? last : (cats[0]?.id ?? ""));
      setViewMode(d.viewMode === "kanban" ? "kanban" : "list");
      setTab(ALL);
      setContent("");
      setLoadedFor(currentId);
    });
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  /* state 变化后的兜底写回，保证会话缓存与渲染数据一致 */
  useEffect(() => {
    if (currentId && loadedFor === currentId)
      stashCurrent({ categories, notes });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 手动推送即全部依赖
  }, [categories, notes, currentId, loadedFor]);

  /* 偏好同步：上次选中分类 / 视图模式，随推送通道上云 */
  useEffect(() => {
    if (currentId && loadedFor === currentId && typeId) {
      const d = wsDataRef.current[currentId];
      if (d && d.lastTypeId !== typeId) {
        d.lastTypeId = typeId;
        cloud.schedulePush();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 手动推送即全部依赖
  }, [typeId, currentId, loadedFor]);

  useEffect(() => {
    if (currentId && loadedFor === currentId) {
      const d = wsDataRef.current[currentId];
      if (d && d.viewMode !== viewMode) {
        d.viewMode = viewMode;
        cloud.schedulePush();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 手动推送即全部依赖
  }, [viewMode, currentId, loadedFor]);

  const handleBeamChange = useCallback((patch: Partial<BeamSettings>) => {
    setBeam((prev) => ({ ...prev, ...patch }));
  }, []);

  const currentCategory =
    categories.find((c) => c.id === typeId) ?? categories[0];

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notes)
      map.set(n.categoryId, (map.get(n.categoryId) ?? 0) + 1);
    return map;
  }, [notes]);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => Number(!!a.done) - Number(!!b.done)),
    [notes]
  );

  const visibleNotes = useMemo(
    () => (tab === ALL ? sortedNotes : sortedNotes.filter((n) => n.categoryId === tab)),
    [sortedNotes, tab]
  );

  const tabOrder = useMemo(() => [ALL, ...categories.map((c) => c.id)], [categories]);

  const handleTabChange = useCallback(
    (next: string) => {
      if (next === tab) return;
      const prevIdx = tabOrder.indexOf(tab);
      const nextIdx = tabOrder.indexOf(next);
      // 未知分类（如刚删除）按右侧切入
      const dir = nextIdx > prevIdx ? 1 : nextIdx < prevIdx ? -1 : 1;
      setTabDirection(dir);
      setTab(next);
    },
    [tab, tabOrder]
  );

  const countsRecord = useMemo(
    () => Object.fromEntries(counts) as Record<string, number>,
    [counts]
  );

  const workspaceStats = useMemo(() => {
    const stats: Record<string, { noteCount: number; categoryCount: number }> = {};
    for (const ws of workspaces) {
      if (ws.id === currentId) {
        stats[ws.id] = { noteCount: notes.length, categoryCount: categories.length };
      } else {
        stats[ws.id] = wsCounts[ws.id] ?? { noteCount: 0, categoryCount: 0 };
      }
    }
    return stats;
  }, [workspaces, currentId, notes.length, categories.length, wsCounts]);

  function enterWorkspace(id: string) {
    setLoadedFor(null);
    setCategories([]);
    setNotes([]);
    setTab(ALL);
    setContent("");
    setCurrentId(id);
  }

  function handleSelectWorkspace(id: string) {
    if (!id || id === currentId) return;
    enterWorkspace(id);
    if (cloud.user && cloud.baselineReady) {
      const seq = ++switchSeqRef.current;
      void (async () => {
        // 先推后拉：把本地未同步的变更（含新建工作区）送上去后，再拉云端覆盖本地
        await cloud.pushNow(); // 失败已在 hook 内部处理，可继续拉取
        try {
          const r = await apiPull();
          if (seq === switchSeqRef.current) cloud.applyRemote(r, id);
        } catch {
          // 拉取失败时保留现有本地状态即可
        }
      })();
    }
  }

  function handleCreateWorkspace(rawName: string) {
    const name = rawName.trim().slice(0, 16) || "未命名工作区";
    const ws: Workspace = { id: createId(), name, createdAt: nowMs() };
    const next = [...workspaces, ws];
    // 预写新工作区快照，保证立即推送时云端拿到一致数据
    wsDataRef.current[ws.id] = {
      categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      notes: [],
      lastTypeId: null,
    };
    setWorkspaces(next);
    enterWorkspace(ws.id);
    pushSoon();
    window.setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleRenameWorkspace(id: string, rawName: string) {
    const name = rawName.trim().slice(0, 16);
    if (!name) return;
    const next = workspaces.map((w) => (w.id === id ? { ...w, name } : w));
    setWorkspaces(next);
    toast.success("已重命名工作区");
    pushSoon();
  }

  function handleDeleteWorkspace(id: string) {
    const isCurrent = id === currentId;
    const next = workspaces.filter((w) => w.id !== id);
    delete wsDataRef.current[id];
    if (isCurrent) {
      if (next.length > 0) {
        const fallback = next[0].id;
        setWorkspaces(next);
        setCurrentId(fallback);
        setLoadedFor(null);
        toast.success("已删除工作区");
      } else {
        setWorkspaces([]);
        setCurrentId(null);
        setCategories([]);
        setNotes([]);
        setLoadedFor(null);
        // 回到引导页后无需保留面板
        setSettingsOpen(false);
        toast.success("已删除工作区");
      }
    } else {
      setWorkspaces(next);
      toast.success("已删除工作区");
    }
    pushSoon();
  }

  /** 关键变更跳过防抖立即推送 */
  function pushSoon() {
    if (!cloud.user || !cloud.baselineReady) return;
    queueMicrotask(() => {
      void cloud.pushNow();
    });
  }

  function handleDeleteCategory(id: string) {
    const rest = categories.filter((c) => c.id !== id);
    const nextNotes = notes.filter((n) => n.categoryId !== id);
    stashCurrent({ categories: rest, notes: nextNotes });
    setNotes(nextNotes);
    setCategories(rest);
    if (typeId === id) setTypeId(rest[0]?.id ?? "");
    if (tab === id) setTab(ALL);
    pushSoon();
  }

  function handleCreateCategory(category: Category) {
    const nextCats = [...categories, category];
    stashCurrent({ categories: nextCats });
    setCategories(nextCats);
    setTypeId(category.id);
    pushSoon();
    inputRef.current?.focus();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = content.trim();
    if (!text || !currentCategory || !currentId) return;
    const note: Note = {
      id: createId(),
      categoryId: currentCategory.id,
      content: text,
      createdAt: nowMs(),
      priority: normalizePriority(priority),
    };
    const nextNotes = [note, ...notes];
    stashCurrent({ notes: nextNotes });
    setNotes(nextNotes);
    setContent("");
    setTab(currentCategory.id);
    pushSoon();
    toast.success("添加成功", { duration: 2000 });
  }

  function handleDelete(id: string) {
    const nextNotes = notes.filter((n) => n.id !== id);
    stashCurrent({ notes: nextNotes });
    setNotes(nextNotes);
    pushSoon();
  }

  function handleToggleDone(noteId: string) {
    setNotes((prev) => {
      const next = prev.map((n) =>
        n.id === noteId ? { ...n, done: !n.done } : n
      );
      stashCurrent({ notes: next });
      return next;
    });
    pushSoon();
  }

  function handleChangePriority(noteId: string, p: Priority) {
    setNotes((prev) => {
      const next = prev.map((n) =>
        n.id === noteId ? { ...n, priority: normalizePriority(p) } : n
      );
      stashCurrent({ notes: next });
      return next;
    });
    pushSoon();
  }

  const handleKanbanNotesChange = useCallback(
    (nextNotes: Note[]) => {
      stashCurrent({ notes: nextNotes });
      setNotes(nextNotes);
      pushSoon();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentId]
  );

  /** 手动同步：先推本地变更再拉云端合并，两端立刻对齐 */
  async function handleManualSync() {
    if (!cloud.user) return;
    const ok = await cloud.pushNow();
    if (!ok) {
      toast.error("同步失败，请稍后重试");
      return;
    }
    try {
      const remote = await apiPull();
      cloud.applyRemote(remote);
      toast.success("已同步");
    } catch {
      toast.success("已上传本地变更");
    }
  }

  function handleLogout() {
    void cloud.logout().then(() => {
      baselineStartedRef.current = false;
      // 清空会话内数据，避免残留状态串到下一个登录的账号
      wsDataRef.current = {};
      setWorkspaces([]);
      setCurrentId(null);
      setCategories([]);
      setNotes([]);
      setLoadedFor(null);
      setViewMode("list");
      setBeam({ ...DEFAULT_BEAM });
      toast.success("已退出登录");
    });
  }

// 渲染优先级：加载中 → 强制引导 → 无工作区 → 主界面
  if (!booted || setupFlow === "pending") {
    return <PageLoader />;
  }

  if (setupFlow === "active") {
    return (
      <WelcomeStepper
        user={cloud.user}
        onLogin={cloud.login}
        onRegister={cloud.register}
        workspaces={workspaces}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        currentWorkspaceId={currentId}
        currentWorkspaceName={
          workspaces.find((w) => w.id === currentId)?.name ?? null
        }
        onComplete={() => setSetupFlow("done")}
      />
    );
  }

  if (!currentId) {
    // 云端对账未完成前数据尚不可知，显示加载态而非「创建工作区」引导，避免闪现
    if (!cloud.baselineReady) return <PageLoader />;
    return (
      <WorkspaceOnboarding
        workspaces={workspaces}
        onSelect={handleSelectWorkspace}
        onCreate={handleCreateWorkspace}
      />
    );
  }

  return (
    <>
      <div className="fixed right-4 top-4 z-50 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="控制面板"
          title="控制面板"
          className="shrink-0 rounded-full bg-card/80 shadow-sm backdrop-blur"
          onClick={() => openSettings()}
        >
          <Settings2Icon className="size-4" />
        </Button>
        <UserMenu
          user={cloud.user}
          status={cloud.status}
          lastSyncedAt={cloud.lastSyncedAt}
          onLoginClick={() => openSettings("account")}
          onManualSync={handleManualSync}
          onLogout={handleLogout}
          onSettingsClick={() => openSettings()}
        />
        <WorkspaceSwitcher
          workspaces={workspaces}
          currentId={currentId}
          onSelect={handleSelectWorkspace}
          onCreateClick={() => openSettings("workspaces", true)}
          onManage={() => openSettings("workspaces")}
        />
      </div>

      <main
        className={cn(
          "mx-auto flex w-full flex-1 flex-col px-4 pb-16",
          viewMode === "kanban" ? "max-w-6xl" : "max-w-2xl"
        )}
      >
        <header className="flex flex-col items-center pt-16 pb-10 text-center">
          <Image
            src="/favicon.svg"
            alt="Spark logo"
            width={64}
            height={64}
            priority
            className="size-16 drop-shadow-lg"
          />
          <h1 className="mt-5 bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
            Spark
          </h1>
        </header>

        <form onSubmit={handleSubmit}>
          {(() => {
            const searchInput = (
              <InputGroup className="h-11 rounded-full border-input bg-card shadow-sm has-[[data-slot=input-group-control]:focus-visible]:rounded-full has-[[data-slot=input-group-control]:focus-visible]:!border-input has-[[data-slot=input-group-control]:focus-visible]:!ring-0 has-[[data-slot=input-group-control]:focus-visible]:!ring-offset-0 focus-within:!border-input focus-within:!ring-0">
                {/* 清零 addon 基类的负外边距；四壁内衬统一由这里的 p-1.5 提供 */}
                <InputGroupAddon align="inline-start" className="p-1.5 pl-2.5 has-[>button]:ml-0">
                  <CategorySwitcher
                    embedded
                    categories={categories}
                    counts={countsRecord}
                    currentId={currentCategory?.id}
                    onSelect={setTypeId}
                    onNew={() => openSettings("categories", true)}
                    onManage={() => openSettings("categories")}
                  />
                  <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
                  <PrioritySwitcher embedded value={priority} onSelect={setPriority} />
                  <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  ref={inputRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={
                    currentCategory
                      ? `记一条「${currentCategory.name}」，回车保存…`
                      : "记录此刻的想法…"
                  }
                  maxLength={500}
                  autoFocus
                  className="focus-visible:ring-0 focus-visible:outline-none"
                />
              </InputGroup>
            );
            return beam.enabled ? (
              <BorderBeam
                colorVariant={beam.variant}
                duration={beam.duration}
                size="md"
                borderRadius={22}
                theme="auto"
                className="rounded-full"
              >
                {searchInput}
              </BorderBeam>
            ) : (
              searchInput
            );
          })()}
        </form>

        {/* 视图切换：列表 / 看板 */}
        <div className="mt-6 flex items-center justify-between gap-3">
          {viewMode === "list" ? (
            <Tabs value={tab} onValueChange={handleTabChange} className="min-w-0 flex-1">
              <TabsList className="no-scrollbar h-9! w-full justify-start overflow-x-auto rounded-full p-1">
                <TabsTrigger value={ALL} className="shrink-0 rounded-full">
                  全部
                </TabsTrigger>
                {categories.map((c) => (
                  <TabsTrigger key={c.id} value={c.id} className="shrink-0 rounded-full">
                    {c.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <p className="hidden sm:block truncate text-sm text-muted-foreground">
              看板按分类分列，拖拽可改分类与排序
            </p>
          )}
          <div className="flex shrink-0 items-center gap-1 rounded-full border bg-muted p-1">
            <Button
              variant="ghost"
              size="xs"
              aria-pressed={viewMode === "list"}
              data-active={viewMode === "list"}
              onClick={() => setViewMode("list")}
              className={cn(
                "h-7 rounded-full px-3 transition-colors",
                viewMode === "list"
                  ? "bg-background shadow-sm text-foreground hover:bg-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutListIcon className="size-3.5" />
              列表
            </Button>
            <Button
              variant="ghost"
              size="xs"
              aria-pressed={viewMode === "kanban"}
              data-active={viewMode === "kanban"}
              onClick={() => setViewMode("kanban")}
              className={cn(
                "h-7 rounded-full px-3 transition-colors",
                viewMode === "kanban"
                  ? "bg-background shadow-sm text-foreground hover:bg-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <KanbanIcon className="size-3.5" />
              看板
            </Button>
          </div>
        </div>

        {viewMode === "list" ? (
          <div
            key={tab}
            className={cn(
              "mt-4 animate-in fade-in duration-300 ease-out will-change-transform",
              tabDirection > 0 ? "slide-in-from-right-3" : "slide-in-from-left-3"
            )}
          >
            {visibleNotes.length === 0 ? (
              <div className="rounded-xl border py-14 text-center text-sm text-muted-foreground">
                还没有内容
              </div>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
              {visibleNotes.map((note) => {
                const cat = categoryMap.get(note.categoryId);
                if (!cat) return null;
                const done = note.done === true;
                const curPriority = (note.priority ?? "medium") as Priority;
                const nextPriority: Priority =
                  curPriority === "low" ? "medium" : curPriority === "medium" ? "high" : "low";
                return (
                  <li
                    key={note.id}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2.5 transition-opacity",
                      done && "opacity-55"
                    )}
                  >
                    <div className="flex items-center gap-1.5 shrink-0 self-center">
                      <CategoryChip category={cat} className="h-5 py-0" />
                      <button
                        type="button"
                        aria-label={`优先级：${curPriority}，点击切换`}
                        title="点击切换优先级：低 → 中 → 高"
                        onClick={() => handleChangePriority(note.id, nextPriority)}
                        className="inline-flex items-center outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-full"
                      >
                        <PriorityChip priority={curPriority} className="h-5 py-0" />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "min-w-0 text-sm leading-relaxed break-words whitespace-pre-wrap",
                          done && "line-through decoration-muted-foreground/60"
                        )}
                      >
                        {note.content}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={done ? "标记为未完成" : "标记为已完成"}
                        title={done ? "标记为未完成" : "标记为已完成"}
                        onClick={() => handleToggleDone(note.id)}
                        className={cn(
                          "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
                          done
                            ? "text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <CheckIcon />
                      </Button>
                      <NoteDeleteConfirm
                        onDelete={() => handleDelete(note.id)}
                      >
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="删除这条便签"
                          className="-mr-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-destructive"
                        >
                          <XIcon />
                        </Button>
                      </NoteDeleteConfirm>
                    </div>
                  </li>
                );
              })}
            </ul>
            )}
          </div>
        ) : notes.length === 0 ? (
          <div className="mt-4 rounded-xl border py-14 text-center text-sm text-muted-foreground">
            还没有内容
          </div>
        ) : sortedNotes.length === 0 ? (
          <div className="mt-4 rounded-xl border py-14 text-center text-sm text-muted-foreground">
            还没有内容
          </div>
        ) : (
          <NoteKanban
            notes={sortedNotes}
            categories={categories}
            onNotesChange={handleKanbanNotesChange}
            onToggleDone={handleToggleDone}
            onDelete={handleDelete}
            onPriorityChange={handleChangePriority}
          />
        )}

        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          section={settingsSection}
          create={settingsCreate}
          user={cloud.user}
          status={cloud.status}
          lastSyncedAt={cloud.lastSyncedAt}
          onLogin={cloud.login}
          onRegister={cloud.register}
          onManualSync={handleManualSync}
          onLogout={handleLogout}
          workspaces={workspaces}
          currentId={currentId}
          stats={workspaceStats}
          onDeleteWorkspace={handleDeleteWorkspace}
          onRenameWorkspace={handleRenameWorkspace}
          onCreateWorkspace={handleCreateWorkspace}
          categories={categories}
          categoryName={
            workspaces.find((w) => w.id === currentId)?.name ?? null
          }
          categoryCounts={countsRecord}
          onDeleteCategory={handleDeleteCategory}
          onCreateCategory={handleCreateCategory}
          beam={beam}
          onBeamChange={handleBeamChange}
        />
      </main>

      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-40 select-none bg-gradient-to-t from-background via-background/85 to-transparent px-4 pb-6 pt-8 text-center text-xs text-muted-foreground/60">
        © {new Date().getFullYear()} Spark
      </footer>
    </>
  );
}

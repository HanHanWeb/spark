"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, Settings2Icon, XIcon, ZapIcon } from "lucide-react";
import { toast } from "sonner";
import {
  createId,
  deleteWorkspaceData,
  loadCategories,
  loadLastTypeId,
  loadNotes,
  loadCurrentWorkspaceId,
  loadWorkspaces,
  migrateLegacyData,
  nowMs,
  saveCategories,
  saveCurrentWorkspaceId,
  saveLastTypeId,
  saveNotes,
  saveWorkspaces,
  DEFAULT_CATEGORIES,
  type Category,
  type Note,
  type Workspace,
} from "@/lib/notes";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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

export function SparkApp() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [typeId, setTypeId] = useState<string>("");
  /** 已完成加载的工作区 id；用于拦截切换瞬间的旧数据写入 */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const [content, setContent] = useState("");
  const [tab, setTab] = useState<string>(ALL);

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

  function buildPayload(): CloudStatePayload {
    // 工作区列表与当前指针优先以已落库的存储为准，避免删除等同步写入后闭包仍持有旧值
    let effectiveWorkspaces = workspaces;
    let effectiveCurrentId = currentId;
    try {
      const fromStorage = loadWorkspaces();
      if (fromStorage.length !== workspaces.length) effectiveWorkspaces = fromStorage;
      const storedCurrent = loadCurrentWorkspaceId();
      if (storedCurrent !== currentId) effectiveCurrentId = storedCurrent;
    } catch {}
    const state: CloudStatePayload["state"] = {};
    for (const ws of effectiveWorkspaces) {
      state[ws.id] = {
        categories: loadCategories(ws.id),
        notes: loadNotes(ws.id),
      };
    }
    if (effectiveCurrentId && !state[effectiveCurrentId]) {
      state[effectiveCurrentId] = { categories, notes };
    }
    return {
      currentWorkspaceId: effectiveCurrentId,
      workspaces: effectiveWorkspaces.map((w) => ({
        id: w.id,
        name: w.name,
        createdAt: w.createdAt,
      })),
      state,
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
    saveWorkspaces(merged);
    // 写入远端各工作区快照，作为本地缓存
    for (const [wsId, snap] of Object.entries(payload.state)) {
      if (!wsId || !snap) continue;
      saveCategories(wsId, snap.categories as Category[]);
      saveNotes(wsId, snap.notes as Note[]);
    }
    const fallbackTarget = merged[0]?.id ?? null;
    let target =
      preferredCurrentId !== undefined
        ? preferredCurrentId
        : (payload.currentWorkspaceId ?? fallbackTarget);
    if (target && !merged.some((w) => w.id === target)) {
      target = fallbackTarget;
    }
    if (target && target !== currentId) {
      setCurrentId(target);
      saveCurrentWorkspaceId(target);
    }
    if (target) {
      const snap = payload.state[target];
      if (snap) {
        setLoadedFor(null); // 避免持久化 effect 用旧值覆盖
        queueMicrotask(() => {
          setCategories(snap.categories as Category[]);
          setNotes(
            [...(snap.notes as Note[])].sort((a, b) => b.createdAt - a.createdAt)
          );
          setTypeId(snap.categories[0]?.id ?? "");
          setTab(ALL);
          setContent("");
          setLoadedFor(target);
        });
      }
    }
  }

  const cloud = useCloudSync({
    buildPayload,
    applyRemote,
    onAuthResolved: handleAuthResolved,
  });

  useEffect(() => {
    if (!cloud.authReady || !cloud.user || !booted) return;
    if (baselineStartedRef.current) return;
    baselineStartedRef.current = true;
    queueMicrotask(() => {
      void cloud.establishBaseline();
    });
  }, [cloud.authReady, cloud.user, booted, cloud]);

  /* 数据变化 → 计划推送 */
  useEffect(() => {
    if (!cloud.user || !cloud.baselineReady) return;
    if (!currentId || loadedFor !== currentId) return;
    cloud.schedulePush();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 手动推送即全部依赖
  }, [notes, categories, workspaces, currentId]);

  /* 初始化：读取工作区列表 + 迁移 v1 全局数据 */
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      let list = loadWorkspaces();
      if (list.length === 0) {
        const seedId = createId();
        if (migrateLegacyData(seedId)) {
          const migrated: Workspace = {
            id: seedId,
            name: "默认工作区",
            createdAt: nowMs(),
          };
          list = [migrated];
          saveWorkspaces(list);
          saveCurrentWorkspaceId(migrated.id);
        }
      }
      const saved = loadCurrentWorkspaceId();
      const cur = saved && list.some((w) => w.id === saved) ? saved : null;
      setWorkspaces(list);
      setCurrentId(cur);
      setBooted(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* 切换工作区时加载对应数据（异步微任务内 setState） */
  useEffect(() => {
    if (!currentId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const cats = loadCategories(currentId);
      const last = loadLastTypeId(currentId);
      setCategories(cats);
      setNotes(loadNotes(currentId));
      setTypeId(last && cats.some((c) => c.id === last) ? last : (cats[0]?.id ?? ""));
      setTab(ALL);
      setContent("");
      setLoadedFor(currentId);
    });
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  /* 持久化当前工作区的数据 */
  useEffect(() => {
    if (currentId && loadedFor === currentId)
      saveCategories(currentId, categories);
  }, [categories, currentId, loadedFor]);

  useEffect(() => {
    if (currentId && loadedFor === currentId) saveNotes(currentId, notes);
  }, [notes, currentId, loadedFor]);

  useEffect(() => {
    if (currentId && loadedFor === currentId && typeId)
      saveLastTypeId(currentId, typeId);
  }, [typeId, currentId, loadedFor]);

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

  const visibleNotes = useMemo(
    () => (tab === ALL ? notes : notes.filter((n) => n.categoryId === tab)),
    [notes, tab]
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
        stats[ws.id] = {
          noteCount: loadNotes(ws.id).length,
          categoryCount: loadCategories(ws.id).length,
        };
      }
    }
    return stats;
  }, [workspaces, currentId, notes.length, categories.length]);

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
    saveCurrentWorkspaceId(id);
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
    saveCategories(ws.id, DEFAULT_CATEGORIES.map((c) => ({ ...c })));
    saveNotes(ws.id, []);
    setWorkspaces(next);
    saveWorkspaces(next);
    saveCurrentWorkspaceId(ws.id);
    enterWorkspace(ws.id);
    pushSoon();
    window.setTimeout(() => inputRef.current?.focus(), 100);
  }

  function handleRenameWorkspace(id: string, rawName: string) {
    const name = rawName.trim().slice(0, 16);
    if (!name) return;
    const next = workspaces.map((w) => (w.id === id ? { ...w, name } : w));
    setWorkspaces(next);
    saveWorkspaces(next);
    toast.success("已重命名工作区");
    pushSoon();
  }

  function handleDeleteWorkspace(id: string) {
    const isCurrent = id === currentId;
    const next = workspaces.filter((w) => w.id !== id);
    deleteWorkspaceData(id);
    if (isCurrent) {
      if (next.length > 0) {
        const fallback = next[0].id;
        setWorkspaces(next);
        saveWorkspaces(next);
        setCurrentId(fallback);
        saveCurrentWorkspaceId(fallback);
        setLoadedFor(null);
        toast.success("已删除工作区");
      } else {
        setWorkspaces([]);
        saveWorkspaces([]);
        saveCurrentWorkspaceId(null);
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
      saveWorkspaces(next);
      toast.success("已删除工作区");
    }
    pushSoon();
  }

  /** 变更后的即时推送：先落库再推，防刷新丢失 */
  function pushSoon() {
    if (!cloud.user || !cloud.baselineReady) return;
    queueMicrotask(() => {
      void cloud.pushNow();
    });
  }

  function handleDeleteCategory(id: string) {
    const rest = categories.filter((c) => c.id !== id);
    const nextNotes = notes.filter((n) => n.categoryId !== id);
    // 同步落库，避免异步 effect 尚未保存时刷新或拉取被云端覆盖
    if (currentId) {
      saveCategories(currentId, rest);
      saveNotes(currentId, nextNotes);
    }
    setNotes(nextNotes);
    setCategories(rest);
    if (typeId === id) setTypeId(rest[0]?.id ?? "");
    if (tab === id) setTab(ALL);
    pushSoon();
  }

  function handleCreateCategory(category: Category) {
    const nextCats = [...categories, category];
    if (currentId) saveCategories(currentId, nextCats);
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
    };
    const nextNotes = [note, ...notes];
    saveNotes(currentId, nextNotes);
    setNotes(nextNotes);
    setContent("");
    setTab(currentCategory.id);
    pushSoon();
    toast.success("添加成功", { duration: 2000 });
  }

  function handleDelete(id: string) {
    const nextNotes = notes.filter((n) => n.id !== id);
    if (currentId) saveNotes(currentId, nextNotes); // 立即落库
    setNotes(nextNotes);
    pushSoon();
  }

  /** 勾选为「完成」切换开关；完成态随同步通道走 done 字段 */
  function handleToggleDone(noteId: string) {
    setNotes((prev) => {
      const next = prev.map((n) =>
        n.id === noteId ? { ...n, done: !n.done } : n
      );
      if (currentId) saveNotes(currentId, next);
      return next;
    });
    pushSoon();
  }

  function handleManualSync() {
    if (!cloud.user) return;
    void cloud
      .pushNow()
      .then((ok) =>
        ok ? toast.success("已同步") : toast.error("同步失败，请稍后重试")
      );
  }

  function handleLogout() {
    void cloud.logout().then(() => {
      baselineStartedRef.current = false;
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

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-16">
        <header className="flex flex-col items-center pt-16 pb-10 text-center">
          <Image
            src="/favicon.svg"
            alt="Spark logo"
            width={64}
            height={61}
            priority
            className="size-16 drop-shadow-lg"
          />
          <h1 className="mt-5 bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
            Spark
          </h1>
        </header>

        <form onSubmit={handleSubmit}>
          <InputGroup className="h-10 rounded-xl shadow-sm">
            {/* 清零 addon 基类的负外边距；四壁内衬统一由这里的 p-1.5 提供 */}
            <InputGroupAddon align="inline-start" className="p-1.5 pl-2 has-[>button]:ml-0">
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
            />
          </InputGroup>
        </form>

        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList className="no-scrollbar h-9! w-full justify-start overflow-x-auto p-1">
            <TabsTrigger value={ALL} className="shrink-0">
              全部
              <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                {notes.length}
              </Badge>
            </TabsTrigger>
            {categories.map((c) => (
              <TabsTrigger key={c.id} value={c.id} className="shrink-0">
                {c.name}
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                  {counts.get(c.id) ?? 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {visibleNotes.length === 0 ? (
          <Empty className="mt-5 rounded-xl border py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12 rounded-xl">
                <ZapIcon className="!size-5 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>这里空空如也</EmptyTitle>
              <EmptyDescription>
                {tab === ALL
                  ? "在上方输入框写下第一条便签，回车即可保存"
                  : `「${categoryMap.get(tab)?.name ?? ""}」还没有内容，在上方输入并回车添加`}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
            {visibleNotes.map((note) => {
              const cat = categoryMap.get(note.categoryId);
              if (!cat) return null;
              const done = note.done === true;
              return (
                <li
                  key={note.id}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 transition-opacity",
                    done && "opacity-55"
                  )}
                >
                  <CategoryChip category={cat} />
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
        />
      </main>

      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-40 select-none bg-gradient-to-t from-background via-background/85 to-transparent px-4 pb-1.5 pt-8 text-center text-xs text-muted-foreground/60">
        © {new Date().getFullYear()} Spark
      </footer>
    </>
  );
}

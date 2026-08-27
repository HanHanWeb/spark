"use client";

import { useState } from "react";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CloudUploadIcon,
  LayersIcon,
  LogInIcon,
  LogOutIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SparklesIcon,
  TagIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import {
  BEAM_VARIANTS,
  BEAM_VARIANT_LABEL,
  COLOR_OPTIONS,
  ICON_OPTIONS,
  createId,
  formatFullTime,
  formatTime,
  getPill,
  getPillStyle,
  isHexColor,
  rgbToHex,
  toHex,
  type BeamSettings,
  type BeamVariant,
  type Category,
  type CategoryColor,
  type IconKey,
  type Workspace,
} from "@/lib/notes";
import type { CloudStatus } from "@/hooks/use-cloud-sync";
import type { CloudUser } from "@/lib/cloud";
import { STATUS_TEXT } from "@/components/spark/user-menu";
import { CategoryChip } from "@/components/spark/category-chip";
import { CategoryIcon } from "@/components/spark/category-icon";
import { AuthCard } from "@/components/spark/auth-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ColorPicker,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerOutput,
  ColorPickerSelection,
} from "@/components/kibo-ui/color-picker";
import { cn } from "@/lib/utils";

export type SettingsSection = "account" | "sync" | "workspaces" | "categories" | "appearance";

const SECTION_META: Record<
  SettingsSection,
  { label: string; title: string; description: string }
> = {
  account: {
    label: "账号",
    title: "账号",
    description: "Spark 账号与登录状态",
  },
  sync: {
    label: "云同步",
    title: "云同步",
    description: "本地数据与云端的同步状态",
  },
  workspaces: {
    label: "工作区",
    title: "工作区",
    description: "相互隔离的独立笔记空间",
  },
  categories: {
    label: "分类",
    title: "分类",
    // 描述包含当前工作区名，在渲染时动态生成
    description: "",
  },
  appearance: {
    label: "外观",
    title: "搜索框光效",
    description: "为胶囊搜索框添加 Border Beam 流光边框，可选 4 种配色与速度",
  },
};

/** 分区导航图标（switch 静态映射，规避 react-hooks/static-components） */
function SectionGlyph({
  section,
  className,
}: {
  section: SettingsSection;
  className?: string;
}) {
  switch (section) {
    case "account":
      return <UserRoundIcon className={className} />;
    case "sync":
      return <CloudUploadIcon className={className} />;
    case "workspaces":
      return <LayersIcon className={className} />;
    case "categories":
      return <TagIcon className={className} />;
    case "appearance":
      return <SparklesIcon className={className} />;
  }
}

/** 同步状态小图标，账号卡片与云同步分区共用 */
function StatusMark({
  status,
  className,
}: {
  status: CloudStatus;
  className?: string;
}) {
  switch (status) {
    case "syncing":
      return <RefreshCwIcon className={cn("animate-spin", className)} />;
    case "error":
      return <CircleAlertIcon className={cn("text-destructive", className)} />;
    default:
      return <CircleCheckIcon className={cn("text-green-600", className)} />;
  }
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 每次打开时定位到的分区 */
  section?: SettingsSection;
  /** 打开时是否直接展开对应分区的新建表单 */
  create?: boolean;
  /* ---------- 账号 / 云同步 ---------- */
  user: CloudUser | null;
  status: CloudStatus;
  lastSyncedAt: number | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  onManualSync: () => void;
  onLogout: () => void;
  /* ---------- 工作区 ---------- */
  workspaces: Workspace[];
  currentId: string | null;
  stats: Record<string, { noteCount: number; categoryCount: number }>;
  onDeleteWorkspace: (id: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onCreateWorkspace: (name: string) => void;
  /* ---------- 分类（当前工作区） ---------- */
  categories: Category[];
  categoryName: string | null;
  categoryCounts: Record<string, number>;
  onDeleteCategory: (id: string) => void;
  onCreateCategory: (category: Category) => void;
  /* ---------- 外观 ---------- */
  beam: BeamSettings;
  onBeamChange: (patch: Partial<BeamSettings>) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  section = "account",
  create = false,
  ...panel
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* open 条件渲染：关闭即卸载，打开时各分区内部状态自动复位 */}
      {open && (
        <DialogContent
          className="gap-0 overflow-hidden p-0 w-[672px] h-[520px] max-w-[90vw] max-h-[85vh] sm:max-w-[672px]"
          // 不自动聚焦，防止落在首行悬停显示的删除按钮上
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SettingsPanel
            {...panel}
            onOpenChange={onOpenChange}
            initialSection={section}
            initialCreate={create}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

type PanelProps = Omit<SettingsDialogProps, "open" | "section" | "create"> & {
  onOpenChange: (open: boolean) => void;
  initialSection: SettingsSection;
  initialCreate: boolean;
};

function SettingsPanel({
  onOpenChange,
  initialSection,
  initialCreate,
  user,
  status,
  lastSyncedAt,
  onLogin,
  onRegister,
  onManualSync,
  onLogout,
  workspaces,
  currentId,
  stats,
  onDeleteWorkspace,
  onRenameWorkspace,
  onCreateWorkspace,
  categories,
  categoryName,
  categoryCounts,
  onDeleteCategory,
  onCreateCategory,
  beam,
  onBeamChange,
}: PanelProps) {
  const [active, setActive] = useState<SettingsSection>(initialSection);
  const sectionIds = Object.keys(SECTION_META) as SettingsSection[];

  function close() {
    onOpenChange(false);
  }

  const categoriesDescription = categoryName
    ? `「${categoryName}」内的便签归类`
    : SECTION_META.categories.description;

  return (
    <div className="flex h-[520px] w-full">
      {/* 左侧分区导航 */}
      <nav
        aria-label="设置分区"
        className="flex w-40 shrink-0 flex-col gap-1 border-r bg-muted/30 p-2"
      >
        {sectionIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            aria-current={active === id ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active === id
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
            )}
          >
            <SectionGlyph section={id} className="size-4 shrink-0" />
            <span>{SECTION_META[id].label}</span>
            {id === "categories" && (
              <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[10px]">
                {categories.length}
              </Badge>
            )}
          </button>
        ))}
      </nav>

      {/* 右侧内容区 - 固定尺寸，无滚动条 */}
      <div className="min-w-0 flex-1 overflow-y-auto no-scrollbar">
        <div className="pt-5 pr-12 pb-1 pl-5">
          <DialogTitle>{SECTION_META[active].title}</DialogTitle>
          <DialogDescription className="mt-1.5 text-xs leading-relaxed">
            {active === "categories"
              ? categoriesDescription
              : SECTION_META[active].description}
          </DialogDescription>
        </div>

        <div className="p-5 pt-4">
          {active === "account" &&
            (user ? (
              <SignedInAccountView
                user={user}
                status={status}
                lastSyncedAt={lastSyncedAt}
                onLogout={onLogout}
              />
            ) : (
              <AuthCard
                onSuccess={close}
                onLogin={onLogin}
                onRegister={onRegister}
              />
            ))}

          {active === "sync" &&
            (user ? (
              <SignedInSyncView
                status={status}
                lastSyncedAt={lastSyncedAt}
                onManualSync={onManualSync}
              />
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
                <p className="text-sm text-muted-foreground">
                  还没登录账号。登录 Spark 后，本地便签会自动与云端保持一致。
                </p>
                <Button variant="outline" onClick={() => setActive("account")}>
                  <LogInIcon />
                  去登录
                </Button>
              </div>
            ))}

          {active === "workspaces" && (
            <WorkspacesSection
              startCreating={initialCreate}
              workspaces={workspaces}
              currentId={currentId}
              stats={stats}
              onDelete={onDeleteWorkspace}
              onRename={onRenameWorkspace}
              onCreate={onCreateWorkspace}
            />
          )}

          {active === "categories" && (
            <CategoriesSection
              startCreating={initialCreate}
              categories={categories}
              counts={categoryCounts}
              onDelete={onDeleteCategory}
              onCreate={onCreateCategory}
            />
          )}

          {active === "appearance" && (
            <AppearanceSection beam={beam} onBeamChange={onBeamChange} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 账号 ---------------- */

function SignedInAccountView({
  user,
  status,
  lastSyncedAt,
  onLogout,
}: {
  user: CloudUser;
  status: CloudStatus;
  lastSyncedAt: number | null;
  onLogout: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-foreground/5">
          <UserRoundIcon className="size-5 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.email}</p>
          <p
            className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"
            role="status"
          >
            <StatusMark status={status} className="size-3" />
            {STATUS_TEXT[status]}
            {lastSyncedAt && status !== "syncing"
              ? ` · ${formatTime(lastSyncedAt)}`
              : ""}
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={onLogout}
        >
          <LogOutIcon />
          退出登录
        </Button>
      </div>
    </div>
  );
}

/* ---------------- 云同步 ---------------- *//* ---------------- 云同步 ---------------- */

function SignedInSyncView({
  status,
  lastSyncedAt,
  onManualSync,
}: {
  status: CloudStatus;
  lastSyncedAt: number | null;
  onManualSync: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-muted/50 px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <StatusMark status={status} className="size-4" />
          {STATUS_TEXT[status]}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {lastSyncedAt
            ? `上次同步：${formatFullTime(lastSyncedAt)}`
            : "还没有同步记录"}
        </p>
      </div>
      <Button
        className="self-start"
        onClick={onManualSync}
        disabled={status === "syncing"}
      >
        <RefreshCwIcon className={cn(status === "syncing" && "animate-spin")} />
        立即同步
      </Button>
    </div>
  );
}

/* ---------------- 工作区 ---------------- */

function WorkspacesSection({
  workspaces,
  currentId,
  stats,
  onDelete,
  onRename,
  onCreate,
  startCreating,
}: {
  workspaces: Workspace[];
  currentId: string | null;
  stats: Record<string, { noteCount: number; categoryCount: number }>;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onCreate: (name: string) => void;
  startCreating: boolean;
}) {
  const [creating, setCreating] = useState(startCreating);

  return (
    <div className="flex flex-col gap-3">
      {creating ? (
        <NewWorkspaceForm
          onCancel={() => setCreating(false)}
          onCreate={(name) => {
            onCreate(name);
            setCreating(false);
          }}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setCreating(true)}
        >
          <PlusIcon />
          新建工作区
        </Button>
      )}

      {/* 删除/重命名后面板保持打开（列表实时更新），便于连续管理 */}
      <WorkspaceList
        workspaces={workspaces}
        currentId={currentId}
        stats={stats}
        onDelete={onDelete}
        onRename={onRename}
      />
    </div>
  );
}

function NewWorkspaceForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const valid = name.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onCreate(name.trim());
      }}
      className="rounded-lg border bg-card p-3"
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="工作区名称，如：工作、生活"
        maxLength={16}
        autoFocus
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" size="sm" disabled={!valid}>
          创建
        </Button>
      </div>
    </form>
  );
}

/** 行内重命名与两段式删除确认的工作区列表 */
function WorkspaceList({
  workspaces,
  currentId,
  stats,
  onDelete,
  onRename,
}: {
  workspaces: Workspace[];
  currentId: string | null;
  stats: Record<string, { noteCount: number; categoryCount: number }>;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  function startRename(id: string, name: string) {
    setConfirmId(null);
    setRenamingId(id);
    setDraftName(name);
  }

  function submitRename() {
    if (!renamingId) return;
    const name = draftName.trim();
    const original = workspaces.find((w) => w.id === renamingId);
    // 名称没变就不落库不推送
    if (name && name !== original?.name) onRename(renamingId, name);
    setRenamingId(null);
  }

  if (workspaces.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
        还没有任何工作区，先新建一个吧
      </div>
    );
  }

  return (
    <ul className="-mx-1 px-1">
      {workspaces.map((ws) =>
        confirmId === ws.id ? (
          <li
            key={ws.id}
            className="flex flex-col gap-2.5 rounded-lg bg-destructive/5 px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                <LayersIcon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {ws.name}
              </span>
              {ws.id === currentId && (
                <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[10px]">
                  当前
                </Badge>
              )}
            </div>
            <p className="text-xs text-destructive">
              将一并删除 {stats[ws.id]?.categoryCount ?? 0} 个分类、
              {stats[ws.id]?.noteCount ?? 0} 条便签，且无法恢复
            </p>
            <div className="flex justify-end gap-2">
              <Button size="xs" variant="outline" onClick={() => setConfirmId(null)}>
                取消
              </Button>
              <Button size="xs" variant="destructive" onClick={() => onDelete(ws.id)}>
                确认删除
              </Button>
            </div>
          </li>
        ) : renamingId === ws.id ? (
          <li key={ws.id}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitRename();
              }}
              className="rounded-lg border bg-card p-3"
            >
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="工作区名称"
                maxLength={16}
                autoFocus
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setRenamingId(null)}
                >
                  取消
                </Button>
                <Button type="submit" size="sm" disabled={!draftName.trim()}>
                  保存
                </Button>
              </div>
            </form>
          </li>
        ) : (
          <li
            key={ws.id}
            className="group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent/50"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
              <LayersIcon className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{ws.name}</span>
            {ws.id === currentId && (
              <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[10px]">
                当前
              </Badge>
            )}
            <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">
              {stats[ws.id]?.noteCount ?? 0}
            </Badge>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`重命名工作区「${ws.name}」`}
              onClick={() => startRename(ws.id, ws.name)}
              className="pointer-events-none shrink-0 text-muted-foreground opacity-0 transition-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:text-foreground"
            >
              <PencilIcon />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`删除工作区「${ws.name}」`}
              onClick={() => {
                setRenamingId(null);
                setConfirmId(ws.id);
              }}
              className="pointer-events-none shrink-0 text-muted-foreground opacity-0 transition-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:text-destructive"
            >
              <Trash2Icon />
            </Button>
          </li>
        )
      )}
    </ul>
  );
}

/* ---------------- 分类 ---------------- */

/** 自定义色 swatch 的彩虹渐变：预设色首尾相接环成一圈 */
const CUSTOM_SWATCH_BG = `conic-gradient(${[
  ...COLOR_OPTIONS.map((c) => c.hex),
  COLOR_OPTIONS[0].hex,
].join(", ")})`;

function CategoriesSection({
  categories,
  counts,
  onDelete,
  onCreate,
  startCreating,
}: {
  categories: Category[];
  counts: Record<string, number>;
  onDelete: (id: string) => void;
  onCreate: (category: Category) => void;
  startCreating: boolean;
}) {
  const [creating, setCreating] = useState(startCreating);

  return (
    <div className="flex flex-col gap-3">
      {creating ? (
        <NewCategoryForm
          onCancel={() => setCreating(false)}
          onCreate={(category) => {
            onCreate(category);
            setCreating(false);
          }}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setCreating(true)}
        >
          <PlusIcon />
          新建分类
        </Button>
      )}

      <CategoryList categories={categories} counts={counts} onDelete={onDelete} />
    </div>
  );
}

/** 新建分类表单：名称、图标、颜色（预设 + 自定义取色器）与实时预览 */
function NewCategoryForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (category: Category) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconKey>("zap");
  const [color, setColor] = useState<CategoryColor>("purple");
  const isCustom = isHexColor(color);

  const valid = name.trim().length > 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid) return;
    onCreate({
      id: createId(),
      name: name.trim(),
      icon,
      color,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="分类名称，如：购物清单"
        maxLength={12}
        autoFocus
      />

      <div role="radiogroup" aria-label="选择图标" className="grid grid-cols-6 gap-1.5">
        {ICON_OPTIONS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={icon === key}
            title={label}
            onClick={() => setIcon(key)}
            className={cn(
              "flex h-8 items-center justify-center rounded-lg border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4",
              icon === key
                ? cn(getPill(color), "border-transparent font-medium")
                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            style={getPillStyle(color)}
          >
            <Icon />
          </button>
        ))}
      </div>

      <div
        role="radiogroup"
        aria-label="选择颜色"
        className="flex flex-wrap items-center gap-2"
      >
        {COLOR_OPTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={color === c.id}
            title={c.label}
            onClick={() => setColor(c.id)}
            className={cn(
              "size-6 rounded-full transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              c.swatch,
              color === c.id &&
                "ring-2 ring-ring ring-offset-2 ring-offset-background"
            )}
          />
        ))}

        {/* 自定义颜色：swatch 即取色器入口，选中后 swatch 显示所选色值 */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              role="radio"
              aria-checked={isCustom}
              aria-label="自定义颜色"
              title="自定义颜色"
              className={cn(
                "size-6 rounded-full transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                isCustom &&
                  "ring-2 ring-ring ring-offset-2 ring-offset-background"
              )}
              style={{ background: isCustom ? color : CUSTOM_SWATCH_BG }}
            />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-3">
            <ColorPicker
              defaultValue={toHex(color)}
              onChange={(value) => {
                const [r, g, b] = value as number[];
                setColor(rgbToHex(r, g, b));
              }}
            >
              <ColorPickerSelection className="h-32" />
              <div className="mt-3 space-y-2">
                <ColorPickerHue />
                <div className="flex items-center gap-2">
                  <ColorPickerOutput />
                  <ColorPickerFormat />
                </div>
              </div>
            </ColorPicker>
          </PopoverContent>
        </Popover>

        {/* 实时预览：直接内联在颜色行右侧，不再单独占一块 */}
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            getPill(color)
          )}
          style={getPillStyle(color)}
        >
          <CategoryIcon name={icon} className="size-3" />
          {name.trim() || "分类名称"}
        </span>
      </div>

      <div className="mt-0 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={!valid}>
          创建
        </Button>
      </div>
    </form>
  );
}

/** 两段式删除确认的分类列表；最后一个分类禁删 */
function CategoryList({
  categories,
  counts,
  onDelete,
}: {
  categories: Category[];
  counts: Record<string, number>;
  onDelete: (id: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
        还没有任何分类，先新建一个吧
      </div>
    );
  }

  return (
    <ul className="-mx-1 px-1">
      {categories.map((cat) =>
        confirmId === cat.id ? (
          <li
            key={cat.id}
            className="flex flex-col gap-2.5 rounded-lg bg-destructive/5 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <CategoryChip category={cat} />
              <span className="text-xs text-destructive">
                将一并删除 {counts[cat.id] ?? 0} 条便签，且无法恢复
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="xs" variant="outline" onClick={() => setConfirmId(null)}>
                取消
              </Button>
              <Button size="xs" variant="destructive" onClick={() => onDelete(cat.id)}>
                确认删除
              </Button>
            </div>
          </li>
        ) : (
          <li
            key={cat.id}
            className="group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent/50"
          >
            <CategoryChip category={cat} />
            <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">
              {counts[cat.id] ?? 0}
            </Badge>
            <span className="min-w-0 flex-1" />
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`删除分类「${cat.name}」`}
              onClick={() => setConfirmId(cat.id)}
              className="pointer-events-none shrink-0 text-muted-foreground opacity-0 transition-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:text-destructive"
              title={categories.length <= 1 ? "至少保留一个分类" : undefined}
              disabled={categories.length <= 1}
            >
              <Trash2Icon />
            </Button>
          </li>
        )
      )}
    </ul>
  );
}

/* ---------------- 外观：搜索框光效 ---------------- */

const BEAM_PREVIEW: Record<BeamVariant, string> = {
  colorful: "linear-gradient(90deg,#ff3b82,#8b5cf6,#3b82f6,#06b6d4,#22c55e,#f59e0b)",
  ocean: "linear-gradient(90deg,#06b6d4,#3b82f6,#6366f1,#8b5cf6)",
  sunset: "linear-gradient(90deg,#f59e0b,#f97316,#ef4444,#ec4899)",
  mono: "linear-gradient(90deg,#52525b,#a1a1aa,#e4e4e7,#52525b)",
};

function AppearanceSection({
  beam,
  onBeamChange,
}: {
  beam: BeamSettings;
  onBeamChange: (patch: Partial<BeamSettings>) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between rounded-lg border bg-card p-4">
        <div>
          <p className="text-sm font-medium">启用光效</p>
          <p className="mt-0.5 text-xs text-muted-foreground">关闭后搜索框不再显示流光边框</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={beam.enabled}
          onClick={() => onBeamChange({ enabled: !beam.enabled })}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            beam.enabled ? "bg-primary" : "bg-input"
          )}
        >
          <span
            className={cn(
              "pointer-events-none block size-5 rounded-full bg-background shadow-sm ring-0 transition-transform",
              beam.enabled ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>

      <div className={cn("rounded-lg border bg-card p-4", !beam.enabled && "opacity-50 pointer-events-none")}>
        <p className="text-sm font-medium">光效样式</p>
        <p className="mt-1 text-xs text-muted-foreground">4 种内置配色，跟随胶囊搜索框边框流动</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {BEAM_VARIANTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onBeamChange({ variant: v })}
              aria-pressed={beam.variant === v}
              className={cn(
                "relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                beam.variant === v
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent/50"
              )}
            >
              <span
                aria-hidden
                className="h-2 w-full rounded-full"
                style={{ background: BEAM_PREVIEW[v] }}
              />
              <span className="text-xs font-medium">{BEAM_VARIANT_LABEL[v]}</span>
              {beam.variant === v && (
                <span className="absolute right-2 top-2 size-2 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("rounded-lg border bg-card p-4", !beam.enabled && "opacity-50 pointer-events-none")}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">流动速度</p>
          <span className="text-xs tabular-nums text-muted-foreground">{beam.duration.toFixed(2)}s / 圈</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">快</span>
          <input
            type="range"
            min={0.6}
            max={4}
            step={0.02}
            value={beam.duration}
            onChange={(e) => onBeamChange({ duration: Number(e.target.value) })}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
          <span className="text-xs text-muted-foreground">慢</span>
        </div>
        <div className="mt-2 flex gap-2">
          <Button size="xs" variant="outline" onClick={() => onBeamChange({ duration: 2 })}>快 2s</Button>
          <Button size="xs" variant="outline" onClick={() => onBeamChange({ duration: 3 })}>默认 3s</Button>
          <Button size="xs" variant="outline" onClick={() => onBeamChange({ duration: 4 })}>慢 4s</Button>
        </div>
      </div>
    </div>
  );
}

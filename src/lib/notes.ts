import type { CSSProperties } from "react";
import {
  BookOpen,
  Bookmark,
  Brain,
  Camera,
  Coffee,
  Flag,
  Heart,
  Lightbulb,
  ListTodo,
  Music,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type IconKey =
  | "lightbulb"
  | "listTodo"
  | "brain"
  | "bookOpen"
  | "zap"
  | "star"
  | "heart"
  | "flag"
  | "bookmark"
  | "coffee"
  | "music"
  | "camera";

export type ColorId =
  | "purple"
  | "orange"
  | "blue"
  | "green"
  | "red"
  | "amber"
  | "pink"
  | "cyan";

/** 分类颜色：预设色 id 或自定义 hex（#rgb / #rrggbb） */
export type CategoryColor = ColorId | `#${string}`;

export interface Category {
  id: string;
  name: string;
  icon: IconKey;
  color: CategoryColor;
}

export type Priority = "low" | "medium" | "high";

export interface Note {
  id: string;
  categoryId: string;
  content: string;
  createdAt: number;
  /** 完成态；旧数据缺省视为未完成 */
  done?: boolean;
  /** 优先级；旧数据缺省视为中 */
  priority?: Priority;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
}

export const ICON_OPTIONS: { key: IconKey; label: string; Icon: LucideIcon }[] = [
  { key: "lightbulb", label: "灵感", Icon: Lightbulb },
  { key: "listTodo", label: "待办", Icon: ListTodo },
  { key: "brain", label: "想法", Icon: Brain },
  { key: "bookOpen", label: "日记", Icon: BookOpen },
  { key: "zap", label: "火花", Icon: Zap },
  { key: "star", label: "星标", Icon: Star },
  { key: "heart", label: "喜欢", Icon: Heart },
  { key: "flag", label: "标记", Icon: Flag },
  { key: "bookmark", label: "收藏", Icon: Bookmark },
  { key: "coffee", label: "闲聊", Icon: Coffee },
  { key: "music", label: "音乐", Icon: Music },
  { key: "camera", label: "影像", Icon: Camera },
];

interface ColorOption {
  id: ColorId;
  label: string;
  /** 对应的 hex 值，用作自定义取色器的初始色 */
  hex: string;
  swatch: string;
  pill: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  {
    id: "purple",
    label: "紫",
    hex: "#a855f7",
    swatch: "bg-purple-500",
    pill: "bg-purple-500/10 text-purple-600 dark:bg-purple-400/15 dark:text-purple-300",
  },
  {
    id: "orange",
    label: "橙",
    hex: "#f97316",
    swatch: "bg-orange-500",
    pill: "bg-orange-500/10 text-orange-600 dark:bg-orange-400/15 dark:text-orange-300",
  },
  {
    id: "blue",
    label: "蓝",
    hex: "#3b82f6",
    swatch: "bg-blue-500",
    pill: "bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300",
  },
  {
    id: "green",
    label: "绿",
    hex: "#22c55e",
    swatch: "bg-green-500",
    pill: "bg-green-500/10 text-green-600 dark:bg-green-400/15 dark:text-green-300",
  },
  {
    id: "red",
    label: "红",
    hex: "#ef4444",
    swatch: "bg-red-500",
    pill: "bg-red-500/10 text-red-600 dark:bg-red-400/15 dark:text-red-300",
  },
  {
    id: "amber",
    label: "黄",
    hex: "#fbbf24",
    swatch: "bg-amber-400",
    pill: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300",
  },
  {
    id: "pink",
    label: "粉",
    hex: "#ec4899",
    swatch: "bg-pink-500",
    pill: "bg-pink-500/10 text-pink-600 dark:bg-pink-400/15 dark:text-pink-300",
  },
  {
    id: "cyan",
    label: "青",
    hex: "#06b6d4",
    swatch: "bg-cyan-500",
    pill: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300",
  },
];

const COLOR_MAP = new Map<ColorId, ColorOption>(
  COLOR_OPTIONS.map((c) => [c.id, c])
);

/** 自定义色的胶囊样式：色值经 --cat-color 注入，文字亮暗两态分别混黑/混白保证对比度 */
export const CUSTOM_COLOR_PILL =
  "bg-(--cat-color)/10 text-[color-mix(in_srgb,var(--cat-color)_75%,black)] dark:bg-(--cat-color)/15 dark:text-[color-mix(in_srgb,var(--cat-color)_45%,white)]";

export function isHexColor(c: string): c is `#${string}` {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c);
}

export function rgbToHex(r: number, g: number, b: number): `#${string}` {
  const ch = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

/** 归一为 hex：预设色取对应色值，自定义色原样返回 */
export function toHex(color: CategoryColor): string {
  if (isHexColor(color)) return color;
  return COLOR_MAP.get(color)?.hex ?? "#a855f7";
}

export function getPill(color: CategoryColor): string {
  if (isHexColor(color)) return CUSTOM_COLOR_PILL;
  return COLOR_MAP.get(color)?.pill ?? COLOR_MAP.get("purple")!.pill;
}

/** 自定义色需在内联 style 注入 --cat-color；预设色用纯 Tailwind 类，返回 undefined */
export function getPillStyle(color: CategoryColor): CSSProperties | undefined {
  if (!isHexColor(color)) return undefined;
  return { "--cat-color": color.toLowerCase() } as CSSProperties;
}

export const PRIORITY_OPTIONS: {
  id: Priority;
  label: string;
  dot: string;
  pill: string;
}[] = [
  {
    id: "low",
    label: "低",
    dot: "bg-red-300",
    pill: "bg-red-50 text-red-400 border border-red-200 dark:bg-red-400/10 dark:text-red-300 dark:border-red-400/20",
  },
  {
    id: "medium",
    label: "中",
    dot: "bg-red-500",
    pill: "bg-red-500/15 text-red-600 border border-red-300/50 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
  },
  {
    id: "high",
    label: "高",
    dot: "bg-red-600",
    pill: "bg-red-600 text-white border border-red-700 dark:bg-red-600 dark:text-white dark:border-red-700",
  },
];

const PRIORITY_SET = new Set<Priority>(PRIORITY_OPTIONS.map((p) => p.id));

export function isValidPriority(v: unknown): v is Priority {
  return typeof v === "string" && PRIORITY_SET.has(v as Priority);
}

export function getPriorityPill(p?: Priority): string {
  const id = isValidPriority(p) ? p : "medium";
  return PRIORITY_OPTIONS.find((o) => o.id === id)!.pill;
}

export function getPriorityLabel(p?: Priority): string {
  const id = isValidPriority(p) ? p : "medium";
  return PRIORITY_OPTIONS.find((o) => o.id === id)!.label;
}

export function normalizePriority(p: unknown): Priority {
  return isValidPriority(p) ? (p as Priority) : "medium";
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "inspiration", name: "灵感", icon: "lightbulb", color: "purple" },
  { id: "todo", name: "待办", icon: "listTodo", color: "orange" },
  { id: "idea", name: "想法", icon: "brain", color: "blue" },
  { id: "diary", name: "日记", icon: "bookOpen", color: "green" },
];

/* ---------------- 旧版本 localStorage 数据的一次性迁移 ---------------- */

const V1 = "spark.v1.";
const V2 = "spark.v2.";

export interface LegacyLocalWorkspace extends Workspace {
  viewMode?: ViewMode;
  lastTypeId?: string | null;
}

export interface LegacyLocalData {
  currentWorkspaceId: string | null;
  workspaces: LegacyLocalWorkspace[];
  state: Record<string, { categories: Category[]; notes: Note[] }>;
  beam?: BeamSettings;
}

function legacyReadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * 读取旧版本存放在 localStorage 的全部业务数据（v2 为主，v1 兜底）。
 * 只读取不删除；待合并结果成功上传云端后调用 clearLegacyLocalData()，
 * 避免推送失败时本地数据被提前清掉。
 */
export function readLegacyLocalData(): LegacyLocalData | null {
  if (typeof window === "undefined") return null;

  let workspaces: LegacyLocalWorkspace[] = (() => {
    const stored = legacyReadJson<unknown[]>(V2 + "workspaces", []);
    const list = Array.isArray(stored) ? stored.filter(isValidWorkspace) : [];
    return list.map((w) => ({
      ...w,
      viewMode:
        legacyReadJson<string>(`${V2}ws.${w.id}.viewMode`, "") === "kanban"
          ? ("kanban" as ViewMode)
          : ("list" as ViewMode),
      lastTypeId: legacyReadJson<string>(`${V2}ws.${w.id}.lastType`, "") || null,
    }));
  })();

  // 从未以 v2 格式落库、但存在 v1 全局数据：按旧迁移规则装进一个默认工作区
  if (workspaces.length === 0) {
    const legacyNotes = legacyReadJson<unknown[]>(V1 + "notes", []);
    const notes = Array.isArray(legacyNotes)
      ? legacyNotes.filter(isValidNote)
      : [];
    if (notes.length === 0) return null;
    workspaces = [
      {
        id: `migrated-${Date.now().toString(36)}`,
        name: "默认工作区",
        createdAt: Date.now(),
      },
    ];
    const legacyCats = legacyReadJson<unknown[]>(V1 + "categories", []);
    const custom = Array.isArray(legacyCats)
      ? normalizeCategories(legacyCats)
      : [];
    const cats = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
    for (const c of custom) {
      if (!cats.some((d) => d.id === c.id)) cats.push(c);
    }
    const data: LegacyLocalData = {
      currentWorkspaceId: workspaces[0].id,
      workspaces,
      state: { [workspaces[0].id]: { categories: cats, notes } },
    };
    return data;
  }

  const state: LegacyLocalData["state"] = {};
  for (const ws of workspaces) {
    const rawCats = legacyReadJson<unknown>(`${V2}ws.${ws.id}.categories`, null);
    // 从未写入过分类的工作区播种默认分类
    const cats =
      rawCats === null || !Array.isArray(rawCats)
        ? DEFAULT_CATEGORIES.map((c) => ({ ...c }))
        : normalizeCategories(rawCats);
    const rawNotes = legacyReadJson<unknown[]>(`${V2}ws.${ws.id}.notes`, []);
    state[ws.id] = {
      categories: cats,
      notes: Array.isArray(rawNotes) ? normalizeNotes(rawNotes) : [],
    };
  }

  const rawCurrent = legacyReadJson<string>(V2 + "currentWorkspace", "");
  const currentWorkspaceId =
    rawCurrent && workspaces.some((w) => w.id === rawCurrent)
      ? rawCurrent
      : workspaces[0].id;

  const rawBeam = legacyReadJson<Partial<BeamSettings>>(V2 + "beam", {});
  const beam = normalizeBeam(rawBeam);

  return { currentWorkspaceId, workspaces, state, beam };
}

/** 迁移数据成功上传云端后调用，清除旧 localStorage 键（主题键不受影响） */
export function clearLegacyLocalData() {
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith(V1) || key.startsWith(V2))) doomed.push(key);
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // 存储不可用时静默降级
  }
}

function isValidCategory(c: unknown): c is Category {
  const o = c as Category;
  return (
    typeof o?.id === "string" &&
    typeof o?.name === "string" &&
    typeof o?.icon === "string" &&
    typeof o?.color === "string"
  );
}

function isValidNote(n: unknown): n is Note {
  const o = n as Note;
  return (
    typeof o?.id === "string" &&
    typeof o?.categoryId === "string" &&
    typeof o?.content === "string" &&
    typeof o?.createdAt === "number"
  );
}

export function normalizeNotes(list: unknown[]): Note[] {
  return list.filter(isValidNote).map((n) => {
    const o = n as Note;
    return {
      ...o,
      priority: normalizePriority((o as unknown as Record<string, unknown>).priority),
    };
  });
}
function isValidWorkspace(w: unknown): w is Workspace {
  const o = w as Workspace;
  return (
    typeof o?.id === "string" &&
    o.id.length > 0 &&
    typeof o?.name === "string" &&
    o.name.length > 0 &&
    typeof o?.createdAt === "number"
  );
}

export function normalizeCategories(list: unknown[]): Category[] {
  return list.filter(isValidCategory).map((c) => ({
    ...c,
    icon: (ICON_OPTIONS.some((i) => i.key === c.icon) ? c.icon : "lightbulb") as IconKey,
    // 预设 id 与合法 hex 都放行，其余回退默认紫
    color: (
      COLOR_MAP.has(c.color as ColorId) || isHexColor(c.color)
        ? c.color
        : "purple"
    ) as CategoryColor,
  }));
}

export type ViewMode = "list" | "kanban";

/* ---------------- 搜索框光效 ---------------- */
export type BeamVariant = "colorful" | "ocean" | "sunset" | "mono";
export const BEAM_VARIANTS: BeamVariant[] = ["colorful", "ocean", "sunset", "mono"];
export const BEAM_VARIANT_LABEL: Record<BeamVariant, string> = {
  colorful: "Colorful 彩色",
  ocean: "Ocean 海洋",
  sunset: "Sunset 日落",
  mono: "Mono 单色",
};

export interface BeamSettings {
  variant: BeamVariant;
  /** 动画周期秒数；越小越快 */
  duration: number;
  /** 是否启用光效；关闭则搜索框不包裹 BorderBeam */
  enabled: boolean;
}

export const DEFAULT_BEAM: BeamSettings = { variant: "colorful", duration: 3, enabled: true };

/** 光效设置归一：字段缺失或非法时回落默认值 */
export function normalizeBeam(raw: Partial<BeamSettings> | undefined | null): BeamSettings {
  if (!raw) return { ...DEFAULT_BEAM };
  return {
    variant: BEAM_VARIANTS.includes(raw.variant as BeamVariant)
      ? (raw.variant as BeamVariant)
      : DEFAULT_BEAM.variant,
    duration:
      typeof raw.duration === "number" && Number.isFinite(raw.duration)
        ? Math.min(5, Math.max(0.6, raw.duration))
        : DEFAULT_BEAM.duration,
    enabled:
      typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_BEAM.enabled,
  };
}

/* ---------------- utils ---------------- */

export function createId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 供事件处理器内使用的时间戳封装（隔离静态纯度检查） */
export function nowMs(): number {
  return Date.now();
}

/**
 * 相对时间格式化（微信/Flomo 风格）：
 * - 1 分钟内：刚刚
 * - 1 小时内：N 分钟前
 * - 今天：HH:mm
 * - 昨天：昨天 HH:mm
 * - 今年：M月D日（超过一周补星期）
 * - 更早：YYYY年M月D日
 */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const diff = startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayMs = 86_400_000;

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const time = `${hh}:${mm}`;

  if (ts >= now.getTime() - 60_000) return "刚刚";
  if (ts >= now.getTime() - 3_600_000) {
    const mins = Math.max(1, Math.floor((now.getTime() - ts) / 60_000));
    return `${mins}分钟前`;
  }
  if (diff === 0) return time;
  if (diff === dayMs) return `昨天 ${time}`;
  if (diff < 7 * dayMs) {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
  }
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 完整时间，用于 title 悬停提示 */
export function formatFullTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}

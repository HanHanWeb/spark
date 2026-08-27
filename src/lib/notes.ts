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

/* ---------------- storage ---------------- */

const V1 = "spark.v1."; // 旧版全局键（用于迁移）
const V2 = "spark.v2."; // 新版：工作区列表全局存，业务数据按工作区隔离
const KEY_WORKSPACES = V2 + "workspaces";
const KEY_CURRENT_WS = V2 + "currentWorkspace";

function wsKey(workspaceId: string, key: string): string {
  return `${V2}ws.${workspaceId}.${key}`;
}

function readJson<T>(storageKey: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 与 readJson 不同：键不存在时返回 null，用于区分“空数据”与“从未写入” */
function readJsonOrNull(storageKey: string): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(storageKey: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // 存储不可用时静默降级，不影响使用
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

function normalizeNotes(list: unknown[]): Note[] {
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

function normalizeCategories(list: unknown[]): Category[] {
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

/* ---------------- workspace-level ---------------- */

export function loadWorkspaces(): Workspace[] {
  const stored = readJson<unknown[]>(KEY_WORKSPACES, []);
  return Array.isArray(stored) ? stored.filter(isValidWorkspace) : [];
}

export function saveWorkspaces(workspaces: Workspace[]) {
  writeJson(KEY_WORKSPACES, workspaces);
}

export function loadCurrentWorkspaceId(): string | null {
  const v = readJson<string>(KEY_CURRENT_WS, "");
  return v || null;
}

export function saveCurrentWorkspaceId(id: string | null) {
  if (id === null) {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(KEY_CURRENT_WS);
      } catch {}
    }
    return;
  }
  writeJson(KEY_CURRENT_WS, id);
}

/** v1 全局数据迁移：把旧便签搬到首个工作区。返回是否有需要迁移的实质数据 */
export function migrateLegacyData(targetWorkspaceId: string): boolean {
  if (typeof window === "undefined") return false;
  const legacyNotes = readJson<unknown[]>(V1 + "notes", []);
  const legacyCats = readJson<unknown[]>(V1 + "categories", []);
  const legacyLastType = readJson<string>(V1 + "lastType", "");
  const notes = Array.isArray(legacyNotes)
    ? legacyNotes.filter(isValidNote)
    : [];
  if (notes.length === 0) return false;

  const defaults = [...DEFAULT_CATEGORIES];
  const custom = normalizeCategories(Array.isArray(legacyCats) ? legacyCats : []);
  for (const c of custom) {
    if (!defaults.some((d) => d.id === c.id)) defaults.push(c);
  }
  saveCategories(targetWorkspaceId, defaults);
  saveNotes(targetWorkspaceId, notes);
  if (legacyLastType && defaults.some((c) => c.id === legacyLastType)) {
    saveLastTypeId(targetWorkspaceId, legacyLastType);
  }
  try {
    [V1 + "notes", V1 + "categories", V1 + "lastType"].forEach((k) =>
      window.localStorage.removeItem(k)
    );
  } catch {}
  return true;
}

/* ---------------- workspace-scoped data ---------------- */

export function loadCategories(workspaceId: string): Category[] {
  const raw = readJsonOrNull(wsKey(workspaceId, "categories"));
  // 该工作区从未写入过分类时才播种默认分类；用户删除过的分类不会被重新加回
  if (raw === null || !Array.isArray(raw)) {
    return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  }
  return normalizeCategories(raw);
}

export function saveCategories(workspaceId: string, categories: Category[]) {
  writeJson(wsKey(workspaceId, "categories"), categories);
}

export function loadNotes(workspaceId: string): Note[] {
  const stored = readJson<unknown[]>(wsKey(workspaceId, "notes"), []);
  return Array.isArray(stored) ? normalizeNotes(stored) : [];
}

export function saveNotes(workspaceId: string, notes: Note[]) {
  writeJson(wsKey(workspaceId, "notes"), notes);
}

export function loadLastTypeId(workspaceId: string): string | null {
  const v = readJson<string>(wsKey(workspaceId, "lastType"), "");
  return v || null;
}

export function saveLastTypeId(workspaceId: string, id: string) {
  writeJson(wsKey(workspaceId, "lastType"), id);
}

export type ViewMode = "list" | "kanban";

export function loadViewMode(workspaceId: string): ViewMode {
  const v = readJson<string>(wsKey(workspaceId, "viewMode"), "");
  return v === "kanban" ? "kanban" : "list";
}

export function saveViewMode(workspaceId: string, mode: ViewMode) {
  writeJson(wsKey(workspaceId, "viewMode"), mode);
}

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

const KEY_BEAM = V2 + "beam";
const DEFAULT_BEAM: BeamSettings = { variant: "colorful", duration: 3, enabled: true };

export function loadBeamSettings(): BeamSettings {
  const raw = readJson<Partial<BeamSettings>>(KEY_BEAM, {} as Partial<BeamSettings>);
  const v = BEAM_VARIANTS.includes(raw.variant as BeamVariant) ? (raw.variant as BeamVariant) : DEFAULT_BEAM.variant;
  const d = typeof raw.duration === "number" && Number.isFinite(raw.duration) ? Math.min(5, Math.max(0.6, raw.duration)) : DEFAULT_BEAM.duration;
  const enabled = typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_BEAM.enabled;
  return { variant: v, duration: d, enabled };
}

export function saveBeamSettings(s: BeamSettings) {
  writeJson(KEY_BEAM, s);
}

export function deleteWorkspaceData(workspaceId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(wsKey(workspaceId, "categories"));
    localStorage.removeItem(wsKey(workspaceId, "notes"));
    localStorage.removeItem(wsKey(workspaceId, "lastType"));
    localStorage.removeItem(wsKey(workspaceId, "viewMode"));
  } catch {}
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

"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowRightIcon,
  CheckIcon,
  LayersIcon,
  RocketIcon,
} from "lucide-react";
import {
  DEFAULT_CATEGORIES,
  type Workspace,
} from "@/lib/notes";
import type { CloudUser } from "@/lib/cloud";
import type { Options as ConfettiOptions } from "canvas-confetti";
import { AuthCard } from "@/components/spark/auth-card";
import { CategoryChip } from "@/components/spark/category-chip";
import { Confetti } from "@/components/ui/confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STEPS = ["登录 / 注册", "创建工作区", "欢迎"] as const;

/** 彩带发射参数；模块级常量以保持引用稳定 */
const WELCOME_CONFETTI: ConfettiOptions = {
  particleCount: 150,
  spread: 100,
  origin: { y: 0.6 },
};

interface WelcomeStepperProps {
  user: CloudUser | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  workspaces: Workspace[];
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string) => void;
  currentWorkspaceId: string | null;
  currentWorkspaceName: string | null;
  onComplete: () => void;
}

/**
 * 仿 Windows OOBE 的首次使用引导；界面不可自行关闭。
 * 注意：第 1 步中「登录」成功即视为老用户直达主应用，仅注册继续走完整流程
 * （复用逻辑在 AuthCard 的 onSuccess 分支），这是分流的关键约束。
 */
export function WelcomeStepper({
  user,
  onLogin,
  onRegister,
  workspaces,
  onSelectWorkspace,
  onCreateWorkspace,
  currentWorkspaceId,
  currentWorkspaceName,
  onComplete,
}: WelcomeStepperProps) {
  // 已登录（例如退出后重新引导）直接从工作区步骤开始
  const [step, setStep] = useState(user ? 1 : 0);
  const [creating, setCreating] = useState(false);

  return (
    <div className="grid min-h-dvh place-items-center bg-muted/40 p-4 sm:p-8">
      <div className="flex w-full max-w-[52rem] flex-col overflow-hidden rounded-2xl bg-popover shadow-2xl ring-1 ring-foreground/10 md:grid md:grid-cols-[2fr_3fr]">
        <aside className="relative hidden overflow-hidden bg-zinc-950 p-10 text-white md:flex md:flex-col">
          <div
            aria-hidden
            className="absolute -top-24 -left-16 size-72 rounded-full bg-indigo-500/20 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute top-1/3 left-1/2 size-64 -translate-x-1/2 rounded-full bg-sky-400/10 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute right-[-4rem] bottom-[-6rem] size-80 rounded-full bg-fuchsia-500/10 blur-3xl"
          />
          <Image
            src="/favicon.svg"
            alt=""
            width={64}
            height={61}
            className="relative size-14 drop-shadow-lg"
          />
          <h1 className="relative mt-6 text-3xl font-bold tracking-tight text-white">
            Spark
          </h1>
          <p className="relative mt-3 max-w-56 text-sm leading-relaxed text-zinc-400">
            搜索框即入口的轻量便签速记工具
          </p>
          <ul className="relative mt-auto flex flex-col gap-3 pt-10 text-sm text-zinc-300">
            {[
              "灵感、待办、想法与日记一站速记",
              "多工作区数据隔离，公私分明",
              "登录即云同步，多设备无缝衔接",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <CheckIcon className="size-3" />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </aside>

        {/* 右侧分步控件。min-w-0 允许作为 grid 子项正常收缩 */}
        <section className="flex min-h-[32rem] min-w-0 flex-col px-6 py-6 sm:px-8 sm:py-7">
            <header className="flex items-center gap-3">
            <ol className="flex items-center gap-1.5" aria-label="引导进度">
              {STEPS.map((label, i) => (
                <li key={label} className="flex items-center gap-1.5">
                  <span
                    aria-current={i === step ? "step" : undefined}
                    title={label}
                    className={cn(
                      "size-2 rounded-full transition-colors",
                      i === step
                        ? "bg-primary"
                        : i < step
                          ? "bg-primary/50"
                          : "bg-muted-foreground/25"
                    )}
                  />
                  {i < STEPS.length - 1 && (
                    <span className="w-3 border-t border-border" aria-hidden />
                  )}
                </li>
              ))}
            </ol>
            <p className="ml-auto text-xs text-muted-foreground">
              第 {Math.min(step + 1, STEPS.length)} 步 · 共 {STEPS.length} 步
            </p>
          </header>

          {/* px/-mx 留出 focus 光环的空间，避免聚焦时浏览器滚动裁剪左右两侧 */}
          <div className="-mx-1 mt-7 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1">
            <h2 className="text-lg font-medium">
              {STEPS[Math.min(step, STEPS.length - 1)]}
            </h2>
            <p className="mt-1.5 mb-6 text-sm leading-relaxed text-muted-foreground">
              {step === 0 && "Spark 账号用于云端同步，同一账号可在多设备使用"}
              {step === 1 &&
                "每个工作区都是独立的笔记空间，其中的分类与便签互不共享"}
              {step === 2 && "一切就绪，可以开始记录了"}
            </p>

            {step === 0 &&
              (user ? (
                /* 已登录（退出后重新引导）无需再走鉴权步骤 */
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    当前账号 {user.email} 已登录，继续完成剩余步骤即可。
                  </p>
                  <Button
                    className="self-start"
                    onClick={() => setStep(1)}
                  >
                    下一步
                    <ArrowRightIcon />
                  </Button>
                </div>
              ) : (
                <AuthCard
                  onLogin={onLogin}
                  onRegister={onRegister}
                  // 登录用户注册时已走完引导，直接进入应用；仅新注册继续分步流程
                  onSuccess={(mode) =>
                    mode === "register" ? setStep(1) : onComplete()
                  }
                />
              ))}

            {step === 1 && (
              <div className="flex flex-col gap-3">
                {workspaces.length > 0 && (
                  <ul className="-mx-1 max-h-44 overflow-y-auto overscroll-contain px-1">
                    {workspaces.map((ws) => {
                      const chosen = ws.id === currentWorkspaceId;
                      return (
                        <li key={ws.id}>
                          <button
                            type="button"
                            aria-current={chosen ? "true" : undefined}
                            onClick={() => onSelectWorkspace(ws.id)}
                            className={cn(
                              "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                              chosen
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent/50"
                            )}
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <LayersIcon className="size-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm">
                              {ws.name}
                            </span>
                            {chosen ? (
                              <CheckIcon className="size-4 shrink-0 text-primary" />
                            ) : (
                              <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {creating ? (
                  <CreateWsForm
                    onCancel={() => setCreating(false)}
                    onCreate={(name) => {
                      onCreateWorkspace(name);
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
                    新建工作区
                  </Button>
                )}

                <div className="rounded-lg bg-muted/50 px-3.5 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    新工作区会预置以下常用分类：
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {DEFAULT_CATEGORIES.map((c) => (
                      <CategoryChip key={c.id} category={c} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
                <Confetti
                  className="pointer-events-none fixed inset-0 z-50 size-full"
                  options={WELCOME_CONFETTI}
                />
                <span className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-indigo-500 to-pink-500 shadow-lg">
                  <RocketIcon className="size-7 text-white" />
                </span>
                <p className="text-base font-medium">一切就绪！</p>
                <Button size="lg" className="mt-2" onClick={onComplete}>
                  开始记录
                  <ArrowRightIcon />
                </Button>
              </div>
            )}
          </div>

              {step === 1 && (
            <footer className="mt-5 flex justify-end">
              <Button
                disabled={!currentWorkspaceName}
                onClick={() => setStep(2)}
              >
                下一步
                <ArrowRightIcon />
              </Button>
            </footer>
          )}
        </section>
      </div>
    </div>
  );
}

function CreateWsForm({
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

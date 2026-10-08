"use client";

import { useState } from "react";
import { ChevronRightIcon, LayersIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/notes";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WorkspaceOnboardingProps {
  workspaces: Workspace[];
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
}

export function WorkspaceOnboarding({
  workspaces,
  onSelect,
  onCreate,
}: WorkspaceOnboardingProps) {
  const [name, setName] = useState("");
  const valid = name.trim().length > 0;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid) return;
    onCreate(name);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/favicon.svg"
            alt="Spark logo"
            width={56}
            height={56}
            priority
            className="size-14 drop-shadow-md"
          />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">
            欢迎使用 Spark
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            每个工作区都是独立的笔记空间，可随时切换
          </p>
        </div>

        {workspaces.length > 0 && (
          <>
            <p className="mt-6 mb-2 text-xs font-medium text-muted-foreground">
              选择已有工作区
            </p>
            <ul className="flex flex-col gap-1.5">
              {workspaces.map((ws) => (
                <li key={ws.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(ws.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 text-left text-sm transition-colors outline-none",
                      "hover:border-border hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <LayersIcon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{ws.name}</span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground/70">
              <span className="h-px flex-1 bg-border" />
              或新建一个
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className={cn(workspaces.length === 0 && "mt-6")}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="工作区名称，如：工作、生活"
            maxLength={16}
            autoFocus
          />
          <Button type="submit" disabled={!valid} className="mt-3 w-full">
            创建工作区
          </Button>
        </form>
      </div>

      <p className="mt-6 text-xs text-muted-foreground/60">
        © {new Date().getFullYear()} Spark
      </p>
    </main>
  );
}

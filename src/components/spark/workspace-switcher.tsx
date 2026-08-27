"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  LayersIcon,
  PlusIcon,
  Settings2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/notes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  currentId: string;
  className?: string;
  onSelect: (id: string) => void;
  /** 点击「新建工作区…」，由父级打开控制面板并展开新建表单 */
  onCreateClick: () => void;
  onManage?: () => void;
}

export function WorkspaceSwitcher({
  workspaces,
  currentId,
  className,
  onSelect,
  onCreateClick,
  onManage,
}: WorkspaceSwitcherProps) {
  const current = workspaces.find((w) => w.id === currentId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 rounded-full bg-card/80 pl-2.5 pr-2 shadow-sm backdrop-blur",
            className
          )}
        >
          <LayersIcon className="size-3.5 text-muted-foreground" />
          <span className="max-w-[9rem] truncate">
            {current?.name ?? "选择工作区"}
          </span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>切换工作区</DropdownMenuLabel>
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => onSelect(ws.id)}
            className={cn(ws.id === currentId && "font-medium")}
          >
            <LayersIcon className="size-4" />
            <span className="min-w-0 flex-1 truncate">{ws.name}</span>
            {ws.id === currentId && (
              <CheckIcon className="ml-auto size-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreateClick}>
          <PlusIcon className="size-4" />
          新建工作区…
        </DropdownMenuItem>
        {onManage && (
          <DropdownMenuItem onClick={onManage}>
            <Settings2Icon className="size-4" />
            管理工作区…
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

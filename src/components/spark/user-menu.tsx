"use client";

import {
  CircleCheckIcon,
  CircleAlertIcon,
  LogInIcon,
  LogOutIcon,
  RefreshCwIcon,
  Settings2Icon,
  UserRoundIcon,
} from "lucide-react";
import type { CloudStatus } from "@/hooks/use-cloud-sync";
import type { CloudUser } from "@/lib/cloud";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/notes";

interface UserMenuProps {
  user: CloudUser | null;
  status: CloudStatus;
  lastSyncedAt: number | null;
  onLoginClick: () => void;
  onManualSync: () => void;
  onLogout: () => void;
  /** 打开控制面板（账号分区） */
  onSettingsClick: () => void;
}

export const STATUS_TEXT: Record<CloudStatus, string> = {
  idle: "已连接云端",
  syncing: "正在同步…",
  ok: "刚刚已同步",
  error: "同步失败",
};

export function UserMenu({
  user,
  status,
  lastSyncedAt,
  onLoginClick,
  onManualSync,
  onLogout,
  onSettingsClick,
}: UserMenuProps) {
  if (!user) {
    return (
      <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full bg-card/80 shadow-sm backdrop-blur" onClick={onLoginClick}>
        <LogInIcon className="size-3.5 text-muted-foreground" />
        登录
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="账号菜单"
          title={user.email}
          className="rounded-full bg-card/80 shadow-sm backdrop-blur"
        >
          <UserRoundIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <div
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground"
          role="status"
        >
          {status === "syncing" ? (
            <RefreshCwIcon className="size-3 animate-spin" />
          ) : status === "error" ? (
            <CircleAlertIcon className="size-3 text-destructive" />
          ) : (
            <CircleCheckIcon className="size-3 text-green-600" />
          )}
          {STATUS_TEXT[status]}
          {lastSyncedAt && status !== "syncing"
            ? ` · ${formatTime(lastSyncedAt)}`
            : ""}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onManualSync}>
          <RefreshCwIcon className="size-4" />
          立即同步
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSettingsClick}>
          <Settings2Icon className="size-4" />
          控制面板…
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void onLogout();
          }}
        >
          <LogOutIcon className="size-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

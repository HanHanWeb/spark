"use client";

import { CheckIcon, ChevronDownIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/notes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryChip } from "@/components/spark/category-chip";

interface CategorySwitcherProps {
  categories: Category[];
  /** 各分类的便签数量 */
  counts: Record<string, number>;
  /** 当前选中分类 id */
  currentId?: string;
  /**
   * 嵌入搜索框内部的紧凑形态：去掉胶囊外壳与箭头，
   * 保持与搜索框一体的层级关系；默认为独立胶囊样式
   */
  embedded?: boolean;
  className?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onManage: () => void;
}

/** 与 WorkspaceSwitcher 同设计的分类切换器 */
export function CategorySwitcher({
  categories,
  counts,
  currentId,
  embedded = false,
  className,
  onSelect,
  onNew,
  onManage,
}: CategorySwitcherProps) {
  const current = categories.find((c) => c.id === currentId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {embedded ? (
          // 嵌入态：无壳、透明、不带任何自身间距。
          // 与搜索框四壁的距离由宿主容器（InputGroupAddon）统一提供
          <button
            type="button"
            aria-label="选择分类"
            title={current?.name}
            className="flex cursor-text select-none items-center gap-0 rounded-md text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {current ? (
              <CategoryChip category={current} />
            ) : (
              <span className="text-muted-foreground">选择分类</span>
            )}
          </button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            aria-label="选择分类"
            title={current?.name}
            className={cn(
              "h-8 max-w-[11rem] gap-1.5 rounded-full bg-card/80 px-2 shadow-sm backdrop-blur",
              className
            )}
          >
            {current ? (
              <CategoryChip category={current} />
            ) : (
              <span className="text-muted-foreground">选择分类</span>
            )}
            <ChevronDownIcon className="size-3.5 text-muted-foreground" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>记录到</DropdownMenuLabel>
        {categories.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(c.id === currentId && "font-medium")}
          >
            <CategoryChip category={c} />
            <span className="min-w-0 flex-1" />
            <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">
              {counts[c.id] ?? 0}
            </Badge>
            {c.id === currentId && (
              <CheckIcon className="size-4 shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onNew}>
          <PlusIcon className="size-4" />
          新建分类…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onManage}>
          <Settings2Icon className="size-4" />
          管理分类…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

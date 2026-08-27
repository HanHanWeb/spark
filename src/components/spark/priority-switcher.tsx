"use client";

import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITY_OPTIONS, type Priority } from "@/lib/notes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityChip } from "@/components/spark/priority-chip";

export function PrioritySwitcher({
  value,
  onSelect,
  embedded = false,
}: {
  value: Priority;
  onSelect: (v: Priority) => void;
  embedded?: boolean;
}) {
  const current = PRIORITY_OPTIONS.find((o) => o.id === value) ?? PRIORITY_OPTIONS[1];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {embedded ? (
          <button
            type="button"
            aria-label="选择优先级"
            title={`优先级：${current.label}`}
            className="flex cursor-pointer select-none items-center gap-0 rounded-full text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <PriorityChip priority={value} className="text-xs" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="选择优先级"
            className={cn(
              "inline-flex items-center gap-1 rounded-full border bg-card px-2 py-1 text-xs shadow-sm",
              "hover:bg-accent"
            )}
          >
            <PriorityChip priority={value} />
            <ChevronDownIcon className="size-3 text-muted-foreground" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        <DropdownMenuLabel>优先级</DropdownMenuLabel>
        {PRIORITY_OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.id}
            onClick={() => onSelect(o.id)}
            className={cn("gap-2", value === o.id && "font-medium")}
          >
            <span className={cn("size-2 rounded-full", o.dot)} />
            <span className="flex-1">{o.label}</span>
            <span
              className={cn(
                "rounded-full border px-1.5 py-0.5 text-[10px]",
                o.pill
              )}
            >
              {o.label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

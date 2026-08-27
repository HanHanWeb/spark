import { cn } from "@/lib/utils";
import { getPriorityPill, getPriorityLabel, type Priority } from "@/lib/notes";

export function PriorityChip({
  priority,
  className,
  withDot = true,
}: {
  priority?: Priority;
  className?: string;
  withDot?: boolean;
}) {
  const label = getPriorityLabel(priority);
  const pill = getPriorityPill(priority);
  // 淡红到深红三阶：dot 颜色与 pill 背景呼应
  const dotClass =
    priority === "high" ? "bg-white/90" : priority === "low" ? "bg-red-400" : "bg-red-500";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        pill,
        className
      )}
    >
      {withDot && <span className={cn("size-1.5 rounded-full", dotClass)} aria-hidden />}
      {label}
    </span>
  );
}

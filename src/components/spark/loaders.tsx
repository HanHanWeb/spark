import { Spinner } from "@/components/ui/spinner";

/** 页面级懒加载占位：居中 spinner + 可选文案 */
export function PageLoader({ label = "加载中…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
    >
      <Spinner className="size-6 text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/** 区块级懒加载占位：适合嵌在局部容器中 */
export function BlockLoader({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label ?? "加载中"}
      className="flex flex-col items-center justify-center gap-2 py-14 text-muted-foreground"
    >
      <Spinner className="size-5" />
      {label ? <p className="text-xs">{label}</p> : null}
    </div>
  );
}

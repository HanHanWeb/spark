import { cn } from "@/lib/utils";
import { getPill, type Category } from "@/lib/notes";
import { CategoryIcon } from "@/components/spark/category-icon";

export function CategoryChip({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        getPill(category.color),
        className
      )}
    >
      <CategoryIcon name={category.icon} className="size-3" />
      {category.name}
    </span>
  );
}

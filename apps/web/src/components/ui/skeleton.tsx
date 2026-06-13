import type { HTMLAttributes } from "react";
import { cn } from "./utils";

export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("skeleton-shimmer rounded-[var(--radius-md)]", className)} {...props} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Đang tải dữ liệu">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton className="h-12 w-full" key={index} />
      ))}
    </div>
  );
}

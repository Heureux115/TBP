import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

type PageContainerSize = "default" | "narrow" | "wide";

const sizeClasses: Record<PageContainerSize, string> = {
  default: "max-w-none",
  narrow: "max-w-[960px]",
  wide: "max-w-none",
};

export function PageContainer({
  children,
  className = "",
  size = "default",
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  size?: PageContainerSize;
}) {
  return (
    <main
      className={cn("tc-flow-safe mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 md:px-10 md:py-8", sizeClasses[size], className)}
      {...props}
    >
      {children}
    </main>
  );
}

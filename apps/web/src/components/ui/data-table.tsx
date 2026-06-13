import type { ReactNode, TableHTMLAttributes } from "react";
import { cn } from "./utils";

export function DataTable({
  children,
  className = "",
  tableClassName = "",
  ...props
}: TableHTMLAttributes<HTMLTableElement> & { tableClassName?: string }) {
  return (
    <div className={cn("min-w-0 max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--outline-variant)] bg-white shadow-[var(--shadow-panel)]", className)}>
      <p className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-2 text-xs font-bold text-[var(--on-surface-variant)] md:hidden">
        Vuốt ngang để xem đầy đủ bảng.
      </p>
      <div aria-label="Bảng dữ liệu có thể cuộn ngang" className="overflow-x-auto overscroll-x-contain focus:shadow-[var(--focus-ring)] focus:outline-none" role="region" tabIndex={0}>
        <table className={cn("w-full min-w-max text-left [&_td]:align-top [&_th]:whitespace-nowrap", tableClassName)} {...props}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-[var(--surface-container-low)] text-xs font-bold uppercase tracking-wide text-[var(--on-surface-variant)]">{children}</thead>;
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-[var(--outline-variant)]/60">{children}</tbody>;
}

export function DataTableEmpty({ children, colSpan }: { children: ReactNode; colSpan: number }) {
  return (
    <tr>
      <td className="px-5 py-10 text-center text-sm text-[var(--on-surface-variant)]" colSpan={colSpan}>
        {children}
      </td>
    </tr>
  );
}

import { cn } from "./utils";

export function Icon({
  className = "",
  fill = false,
  label,
  name,
}: {
  className?: string;
  fill?: boolean;
  label?: string;
  name: string;
}) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("material-symbols-outlined shrink-0", fill && "icon-fill", className)}
      role={label ? "img" : undefined}
    >
      {name}
    </span>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

type ButtonVariant = "danger" | "ghost" | "outline" | "payment" | "primary" | "secondary" | "success";
type ButtonSize = "icon" | "lg" | "md" | "sm";

const variantClasses: Record<ButtonVariant, string> = {
  danger: "border border-[var(--error)]/30 bg-white text-[var(--error)] hover:bg-[var(--error-container)] focus-visible:shadow-[var(--focus-ring)]",
  ghost: "bg-transparent text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)] focus-visible:shadow-[var(--focus-ring)]",
  outline: "border border-[var(--outline-variant)] bg-white text-[var(--primary)] hover:border-[var(--primary)] hover:bg-[var(--surface-container-low)] focus-visible:shadow-[var(--focus-ring)]",
  payment: "bg-[var(--secondary-container)] text-[var(--on-secondary-container)] shadow-[var(--shadow-panel)] hover:bg-[var(--secondary)] hover:text-[var(--on-secondary)] focus-visible:shadow-[var(--focus-ring)]",
  primary: "bg-[var(--primary)] text-[var(--on-primary)] shadow-[var(--shadow-panel)] hover:bg-[var(--primary-container)] focus-visible:shadow-[var(--focus-ring)]",
  secondary: "bg-[var(--surface-container-high)] text-[var(--primary)] hover:bg-[var(--primary-fixed)] focus-visible:shadow-[var(--focus-ring)]",
  success: "bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] shadow-[var(--shadow-panel)] hover:bg-[var(--tertiary)] focus-visible:shadow-[var(--focus-ring)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  icon: "h-11 w-11 p-0",
  lg: "min-h-12 px-5 py-3 text-base",
  md: "min-h-11 px-4 py-2.5 text-sm",
  sm: "min-h-11 px-3 py-2 text-xs",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className = "",
  disabled,
  isLoading = false,
  leftIcon,
  rightIcon,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-w-0 items-center justify-center gap-2 rounded-[var(--radius-md)] text-center font-bold transition-[background-color,border-color,color,box-shadow,opacity] duration-[var(--duration-base)] ease-[var(--ease-out)] disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : leftIcon}
      <span className="tc-text-safe min-w-0">{children}</span>
      {rightIcon}
    </button>
  );
}

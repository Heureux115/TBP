"use client";

import type { KeyboardEvent, ReactNode, RefObject, TextareaHTMLAttributes } from "react";
import { useEffect, useId, useRef } from "react";
import { Button } from "./button";
import { cn } from "./utils";

const focusableSelector = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

export function Dialog({
  children,
  className = "",
  closeOnBackdrop = true,
  closeOnEscape = true,
  description,
  initialFocusRef,
  onClose,
  open,
  role = "dialog",
  title,
}: {
  children: ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  description?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  open: boolean;
  role?: "alertdialog" | "dialog";
  title: string;
}) {
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      const target =
        initialFocusRef?.current ||
        panel.querySelector<HTMLElement>("[data-dialog-initial-focus]") ||
        panel.querySelector<HTMLElement>(focusableSelector) ||
        panel;

      target.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus({ preventScroll: true });
      previouslyFocusedRef.current = null;
    };
  }, [initialFocusRef, open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && closeOnEscape) {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const panel = panelRef.current;
    if (!panel) return;

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
      (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
    );

    if (!focusable.length) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[var(--z-dialog-backdrop)] flex items-end justify-center overflow-y-auto bg-black/45 px-4 py-4 sm:items-center sm:py-6"
      onKeyDown={handleKeyDown}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <button
        aria-label="Đóng hộp thoại"
        className="absolute inset-0 cursor-default"
        disabled={!closeOnBackdrop}
        onClick={onClose}
        type="button"
      />
      <section
        className={cn(
          "relative z-[var(--z-dialog)] max-h-[min(90dvh,720px)] w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-dialog)] outline-none",
          className,
        )}
        ref={panelRef}
        tabIndex={-1}
      >
        <header className="border-b border-[var(--outline-variant)] px-6 py-5">
          <h2 className="text-xl font-black text-[var(--on-surface)]" id={titleId}>
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-[var(--on-surface-variant)]" id={descriptionId}>
              {description}
            </p>
          ) : null}
        </header>
        <div className="max-h-[calc(min(90dvh,720px)-88px)] overflow-y-auto">{children}</div>
      </section>
    </div>
  );
}

export function ConfirmDialog({
  cancelLabel = "Giữ lại",
  confirmLabel,
  description,
  isBusy = false,
  onCancel,
  onConfirm,
  open,
  title,
  tone = "danger",
}: {
  cancelLabel?: string;
  confirmLabel: string;
  description: string;
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  tone?: "danger" | "primary";
}) {
  return (
    <Dialog
      closeOnBackdrop={!isBusy}
      closeOnEscape={!isBusy}
      description={description}
      onClose={onCancel}
      open={open}
      role={tone === "danger" ? "alertdialog" : "dialog"}
      title={title}
    >
      <footer className="grid grid-cols-2 gap-3 bg-[var(--surface-container-low)] p-4">
        <Button data-dialog-initial-focus onClick={onCancel} variant="outline">
          {cancelLabel}
        </Button>
        <Button isLoading={isBusy} onClick={onConfirm} variant={tone === "danger" ? "danger" : "primary"}>
          {confirmLabel}
        </Button>
      </footer>
    </Dialog>
  );
}

export function PromptDialog({
  cancelLabel = "Huy",
  confirmLabel,
  description,
  isBusy = false,
  label,
  onCancel,
  onConfirm,
  open,
  textareaProps,
  title,
  value,
}: {
  cancelLabel?: string;
  confirmLabel: string;
  description: string;
  isBusy?: boolean;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  textareaProps?: TextareaHTMLAttributes<HTMLTextAreaElement>;
  title: string;
  value: string;
}) {
  return (
    <Dialog closeOnBackdrop={!isBusy} closeOnEscape={!isBusy} description={description} onClose={onCancel} open={open} title={title}>
      <div className="p-6">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-[var(--on-surface)]">{label}</span>
          <textarea
            className="min-h-28 w-full resize-y rounded-[var(--radius-md)] border border-[var(--outline-variant)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] focus:shadow-[var(--focus-ring)]"
            data-dialog-initial-focus
            value={value}
            {...textareaProps}
          />
        </label>
      </div>
      <footer className="grid grid-cols-2 gap-3 bg-[var(--surface-container-low)] p-4">
        <Button onClick={onCancel} variant="outline">
          {cancelLabel}
        </Button>
        <Button isLoading={isBusy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </footer>
    </Dialog>
  );
}

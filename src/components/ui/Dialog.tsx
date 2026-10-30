"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  title,
  description,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the focus effect (callers often pass a new function each render).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Focus moves into the dialog on open, Tab stays inside it, and focus returns to the opener on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    // Start on the first field, not the × button, so keyboard users land where they type.
    const candidates = Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = candidates.find((el) => el.getAttribute("aria-label") !== "Close") ?? candidates[0];
    (first ?? panel.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full rounded-xl border border-line bg-surface p-5 sm:p-6 ${wide ? "max-w-3xl" : "max-w-xl"}`}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-2 text-2xl leading-none text-muted hover:text-ink"
        >
          ×
        </button>
        <h2 id={titleId} className="pr-8 font-display text-xl font-semibold">
          {title}
        </h2>
        {description && <div className="mt-1 text-sm text-muted">{description}</div>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

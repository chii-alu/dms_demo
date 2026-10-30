"use client";

import { useEffect, useId, type ReactNode } from "react";

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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

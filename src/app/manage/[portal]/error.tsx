"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ManageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex max-w-xl flex-col gap-3">
      <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted">The page could not be loaded. Your changes are safe if you saw a success message before this. Try again, or go back to the overview.</p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-surface">
          Try again
        </button>
        <Link href="/manage" className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium">
          Overview
        </Link>
      </div>
    </div>
  );
}

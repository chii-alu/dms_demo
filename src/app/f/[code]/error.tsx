"use client";

export default function PublicFormError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="font-display text-2xl font-semibold">This form could not be loaded</h1>
      <p className="mt-2 text-muted">Check your connection and try again.</p>
      <button type="button" onClick={reset} className="mt-4 rounded-md border border-accent bg-accent px-3 py-2 text-sm font-medium text-surface">
        Try again
      </button>
    </main>
  );
}

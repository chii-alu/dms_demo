export default function ManageLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4 animate-pulse">
      <div className="h-8 w-64 rounded-md bg-sunk" />
      <div className="h-4 w-96 max-w-full rounded-md bg-sunk" />
      <div className="mt-4 h-48 rounded-[10px] bg-sunk" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

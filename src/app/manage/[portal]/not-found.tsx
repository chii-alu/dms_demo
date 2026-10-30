import Link from "next/link";

export default function ManageNotFound() {
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <h1 className="font-display text-2xl font-semibold">We could not find that page</h1>
      <p className="text-muted">It may have been deleted, or the link may be wrong. You may also not have access to it.</p>
      <Link href="/manage" className="w-fit rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium">
        Back to the overview
      </Link>
    </div>
  );
}

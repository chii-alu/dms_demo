import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="font-display text-4xl font-semibold">MELA</h1>
        <p className="mt-2 text-muted">Monitoring, evaluation, learning and adaptation across HECO, HENT and HEMP.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/manage" className="rounded-[10px] border border-line bg-surface p-5 hover:border-muted">
          <h2 className="font-display text-xl font-semibold">Manage</h2>
          <p className="mt-1 text-sm text-muted">Interventions, sessions, forms, registrations and attendance.</p>
        </Link>
        <Link href="/dashboard" className="rounded-[10px] border border-line bg-surface p-5 hover:border-muted">
          <h2 className="font-display text-xl font-semibold">Dashboard</h2>
          <p className="mt-1 text-sm text-muted">Reach, inclusion and quality indicators.</p>
        </Link>
      </div>
    </main>
  );
}

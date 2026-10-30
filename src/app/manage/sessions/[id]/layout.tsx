import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange, todayIso } from "@/lib/dates";
import { sessionStatus } from "@/lib/rules/session-status";
import { PillarChip, StatusChip, TypeChip } from "@/components/manage/Chips";
import { SessionTabs } from "@/components/manage/SessionTabs";

export default async function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("sessions")
    .select("id, title, pillar, kind, dates, mode, venue, capacity, application_deadline, interventions(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  const iv = s.interventions as unknown as { id: string; name: string };
  const selective = s.kind === "application";
  const status = sessionStatus(s.dates, todayIso());
  const meta = [
    formatDateRange(s.dates),
    s.mode,
    s.venue,
    s.capacity ? `${s.capacity} places` : null,
    selective && s.application_deadline ? `applications close ${s.application_deadline}` : null,
  ].filter(Boolean);

  return (
    <section>
      <nav className="flex flex-wrap gap-1.5 text-sm text-muted">
        <Link href="/manage" className="text-accent hover:underline">Overview</Link>
        <span>/</span>
        <span>{s.pillar}</span>
        <span>/</span>
        <Link href={`/manage/interventions/${iv.id}`} className="text-accent hover:underline">{iv.name}</Link>
      </nav>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PillarChip pillar={s.pillar} />
        <TypeChip type={selective ? "selective" : "open"} />
        <StatusChip status={status} />
      </div>
      <h1 className="mt-2 font-display text-3xl font-semibold">{s.title}</h1>
      <p className="mt-1 text-muted">{meta.join(" · ")}</p>

      <SessionTabs sessionId={s.id} selective={selective} />
      <div className="mt-6">{children}</div>
    </section>
  );
}

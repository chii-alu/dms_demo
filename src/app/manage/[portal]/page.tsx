import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange, todayIso } from "@/lib/dates";
import { sessionStatus } from "@/lib/rules/session-status";
import { needsAttention, type AttentionSession } from "@/lib/rules/attention";
import { PillarChip, StatusChip } from "@/components/manage/Chips";
import { card } from "@/components/ui/styles";
import { pillarsForPortal, isPortal } from "@/lib/auth/portals";

const TONE: Record<"accent" | "warn" | "bad", string> = {
  accent: "var(--accent)",
  warn: "var(--warn)",
  bad: "var(--bad)",
};

type Row = {
  id: string;
  title: string;
  pillar: string;
  kind: "registration" | "application";
  dates: string[];
  interventions: { name: string };
  forms: { kind: string; code: string; status: "draft" | "open" | "closed" }[];
  entries: { status: string; participant_id: string }[];
  attendance: { date: string; participant_id: string }[];
  feedback: { id: string }[];
};

export default async function OverviewPage({ params }: { params: Promise<{ portal: string }> }) {
  const { portal: requested } = await params;
  if (!isPortal(requested)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, title, pillar, kind, dates, interventions(name), forms(kind, code, status), entries(status, participant_id), attendance(date, participant_id), feedback(id)",
    )
    .in("pillar", pillarsForPortal(requested));
  if (error) throw new Error(`Could not load sessions: ${error.message}`);

  const today = todayIso();
  const rows = (data ?? []) as unknown as Row[];
  const sorted = [...rows].sort((a, b) => [...b.dates].sort()[0]?.localeCompare([...a.dates].sort()[0] ?? "") ?? 0);

  const attention = needsAttention(
    rows.map<AttentionSession>((r) => {
      const selective = r.kind === "application";
      const eligibleStatus = selective ? "selected" : "registered";
      return {
        id: r.id,
        label: `${r.pillar} · ${r.title}`,
        selective,
        dates: r.dates,
        applied: r.entries.filter((e) => e.status === "applied").length,
        eligible: r.entries.filter((e) => e.status === eligibleStatus).length,
        intakeStatus: r.forms.find((f) => f.kind === "intake")?.status ?? "draft",
        feedbackStatus: r.forms.find((f) => f.kind === "feedback")?.status ?? "draft",
        attendanceDates: new Set(r.attendance.map((a) => a.date)),
      };
    }),
    today,
  );

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Overview</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Every intervention runs as a series of sessions. Each session gets its own forms, participant list, attendance and feedback, all linked to one participant registry.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {pillarsForPortal(requested).map((p) => {
          const ss = rows.filter((r) => r.pillar === p);
          const people = new Set(ss.flatMap((r) => r.entries.map((e) => e.participant_id))).size;
          const attendances = new Set(ss.flatMap((r) => r.attendance.map((a) => `${r.id}:${a.participant_id}`))).size;
          return (
            <div key={p} className={card} style={{ borderTop: `4px solid var(--${p.toLowerCase()})` }}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">{p}</h2>
                <PillarChip pillar={p} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Stat value={ss.length} label="sessions" />
                <Stat value={people} label="unique people" />
                <Stat value={attendances} label="attendances" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold">Needs attention</h2>
          <span className="text-sm text-muted">
            {attention.length} item{attention.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className={`${card} p-0`}>
          {attention.length === 0 ? (
            <div className="p-6 text-center text-muted">Nothing waiting. Every session is up to date.</div>
          ) : (
            <ul className="divide-y divide-line">
              {attention.map((a, i) => (
                <li key={i}>
                  <Link href={`/manage/${requested}/sessions/${a.sessionId}/${a.tab}`} className="flex items-start gap-3 p-4 hover:bg-sunk">
                    <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: TONE[a.tone] }} />
                    <span>
                      <span className="block font-semibold">{a.text}</span>
                      <span className="text-sm text-muted">{a.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-semibold">All sessions</h2>
        {sorted.length === 0 ? (
          <div className={`${card} text-center text-muted`}>No sessions yet. Open an intervention and create its first session.</div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-sunk text-left text-xs font-semibold text-muted">
                <tr>
                  <th className="px-3 py-2">Pillar</th>
                  <th className="px-3 py-2">Intervention</th>
                  <th className="px-3 py-2">Session</th>
                  <th className="px-3 py-2">Dates</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Reg. / apps</th>
                  <th className="px-3 py-2 text-right">Confirmed</th>
                  <th className="px-3 py-2 text-right">Attended</th>
                  <th className="px-3 py-2 text-right">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => {
                  const eligibleStatus = r.kind === "application" ? "selected" : "registered";
                  const intake = r.forms.find((f) => f.kind === "intake")?.code.replace(/-(REG|APP)$/, "");
                  return (
                    <tr key={r.id} className="border-t border-line hover:bg-sunk">
                      <td className="px-3 py-2"><PillarChip pillar={r.pillar} /></td>
                      <td className="px-3 py-2">{r.interventions.name}</td>
                      <td className="px-3 py-2">
                        <Link href={`/manage/${requested}/sessions/${r.id}/forms`} className="font-semibold text-accent hover:underline">{r.title}</Link>
                        {intake && <div className="font-mono text-xs text-muted">{intake}</div>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{formatDateRange(r.dates)}</td>
                      <td className="px-3 py-2"><StatusChip status={sessionStatus(r.dates, today)} /></td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.entries.length}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.entries.filter((e) => e.status === eligibleStatus).length}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{new Set(r.attendance.map((a) => a.participant_id)).size}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.feedback.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayIso, formatDateRange } from "@/lib/dates";
import { sessionStatus } from "@/lib/rules/session-status";
import { NewSessionDialog, type CopyOption } from "@/components/manage/NewSessionDialog";
import { TypeSelect } from "@/components/manage/TypeSelect";
import { PillarChip, StatusChip, TypeChip } from "@/components/manage/Chips";
import { card } from "@/components/ui/styles";

type SessionRow = {
  id: string;
  title: string;
  kind: "registration" | "application";
  dates: string[];
  mode: string | null;
  forms: { code: string; kind: string }[];
  entries: { count: number }[];
};

export default async function InterventionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: iv } = await supabase.from("interventions").select("id, name, pillar, type").eq("id", id).maybeSingle();
  if (!iv || !user) notFound();

  const { data: staff } = await supabase.from("staff_roles").select("role").eq("user_id", user.id).maybeSingle();
  const isAdmin = staff?.role === "admin";

  const { data: rows, error } = await supabase
    .from("sessions")
    .select("id, title, kind, dates, mode, forms(code, kind), entries(count)")
    .eq("intervention_id", iv.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load sessions: ${error.message}`);
  const sessions = (rows ?? []) as unknown as SessionRow[];

  const today = todayIso();
  const firstDate = (s: SessionRow) => [...s.dates].sort()[0] ?? "";
  const sorted = [...sessions].sort((a, b) => firstDate(b).localeCompare(firstDate(a)));
  const selective = iv.type === "selective";
  const registrations = sessions.reduce((n, s) => n + (s.entries[0]?.count ?? 0), 0);
  const upcoming = sessions.filter((s) => sessionStatus(s.dates, today) === "Upcoming").length;

  const { count: feedbackCount } = await supabase
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessions.map((s) => s.id));

  const copyOptions: CopyOption[] = sorted.map((s) => ({
    id: s.id,
    label: `${s.title} (${formatDateRange(s.dates).split(" · ")[0]})`,
  }));

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <PillarChip pillar={iv.pillar} />
            {isAdmin ? <TypeSelect interventionId={iv.id} type={iv.type} /> : <TypeChip type={iv.type} />}
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold">{iv.name}</h1>
          <p className="mt-2 max-w-2xl text-muted">
            {selective
              ? "Application → Selection → Attendance → Feedback."
              : "Registration → Attendance → Feedback."}{" "}
            Each new session gets its own copy of these forms, which you can then edit for that session.
          </p>
        </div>
        <NewSessionDialog
          interventionId={iv.id}
          interventionName={iv.name}
          pillar={iv.pillar}
          selective={selective}
          copyOptions={copyOptions}
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi value={sessions.length} label="sessions" />
        <Kpi value={registrations} label={selective ? "applications" : "registrations"} />
        <Kpi value={upcoming} label="upcoming" />
        <Kpi value={feedbackCount ?? 0} label="feedback responses" />
      </div>

      <h2 className="mt-8 font-display text-xl font-semibold">Sessions</h2>
      {sorted.length === 0 ? (
        <div className={`${card} mt-3 text-center text-muted`}>No sessions yet. Create the first one to generate its forms.</div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-[10px] border border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-sunk text-left text-xs font-semibold text-muted">
              <tr>
                <th className="px-3 py-2">Session</th>
                <th className="px-3 py-2">Dates</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Delivery</th>
                <th className="px-3 py-2 text-right">{selective ? "Applications" : "Registrations"}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const intakeCode = s.forms.find((f) => f.kind === "intake")?.code.replace(/-(REG|APP)$/, "");
                return (
                  <tr key={s.id} className="border-t border-line hover:bg-sunk">
                    <td className="px-3 py-2">
                      <Link href={`/manage/sessions/${s.id}/forms`} className="font-semibold text-accent hover:underline">
                        {s.title}
                      </Link>
                      {intakeCode && <div className="font-mono text-xs text-muted">{intakeCode}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{formatDateRange(s.dates)}</td>
                    <td className="px-3 py-2">
                      <StatusChip status={sessionStatus(s.dates, today)} />
                    </td>
                    <td className="px-3 py-2">{s.mode ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.entries[0]?.count ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Kpi({ value, label }: { value: number | string; label: string }) {
  return (
    <div className={card}>
      <div className="font-display text-3xl font-semibold tabular-nums">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

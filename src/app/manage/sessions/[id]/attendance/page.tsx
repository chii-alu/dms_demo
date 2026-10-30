import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/dates";
import { AttendanceView, type EligibleRow, type AttendanceRecord } from "@/components/manage/AttendanceView";

export default async function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: s } = await supabase
    .from("sessions")
    .select("id, title, kind, dates, completion_threshold")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();
  const selective = s.kind === "application";
  const eligibleStatus = selective ? "selected" : "registered";

  const [{ data: entries }, { data: attendance }, { data: form }] = await Promise.all([
    supabase
      .from("entries")
      .select("participant_id, status, participants(pid, name, gender)")
      .eq("session_id", id)
      .eq("status", eligibleStatus),
    supabase.from("attendance").select("participant_id, date, checked_in_at").eq("session_id", id),
    supabase.from("forms").select("code, status").eq("session_id", id).eq("kind", "attendance").maybeSingle(),
  ]);

  const eligible: EligibleRow[] = (entries ?? []).map((e) => {
    const p = e.participants as unknown as { pid: string; name: string; gender: string | null };
    return { participantId: e.participant_id, pid: p.pid, name: p.name, gender: p.gender };
  });

  const today = todayIso();
  const past = [...s.dates].filter((d) => d <= today).sort();
  const defaultDay = past.length ? past[past.length - 1] : [...s.dates].sort()[0];

  return (
    <AttendanceView
      sessionId={id}
      sessionTitle={s.title}
      open={!selective}
      dates={[...s.dates].sort()}
      threshold={Number(s.completion_threshold)}
      eligible={eligible}
      records={(attendance ?? []) as AttendanceRecord[]}
      attendanceForm={form ? { code: form.code, status: form.status } : null}
      defaultDay={defaultDay}
      selective={selective}
    />
  );
}

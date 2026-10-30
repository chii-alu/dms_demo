import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PeopleTable, type PersonRow } from "@/components/manage/PeopleTable";
import { questionsSchema, type Question } from "@/lib/forms/questions";
import { applicationScore } from "@/lib/rules/scoring";
import { statusesFor, type EntryStatus } from "@/lib/sessions/status";
import { formatDate, formatDateRange } from "@/lib/dates";

type EntryRow = {
  id: string;
  status: EntryStatus;
  answers: Record<string, unknown>;
  source: string;
  submitted_at: string;
  participant_id: string;
  participants: {
    pid: string;
    name: string;
    email: string;
    phone: string | null;
    gender: string | null;
    age_group: string | null;
    country: string | null;
    affiliation: string | null;
    disability: string | null;
  };
};

export default async function PeoplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: s } = await supabase
    .from("sessions")
    .select("id, title, kind, dates, application_deadline, venue, pillar, interventions(name)")
    .eq("id", id)
    .maybeSingle();
  if (!s || !user) notFound();

  const selective = s.kind === "application";
  const iv = s.interventions as unknown as { name: string };

  const [{ data: entries }, { data: forms }, { data: rubric }] = await Promise.all([
    supabase
      .from("entries")
      .select("id, status, answers, source, submitted_at, participant_id, participants(pid, name, email, phone, gender, age_group, country, affiliation, disability)")
      .eq("session_id", id)
      .order("submitted_at", { ascending: true }),
    supabase.from("forms").select("questions").eq("session_id", id).eq("kind", "intake").maybeSingle(),
    supabase.from("rubric_criteria").select("id, name, weight, position").eq("session_id", id).order("position"),
  ]);

  const rows = (entries ?? []) as unknown as EntryRow[];
  const entryIds = rows.map((r) => r.id);
  const participantIds = rows.map((r) => r.participant_id);

  const [{ data: scores }, { data: history }, { data: attendance }, { data: feedback }] = entryIds.length
    ? await Promise.all([
        supabase.from("scores").select("entry_id, criterion_id, reviewer_id, score").in("entry_id", entryIds),
        supabase.from("status_history").select("entry_id, from_status, to_status, changed_at").in("entry_id", entryIds).order("changed_at", { ascending: false }),
        supabase.from("attendance").select("participant_id").eq("session_id", id).in("participant_id", participantIds),
        supabase.from("feedback").select("participant_id").eq("session_id", id).in("participant_id", participantIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const criteria = (rubric ?? []).map((c) => ({ id: c.id, name: c.name, weight: c.weight }));
  const questions: Question[] = (() => {
    const parsed = questionsSchema.safeParse(forms?.questions ?? []);
    return parsed.success ? parsed.data : [];
  })();

  const personRows: PersonRow[] = rows.map((r) => {
    const byReviewer: Record<string, Record<string, number>> = {};
    for (const sc of scores ?? []) {
      if (sc.entry_id !== r.id) continue;
      (byReviewer[sc.reviewer_id] ??= {})[sc.criterion_id] = sc.score;
    }
    const attended = (attendance ?? []).filter((a) => a.participant_id === r.participant_id).length;
    return {
      entryId: r.id,
      pid: r.participants.pid,
      name: r.participants.name,
      email: r.participants.email,
      phone: r.participants.phone,
      gender: r.participants.gender,
      age: r.participants.age_group,
      country: r.participants.country,
      affiliation: r.participants.affiliation,
      disability: r.participants.disability,
      status: r.status,
      submittedAt: r.submitted_at,
      answers: r.answers ?? {},
      score: selective ? applicationScore(criteria, byReviewer) : null,
      myScores: byReviewer[user.id] ?? {},
      scoresByReviewer: byReviewer,
      attended,
      feedback: (feedback ?? []).some((f) => f.participant_id === r.participant_id),
      history: (history ?? [])
        .filter((h) => h.entry_id === r.id)
        .slice(0, 8)
        .map((h) => ({ from: h.from_status, to: h.to_status, at: h.changed_at })),
    };
  });

  return (
    <PeopleTable
      sessionId={id}
      sessionTitle={s.title}
      interventionName={iv.name}
      pillar={s.pillar}
      selective={selective}
      statuses={statusesFor(selective)}
      rows={personRows}
      criteria={criteria}
      questions={questions}
      dates={s.dates}
      venue={s.venue}
      deadline={s.application_deadline}
      deadlineLabel={s.application_deadline ? formatDate(s.application_deadline) : null}
      rangeLabel={formatDateRange(s.dates)}
      userId={user.id}
    />
  );
}

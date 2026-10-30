import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FormCard, type FormStatus } from "@/components/manage/FormCard";
import { RubricCard } from "@/components/manage/RubricEditor";
import { INTAKE_CORE, FEEDBACK_CORE } from "@/lib/forms/core-questions";
import { questionsSchema, type Question } from "@/lib/forms/questions";

export default async function SessionFormsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: s } = await supabase.from("sessions").select("id, title, kind").eq("id", id).maybeSingle();
  if (!s) notFound();
  const selective = s.kind === "application";

  const [{ data: forms }, { data: rubric }, entries, attendance, feedback] = await Promise.all([
    supabase.from("forms").select("kind, code, status, questions").eq("session_id", id),
    supabase.from("rubric_criteria").select("name, weight, position").eq("session_id", id).order("position"),
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("session_id", id),
    supabase.from("attendance").select("session_id", { count: "exact", head: true }).eq("session_id", id),
    supabase.from("feedback").select("id", { count: "exact", head: true }).eq("session_id", id),
  ]);

  const byKind = Object.fromEntries((forms ?? []).map((f) => [f.kind, f]));
  const intake = byKind.intake;
  const attend = byKind.attendance;
  const feed = byKind.feedback;
  if (!intake || !attend || !feed) notFound();

  const customQuestions = (value: unknown): Question[] => {
    const parsed = questionsSchema.safeParse(value);
    return parsed.success ? parsed.data : [];
  };
  const intakeQs = customQuestions(intake.questions);
  const feedbackQs = customQuestions(feed.questions);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FormCard
          sessionId={id}
          sessionTitle={s.title}
          kind="intake"
          title={selective ? "Application form" : "Registration form"}
          description={`${INTAKE_CORE.length} standard fields + ${intakeQs.length} question${intakeQs.length === 1 ? "" : "s"} for this session.`}
          code={intake.code}
          status={intake.status as FormStatus}
          count={entries.count ?? 0}
          countLabel={selective ? "applications received" : "registrations received"}
          customQuestions={intakeQs}
          core={INTAKE_CORE}
        />
        <FormCard
          sessionId={id}
          sessionTitle={s.title}
          kind="attendance"
          title="Check-in form"
          description={`Participants enter their email and pick the date. Only ${selective ? "selected applicants" : "registered participants"} can check in.`}
          code={attend.code}
          status={attend.status as FormStatus}
          count={attendance.count ?? 0}
          countLabel="check-ins recorded"
        />
        <FormCard
          sessionId={id}
          sessionTitle={s.title}
          kind="feedback"
          title="Feedback form"
          description={`${FEEDBACK_CORE.length} standard questions shared across all pillars + ${feedbackQs.length} for this session.`}
          code={feed.code}
          status={feed.status as FormStatus}
          count={feedback.count ?? 0}
          countLabel="responses"
          customQuestions={feedbackQs}
          core={FEEDBACK_CORE}
        />
      </div>

      {selective && <RubricCard sessionId={id} sessionTitle={s.title} criteria={(rubric ?? []).map((r) => ({ name: r.name, weight: r.weight }))} />}
    </div>
  );
}

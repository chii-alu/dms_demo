import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { questionsSchema } from "@/lib/forms/questions";
import { average, netPromoterScore } from "@/lib/rules/feedback";
import { card } from "@/components/ui/styles";
import { formatDate } from "@/lib/dates";

type FeedbackRow = {
  satisfaction: number;
  relevance: number;
  nps: number;
  most_useful: string | null;
  improve: string | null;
  answers: Record<string, unknown>;
  submitted_at: string;
  participants: { name: string } | null;
};

export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: s } = await supabase.from("sessions").select("id").eq("id", id).maybeSingle();
  if (!s) notFound();

  const [{ data: rows }, { data: form }, { data: attended }] = await Promise.all([
    supabase
      .from("feedback")
      .select("satisfaction, relevance, nps, most_useful, improve, answers, submitted_at, participants(name)")
      .eq("session_id", id)
      .order("submitted_at", { ascending: false }),
    supabase.from("forms").select("questions").eq("session_id", id).eq("kind", "feedback").maybeSingle(),
    supabase.from("attendance").select("participant_id").eq("session_id", id),
  ]);

  const feedback = (rows ?? []) as unknown as FeedbackRow[];
  const attendees = new Set((attended ?? []).map((a) => a.participant_id)).size;
  const parsed = questionsSchema.safeParse(form?.questions ?? []);
  const ratingQuestions = (parsed.success ? parsed.data : []).filter((q) => q.type === "rating" || q.type === "scale10");

  const rate = attendees ? Math.round((feedback.length / attendees) * 100) : 0;
  const withComments = feedback.filter((f) => f.most_useful || f.improve);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi value={feedback.length} label={`responses · ${rate}% of attendees`} />
        <Kpi value={<>{average(feedback.map((f) => f.satisfaction)).toFixed(1)}<span className="text-base text-muted"> / 5</span></>} label="satisfaction" />
        <Kpi value={<>{average(feedback.map((f) => f.relevance)).toFixed(1)}<span className="text-base text-muted"> / 5</span></>} label="relevance" />
        <Kpi value={`${netPromoterScore(feedback.map((f) => f.nps)) > 0 ? "+" : ""}${netPromoterScore(feedback.map((f) => f.nps))}`} label="net promoter score" />
      </div>

      {feedback.length === 0 ? (
        <div className={`${card} text-center text-muted`}>No feedback yet. Set the feedback form to Open and share its QR at the end of the session.</div>
      ) : (
        <>
          {ratingQuestions.length > 0 && (
            <section className={card}>
              <h2 className="font-display text-lg font-semibold">Questions for this session</h2>
              <ul className="mt-3 divide-y divide-line">
                {ratingQuestions.map((q) => {
                  const values = feedback.map((f) => Number(f.answers?.[q.id])).filter((v) => Number.isFinite(v));
                  const max = q.type === "rating" ? 5 : 10;
                  const avg = average(values);
                  return (
                    <li key={q.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span>{q.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-32 overflow-hidden rounded-full bg-sunk">
                          <span className="block h-full bg-accent" style={{ width: `${(avg / max) * 100}%` }} />
                        </span>
                        <b className="w-10 text-right tabular-nums">{values.length ? avg.toFixed(1) : "—"}</b>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-semibold">Comments</h2>
            {withComments.length === 0 ? (
              <div className={`${card} text-muted`}>No written comments.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {withComments.map((f, i) => (
                  <article key={i} className={`${card} flex flex-col gap-2`}>
                    {f.most_useful && (
                      <p className="border-l-[3px] border-line pl-3 text-sm">
                        <span className="block text-xs text-muted">Most useful</span>
                        {f.most_useful}
                      </p>
                    )}
                    {f.improve && (
                      <p className="border-l-[3px] border-line pl-3 text-sm">
                        <span className="block text-xs text-muted">Improve</span>
                        {f.improve}
                      </p>
                    )}
                    <span className="text-xs text-muted">
                      {f.participants?.name ?? "Participant"} · {formatDate(f.submitted_at.slice(0, 10))}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className={card}>
      <div className="font-display text-3xl font-semibold tabular-nums">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

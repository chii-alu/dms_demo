"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveEntryScores, sendParticipantEmail, setEntryStatuses } from "@/app/manage/actions";
import { Dialog } from "@/components/ui/Dialog";
import { btn, btnPri, input, label } from "@/components/ui/styles";
import { STATUS_LABEL, type EntryStatus } from "@/lib/sessions/status";
import type { Question } from "@/lib/forms/questions";
import { applicationScore, reviewerScore, type Criterion } from "@/lib/rules/scoring";
import { notifyText } from "@/lib/notify";
import { formatDate } from "@/lib/dates";
import type { PersonRow } from "./PeopleTable";

type Context = {
  sessionTitle: string;
  interventionName: string;
  pillar: string;
  rangeLabel: string;
  venue: string | null;
  deadlineLabel: string | null;
};

export function ApplicationDialog({
  open,
  onClose,
  sessionId,
  row,
  selective,
  statuses,
  criteria,
  questions,
  userId,
  context,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  row: PersonRow;
  selective: boolean;
  statuses: EntryStatus[];
  criteria: (Criterion & { name: string })[];
  questions: Question[];
  userId: string;
  context: Context;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={row.name} description={`${context.pillar} · ${context.interventionName} · ${context.sessionTitle}`} wide>
      <ApplicationBody
        sessionId={sessionId}
        row={row}
        selective={selective}
        statuses={statuses}
        criteria={criteria}
        questions={questions}
        userId={userId}
        context={context}
        onClose={onClose}
      />
    </Dialog>
  );
}

function ApplicationBody({
  sessionId,
  row,
  selective,
  statuses,
  criteria,
  questions,
  userId,
  context,
  onClose,
}: Omit<Parameters<typeof ApplicationDialog>[0], "open" | "onClose"> & { onClose: () => void }) {
  const router = useRouter();
  const [myScores, setMyScores] = useState<Record<string, number>>(row.myScores);
  const [status, setStatus] = useState<EntryStatus>(row.status);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailNote, setEmailNote] = useState<string | null>(null);

  const mine = reviewerScore(criteria, myScores);
  const others = { ...row.scoresByReviewer, [userId]: myScores };
  const average = applicationScore(criteria, others);

  const save = async () => {
    setError(null);
    setSaving(true);
    // Partial scores are stored; the weighted score only shows once every criterion is scored.
    if (selective && Object.keys(myScores).length > 0) {
      const r = await saveEntryScores(row.entryId, myScores);
      if (!r.ok) {
        setSaving(false);
        return setError(r.error);
      }
    }
    if (status !== row.status) {
      const r = await setEntryStatuses(sessionId, [row.entryId], status);
      if (!r.ok) {
        setSaving(false);
        return setError(r.error);
      }
    }
    setSaving(false);
    router.refresh();
    onClose();
  };

  // Saves a changed status first, so the email matches what the participant will see on record.
  const sendMail = async () => {
    setError(null);
    setEmailNote(null);
    setSending(true);
    if (status !== row.status) {
      const saved = await setEntryStatuses(sessionId, [row.entryId], status);
      if (!saved.ok) {
        setSending(false);
        return setError(saved.error);
      }
    }
    const r = await sendParticipantEmail(row.entryId);
    setSending(false);
    if (!r.ok) return setError(r.error);
    setEmailNote(
      r.data.status === "sent"
        ? `Email sent to ${row.email}.`
        : "Email is not set up yet. Add RESEND_API_KEY and MELA_EMAIL_FROM, or copy the message instead.",
    );
    router.refresh();
  };

  const copyMessage = async () => {
    const text = notifyText({
      firstName: row.name.split(" ")[0],
      pid: row.pid,
      sessionTitle: context.sessionTitle,
      interventionName: context.interventionName,
      pillar: context.pillar,
      datesText: context.rangeLabel,
      venue: context.venue,
      deadline: context.deadlineLabel,
      status,
    });
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 text-sm sm:grid-cols-3">
        <Field k="Participant ID" v={<span className="font-mono">{row.pid}</span>} />
        <Field k="Email" v={row.email} />
        <Field k="Phone" v={row.phone ?? "—"} />
        <Field k="Gender" v={row.gender ?? "—"} />
        <Field k="Age group" v={row.age ?? "—"} />
        <Field k="Country" v={row.country ?? "—"} />
        <Field k="Affiliation" v={row.affiliation ?? "—"} />
        <Field k="Disability" v={row.disability ?? "—"} />
        <Field k="Submitted" v={formatDate(row.submittedAt.slice(0, 10))} />
      </section>

      {questions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-display text-base font-semibold">Answers</h3>
          {questions.map((q) => {
            const a = row.answers[q.id];
            return (
              <div key={q.id} className="text-sm">
                <div className="text-xs font-semibold text-muted">{q.label}</div>
                <div className="whitespace-pre-wrap">{Array.isArray(a) ? a.join(", ") : a == null || a === "" ? "—" : String(a)}</div>
              </div>
            );
          })}
        </section>
      )}

      {selective && (
        <section className="flex flex-col gap-3">
          <h3 className="font-display text-base font-semibold">Score</h3>
          {criteria.map((c) => (
            <fieldset key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
              <legend className="sr-only">{c.name}</legend>
              <span className="text-sm">
                {c.name} <span className="font-mono text-muted">{c.weight}%</span>
              </span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="relative">
                    <input
                      type="radio"
                      name={`score-${c.id}`}
                      value={n}
                      checked={myScores[c.id] === n}
                      onChange={() => setMyScores((prev) => ({ ...prev, [c.id]: n }))}
                      className="peer absolute opacity-0"
                    />
                    <span className="inline-flex min-w-9 cursor-pointer justify-center rounded-md border border-line px-2 py-1.5 text-sm peer-checked:border-accent peer-checked:bg-accent peer-checked:text-surface">
                      {n}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="text-sm">
            Your weighted score: <b className="tabular-nums">{mine ?? "—"}</b> / 100
            {average != null && (
              <span className="text-muted">
                {" "}· average across reviewers: <b className="tabular-nums text-ink">{average}</b>
              </span>
            )}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="font-display text-base font-semibold">Status</h3>
        <label className={`${label} max-w-xs`}>
          Status
          <select className={input} value={status} onChange={(e) => setStatus(e.target.value as EntryStatus)}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {row.history.length > 0 && (
          <ul className="text-xs text-muted">
            {row.history.map((h, i) => (
              <li key={i}>
                {h.from ? STATUS_LABEL[h.from as EntryStatus] : "New"} → {STATUS_LABEL[h.to as EntryStatus]} ·{" "}
                {new Date(h.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-md bg-bad-soft p-3 text-sm text-bad">
          {error}
        </p>
      )}
      {emailNote && <p role="status" className="rounded-md bg-accent-soft p-3 text-sm text-accent">{emailNote}</p>}

      <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={copyMessage}>
            {copied ? "Copied" : "Copy message to participant"}
          </button>
          <button type="button" className={btn} onClick={sendMail} disabled={sending}>
            {sending ? "Sending…" : "Send email"}
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={btnPri} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted">{k}</div>
      <div className="break-words">{v}</div>
    </div>
  );
}

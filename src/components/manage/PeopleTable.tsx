"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setEntryStatuses } from "@/app/manage/actions";
import { btn, btnPri, btnSm, card, input } from "@/components/ui/styles";
import { STATUS_LABEL, type EntryStatus } from "@/lib/sessions/status";
import type { Question } from "@/lib/forms/questions";
import type { Criterion } from "@/lib/rules/scoring";
import { ApplicationDialog } from "./ApplicationDialog";
import { AddEntryDialog } from "./AddEntryDialog";

export type PersonRow = {
  entryId: string;
  pid: string;
  name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  age: string | null;
  country: string | null;
  affiliation: string | null;
  disability: string | null;
  status: EntryStatus;
  submittedAt: string;
  answers: Record<string, unknown>;
  score: number | null;
  myScores: Record<string, number>;
  scoresByReviewer: Record<string, Record<string, number>>;
  attended: number;
  feedback: boolean;
  history: { from: string | null; to: string; at: string }[];
};

const STATUS_CLASS: Record<EntryStatus, string> = {
  registered: "bg-ok-soft text-ok",
  waitlisted: "bg-warn-soft text-warn",
  cancelled: "bg-sunk text-muted",
  applied: "bg-accent-soft text-accent",
  shortlisted: "bg-warn-soft text-warn",
  selected: "bg-ok-soft text-ok",
  rejected: "bg-bad-soft text-bad",
  withdrawn: "bg-sunk text-muted",
};

export function PeopleTable(props: {
  sessionId: string;
  sessionTitle: string;
  interventionName: string;
  pillar: string;
  selective: boolean;
  statuses: EntryStatus[];
  rows: PersonRow[];
  criteria: (Criterion & { name: string })[];
  questions: Question[];
  dates: string[];
  venue: string | null;
  deadline: string | null;
  deadlineLabel: string | null;
  rangeLabel: string;
  userId: string;
}) {
  const { sessionId, selective, statuses, rows, questions } = props;
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | EntryStatus>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<EntryStatus>(statuses[0]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const c: Partial<Record<EntryStatus | "all", number>> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const list = rows.filter((r) => filter === "all" || r.status === filter);
    return selective
      ? [...list].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name))
      : list;
  }, [rows, filter, selective]);

  const open = rows.find((r) => r.entryId === openId) ?? null;
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.entryId));

  const apply = async (ids: string[], status: EntryStatus) => {
    setError(null);
    setBusy(true);
    const result = await setEntryStatuses(sessionId, ids, status);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSelected(new Set());
    router.refresh();
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...statuses] as const)
            .filter((k) => k === "all" || (counts[k] ?? 0) > 0)
            .map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                aria-pressed={filter === k}
                className={`rounded-full border px-3 py-1 text-sm ${
                  filter === k ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line bg-surface"
                }`}
              >
                {k === "all" ? "All" : STATUS_LABEL[k]} · {counts[k] ?? 0}
              </button>
            ))}
        </div>
        <button type="button" className={btn} onClick={() => setAddOpen(true)}>
          {selective ? "Add application manually" : "Add registration manually"}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-accent-soft p-2.5 text-sm">
          <span>{selected.size} selected</span>
          <select className={`${input} w-auto py-1`} aria-label="New status" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as EntryStatus)}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button type="button" className={btnPri} disabled={busy} onClick={() => apply([...selected], bulkStatus)}>
            Apply to selected
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-bad-soft p-3 text-sm text-bad">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <div className={`${card} text-center text-muted`}>
          No {selective ? "applications" : "registrations"} yet. Open the form and share its link or QR code.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-sunk text-left text-xs font-semibold text-muted">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all shown"
                    checked={allVisibleSelected}
                    onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((r) => r.entryId)) : new Set())}
                  />
                </th>
                <th className="px-3 py-2">Participant</th>
                <th className="px-3 py-2">Gender / age</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Submitted</th>
                {selective && <th className="px-3 py-2 text-right">Score</th>}
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Attended</th>
                <th className="px-3 py-2">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.entryId} className="border-t border-line">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.name}`}
                      checked={selected.has(r.entryId)}
                      onChange={() => toggle(r.entryId)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" className="font-semibold text-accent hover:underline" onClick={() => setOpenId(r.entryId)}>
                      {r.name}
                    </button>
                    <div className="font-mono text-xs text-muted">{r.pid}</div>
                  </td>
                  <td className="px-3 py-2">{[r.gender, r.age].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-3 py-2">{r.country ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{new Date(r.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                  {selective && (
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.score == null ? (
                        <button type="button" className={btnSm} onClick={() => setOpenId(r.entryId)}>
                          Score
                        </button>
                      ) : (
                        <b>{r.score}</b>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <select
                      className={`${input} w-auto py-1 text-sm ${STATUS_CLASS[r.status]}`}
                      aria-label={`Status for ${r.name}`}
                      value={r.status}
                      disabled={busy}
                      onChange={(e) => apply([r.entryId], e.target.value as EntryStatus)}
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{isEligible(r.status, selective) ? `${r.attended} / ${props.dates.length}` : "—"}</td>
                  <td className="px-3 py-2">{r.feedback ? <span className="rounded-md bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">Given</span> : <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <ApplicationDialog
          key={open.entryId}
          open
          onClose={() => setOpenId(null)}
          sessionId={sessionId}
          row={open}
          selective={selective}
          statuses={statuses}
          criteria={props.criteria}
          questions={questions}
          userId={props.userId}
          context={{
            sessionTitle: props.sessionTitle,
            interventionName: props.interventionName,
            pillar: props.pillar,
            rangeLabel: props.rangeLabel,
            venue: props.venue,
            deadlineLabel: props.deadlineLabel,
          }}
        />
      )}

      <AddEntryDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        sessionId={sessionId}
        selective={selective}
        questions={questions}
        dates={props.dates}
      />
    </div>
  );
}

// Eligible for attendance: open → registered; selective → selected (SPEC §4.10).
export function isEligible(status: EntryStatus, selective: boolean) {
  return selective ? status === "selected" : status === "registered";
}

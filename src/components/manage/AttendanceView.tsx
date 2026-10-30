"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markAllPresent, setAttendance } from "@/app/manage/actions";
import { btnSm, card } from "@/components/ui/styles";
import { formatDate } from "@/lib/dates";
import { isCompleted } from "@/lib/rules/completion";
import { ShareDialog } from "./ShareDialog";
import { AddEntryDialog } from "./AddEntryDialog";

export type EligibleRow = { participantId: string; pid: string; name: string; gender: string | null };
export type AttendanceRecord = { participant_id: string; date: string; checked_in_at: string };

const shortDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function AttendanceView({
  sessionId,
  sessionTitle,
  open,
  dates,
  threshold,
  eligible,
  records,
  attendanceForm,
  defaultDay,
  selective,
}: {
  sessionId: string;
  sessionTitle: string;
  open: boolean;
  dates: string[];
  threshold: number;
  eligible: EligibleRow[];
  records: AttendanceRecord[];
  attendanceForm: { code: string; status: "draft" | "open" | "closed" } | null;
  defaultDay: string;
  selective: boolean;
}) {
  const router = useRouter();
  const [day, setDay] = useState(defaultDay);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const presentOn = (d: string) => new Set(records.filter((r) => r.date === d).map((r) => r.participant_id));
  const present = presentOn(day);
  const checkedInAt = (pid: string) => records.find((r) => r.date === day && r.participant_id === pid)?.checked_in_at;
  const attendedDays = (pid: string) => new Set(records.filter((r) => r.participant_id === pid).map((r) => r.date)).size;
  const onTrack = dates.length > 1 ? eligible.filter((e) => isCompleted(attendedDays(e.participantId), dates.length, threshold)).length : null;
  const rate = eligible.length ? Math.round((present.size / eligible.length) * 100) : 0;

  const toggle = async (participantId: string, isPresent: boolean) => {
    setError(null);
    setBusy(true);
    const r = await setAttendance(sessionId, participantId, day, !isPresent);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  };

  const markAll = async () => {
    setError(null);
    setBusy(true);
    const r = await markAllPresent(sessionId, day);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  };

  if (dates.length === 0) return <div className={`${card} text-muted`}>Add session dates in Session details first.</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === day}
              onClick={() => setDay(d)}
              className={`rounded-full border px-3 py-1 text-sm ${d === day ? "border-ink bg-ink text-surface" : "border-line bg-surface"}`}
            >
              {shortDate(d)} · {presentOn(d).size}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {attendanceForm && (
            <button type="button" className={btnSm} onClick={() => setQrOpen(true)}>
              Check-in QR
            </button>
          )}
          {open && (
            <button type="button" className={btnSm} onClick={() => setWalkInOpen(true)}>
              Add walk-in
            </button>
          )}
          <button type="button" className={btnSm} onClick={markAll} disabled={busy || eligible.length === 0}>
            Mark all present
          </button>
        </div>
      </div>

      {eligible.length === 0 ? (
        <div className={`${card} text-center text-muted`}>No {selective ? "selected participants" : "registered participants"} yet.</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi value={`${present.size} / ${eligible.length}`} label={`present on ${formatDate(day)}`} />
            <Kpi value={`${rate}%`} label="attendance rate" />
            {onTrack !== null && <Kpi value={onTrack} label={`on track to complete (${Math.round(threshold * 100)}%+ of dates)`} />}
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-bad-soft p-3 text-sm text-bad">
              {error}
            </p>
          )}

          <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-sunk text-left text-xs font-semibold text-muted">
                <tr>
                  <th className="px-3 py-2">Participant</th>
                  <th className="px-3 py-2">Gender</th>
                  <th className="px-3 py-2">Check-in time</th>
                  <th className="px-3 py-2">{shortDate(day)}</th>
                </tr>
              </thead>
              <tbody>
                {[...eligible]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((e) => {
                    const isPresent = present.has(e.participantId);
                    const at = checkedInAt(e.participantId);
                    return (
                      <tr key={e.participantId} className="border-t border-line">
                        <td className="px-3 py-2">
                          <div className="font-semibold">{e.name}</div>
                          <div className="font-mono text-xs text-muted">{e.pid}</div>
                        </td>
                        <td className="px-3 py-2">{e.gender ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {at ? new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            aria-pressed={isPresent}
                            disabled={busy}
                            onClick={() => toggle(e.participantId, isPresent)}
                            className={`min-w-24 rounded-md border px-3 py-1 text-sm ${
                              isPresent ? "border-ok bg-ok-soft font-semibold text-ok" : "border-line bg-surface"
                            }`}
                          >
                            {isPresent ? "Present" : "Mark present"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {attendanceForm && (
        <ShareDialog
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          code={attendanceForm.code}
          title="Check-in form"
          description={sessionTitle}
          status={attendanceForm.status}
        />
      )}
      <AddEntryDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        sessionId={sessionId}
        selective={false}
        questions={[]}
        dates={dates}
        walkInDate={day}
      />
    </div>
  );
}

function Kpi({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className={card}>
      <div className="font-display text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}

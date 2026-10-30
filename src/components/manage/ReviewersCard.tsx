"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignReviewer, removeReviewer } from "@/app/manage/actions";
import { btnSm, card, input } from "@/components/ui/styles";

export type Person = { userId: string; email: string; role: string };

// SPEC §8: reviewers see and score only the applications of the sessions they are assigned to.
export function ReviewersCard({
  sessionId,
  assigned,
  candidates,
  canManage,
}: {
  sessionId: string;
  assigned: Person[];
  candidates: Person[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "That did not work.");
    router.refresh();
  };

  return (
    <section className={card}>
      <h2 className="font-display text-lg font-semibold">Reviewers</h2>
      <p className="mt-1 text-sm text-muted">
        Reviewers see and score only this session’s applications. Scores are averaged across the reviewers who scored everything.
      </p>

      {assigned.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No reviewers yet. Any pillar staff member can still score.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {assigned.map((p) => (
            <li key={p.userId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                {p.email} <span className="text-muted">· {p.role.replace("_", " ")}</span>
              </span>
              {canManage && (
                <button
                  type="button"
                  className={btnSm}
                  disabled={busy}
                  onClick={() => run(() => removeReviewer(sessionId, p.userId))}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && candidates.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select className={`${input} w-auto`} aria-label="Add a reviewer" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose a staff member…</option>
            {candidates.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.email} ({c.role.replace("_", " ")})
              </option>
            ))}
          </select>
          <button
            type="button"
            className={btnSm}
            disabled={!pick || busy}
            onClick={() => run(() => assignReviewer(sessionId, pick)).then(() => setPick(""))}
          >
            Add reviewer
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-bad-soft p-2 text-sm text-bad">
          {error}
        </p>
      )}
    </section>
  );
}

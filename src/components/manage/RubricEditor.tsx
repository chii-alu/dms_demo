"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveRubric } from "@/app/manage/actions";
import { Dialog } from "@/components/ui/Dialog";
import { btn, btnPri, btnSm, card, input } from "@/components/ui/styles";
import { rubricWeightTotal, rubricWeightWarning } from "@/lib/rules/rubric";

export type Criterion = { name: string; weight: number };

// Read-only rubric card with an edit dialog (SPEC §7, §4.13 weights).
export function RubricCard({ sessionId, criteria, sessionTitle }: { sessionId: string; criteria: Criterion[]; sessionTitle: string }) {
  const [open, setOpen] = useState(false);
  const warning = rubricWeightWarning(criteria.map((c) => c.weight));

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Selection rubric</h2>
        <button type="button" className={btnSm} onClick={() => setOpen(true)}>
          Edit criteria
        </button>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {criteria.map((c) => (
          <li key={c.name} className="flex justify-between py-2 text-sm">
            <span>{c.name}</span>
            <span className="font-mono text-muted">{c.weight}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">
        Reviewers score each criterion 1–5. The weighted total out of 100 appears next to each application.
        {warning && <b className="ml-1 text-bad">{warning}</b>}
      </p>

      <Dialog open={open} onClose={() => setOpen(false)} title="Selection rubric" description={sessionTitle}>
        {open && <RubricEditorBody sessionId={sessionId} initial={criteria} onClose={() => setOpen(false)} />}
      </Dialog>
    </section>
  );
}

function RubricEditorBody({ sessionId, initial, onClose }: { sessionId: string; initial: Criterion[]; onClose: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<Criterion[]>(initial.map((c) => ({ ...c })));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const total = rubricWeightTotal(rows.map((r) => Number(r.weight) || 0));
  const warning = rubricWeightWarning(rows.map((r) => Number(r.weight) || 0));

  const save = async () => {
    setError(null);
    setSaving(true);
    const result = await saveRubric(
      sessionId,
      rows.map((r) => ({ name: r.name.trim(), weight: Number(r.weight) || 0 })),
    );
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
    onClose();
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Reviewers score each criterion 1–5. Weights should add up to 100%.</p>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_110px_auto] gap-2">
          <input
            className={input}
            aria-label="Criterion name"
            value={r.name}
            onChange={(e) => setRows((p) => p.map((x, ix) => (ix === i ? { ...x, name: e.target.value } : x)))}
          />
          <input
            className={input}
            aria-label="Weight percent"
            type="number"
            min={0}
            max={100}
            value={r.weight}
            onChange={(e) => setRows((p) => p.map((x, ix) => (ix === i ? { ...x, weight: Number(e.target.value) } : x)))}
          />
          <button type="button" className={btnSm} aria-label="Remove criterion" onClick={() => setRows((p) => p.filter((_, ix) => ix !== i))}>
            ×
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button type="button" className={btn} onClick={() => setRows((p) => [...p, { name: "New criterion", weight: 0 }])}>
          + Add criterion
        </button>
        <span className={`text-sm ${warning ? "text-bad" : "text-muted"}`}>Total: {total}%</span>
      </div>
      {warning && <p className="text-sm text-warn">{warning} You can still save.</p>}
      {error && (
        <p role="alert" className="rounded-md bg-bad-soft p-3 text-sm text-bad">
          {error}
        </p>
      )}
      <div className="mt-2 flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" className={btn} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={btnPri} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save rubric"}
        </button>
      </div>
    </div>
  );
}

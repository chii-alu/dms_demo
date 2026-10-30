"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveFormQuestions } from "@/app/manage/actions";
import { Dialog } from "@/components/ui/Dialog";
import { btn, btnPri, btnSm, input, label } from "@/components/ui/styles";
import { QUESTION_TYPE_LABELS, QUESTION_TYPES, type Question, type QuestionType } from "@/lib/forms/questions";
import type { CoreQuestion } from "@/lib/forms/core-questions";

const NEEDS_OPTIONS: QuestionType[] = ["single", "multi"];

export function QuestionEditor({
  open,
  onClose,
  sessionId,
  kind,
  title,
  sessionTitle,
  core,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  kind: "intake" | "feedback";
  title: string;
  sessionTitle: string;
  core: CoreQuestion[];
  initial: Question[];
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={sessionTitle}
      wide
    >
      <QuestionEditorBody sessionId={sessionId} kind={kind} core={core} initial={initial} onClose={onClose} />
    </Dialog>
  );
}

// Draft state lives here, so it resets each time the dialog opens.
function QuestionEditorBody({
  sessionId,
  kind,
  core,
  initial,
  onClose,
}: {
  sessionId: string;
  kind: "intake" | "feedback";
  core: CoreQuestion[];
  initial: Question[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [qs, setQs] = useState<Question[]>(() => initial.map((q) => ({ ...q, options: q.options ? [...q.options] : undefined })));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<Question>) =>
    setQs((prev) => prev.map((q, ix) => (ix === i ? { ...q, ...patch } : q)));
  const move = (i: number, dir: -1 | 1) =>
    setQs((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setQs((prev) => prev.filter((_, ix) => ix !== i));
  const add = () =>
    setQs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: "New question", type: "text", required: false },
    ]);

  const save = async () => {
    setError(null);
    setSaving(true);
    const cleaned = qs.map((q) => ({
      ...q,
      label: q.label.trim(),
      options: NEEDS_OPTIONS.includes(q.type) ? (q.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
    }));
    const result = await saveFormQuestions(sessionId, kind, cleaned);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  };

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="font-display text-base font-semibold">Standard questions</h3>
        <p className="text-sm text-muted">
          Locked on every {kind === "intake" ? "registration and application" : "feedback"} form, so answers compare across pillars.
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {core.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 rounded-md bg-sunk p-2.5 text-sm">
              <span>{c.label}</span>
              <span className="whitespace-nowrap text-muted">{c.type === "consent" ? "Consent" : c.required ? "Required" : "Optional"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-display text-base font-semibold">Questions for this session</h3>
        {qs.length === 0 && <p className="mt-2 text-sm text-muted">No extra questions yet.</p>}
        <ol className="mt-2 flex flex-col gap-3">
          {qs.map((q, i) => (
            <li key={q.id} className="rounded-md border border-line p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                <input
                  className={input}
                  aria-label="Question text"
                  value={q.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
                <select
                  className={input}
                  aria-label="Answer type"
                  value={q.type}
                  onChange={(e) => {
                    const type = e.target.value as QuestionType;
                    update(i, {
                      type,
                      options: NEEDS_OPTIONS.includes(type) ? (q.options?.length ? q.options : ["Option 1", "Option 2"]) : undefined,
                    });
                  }}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {QUESTION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <button type="button" className={btnSm} aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className={btnSm} aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className={btnSm} aria-label="Remove question" onClick={() => remove(i)}>×</button>
                </div>
              </div>
              {NEEDS_OPTIONS.includes(q.type) && (
                <label className={`${label} mt-2`}>
                  Options (one per line)
                  <textarea
                    className={`${input} min-h-[70px]`}
                    value={(q.options ?? []).join("\n")}
                    onChange={(e) => update(i, { options: e.target.value.split("\n") })}
                  />
                </label>
              )}
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} />
                Required
              </label>
            </li>
          ))}
        </ol>
        <button type="button" className={`${btn} mt-3`} onClick={add}>
          + Add question
        </button>
      </section>

      {error && (
        <p role="alert" className="rounded-md bg-bad-soft p-3 text-sm text-bad">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" className={btn} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={btnPri} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save form"}
        </button>
      </div>
    </div>
  );
}

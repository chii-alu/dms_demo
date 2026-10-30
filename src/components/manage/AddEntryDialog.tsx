"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addEntryManually, addWalkin } from "@/app/manage/actions";
import { DynamicForm, type FieldValues } from "@/components/forms/DynamicForm";
import { Dialog } from "@/components/ui/Dialog";
import { btn, btnPri } from "@/components/ui/styles";
import { buildValuesSchema, publicFields } from "@/lib/forms/fields";
import type { Question } from "@/lib/forms/questions";

// "Add manually" (SPEC §7): the same intake fields as the public form, filled in by staff.
// Staff must confirm the participant's consent before saving.
export function AddEntryDialog({
  open,
  onClose,
  sessionId,
  selective,
  questions,
  dates,
  walkInDate,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  selective: boolean;
  questions: Question[];
  dates: string[];
  // Set for a walk-in at an open session: the person is checked in on this date (SPEC §4.11).
  walkInDate?: string;
}) {
  const walkIn = walkInDate !== undefined;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={walkIn ? "Add walk-in" : selective ? "Add application manually" : "Add registration manually"}
      description={
        walkIn
          ? "Registers the person and marks them present on the chosen date. Walk-ins are not limited by capacity."
          : "Use this when someone registers on paper, by phone or in person. The participant must consent."
      }
      wide
    >
      {open && (
        <AddEntryBody sessionId={sessionId} questions={questions} dates={dates} onClose={onClose} walkInDate={walkInDate} />
      )}
    </Dialog>
  );
}

function AddEntryBody({
  sessionId,
  questions,
  dates,
  onClose,
  walkInDate,
}: {
  sessionId: string;
  questions: Question[];
  dates: string[];
  onClose: () => void;
  walkInDate?: string;
}) {
  const router = useRouter();
  const fields = publicFields("intake", questions, dates);
  const [values, setValues] = useState<FieldValues>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setFormError(null);
    const parsed = buildValuesSchema(fields).safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return setFormError("Some answers need attention.");
    }
    const v = parsed.data as Record<string, unknown>;
    const customIds = questions.map((q) => q.id);
    const answers = Object.fromEntries(customIds.filter((id) => v[id] !== undefined).map((id) => [id, v[id]]));

    setSaving(true);
    const profile = {
      name: v.name,
      email: v.email,
      phone: v.phone,
      gender: v.gender,
      age: v.age,
      country: v.country,
      affiliation: v.affiliation,
      disability: v.disability,
      consent: v.consent,
      answers,
    };
    const result =
      walkInDate !== undefined
        ? await addWalkin(sessionId, walkInDate, profile)
        : await addEntryManually(sessionId, profile);
    setSaving(false);
    if (!result.ok) return setFormError(result.error);
    router.refresh();
    onClose();
  };

  return (
    <div className="flex flex-col gap-6">
      <DynamicForm
        fields={fields}
        values={values}
        errors={errors}
        onChange={(id, value) => {
          setValues((p) => ({ ...p, [id]: value }));
          setErrors((p) => ({ ...p, [id]: undefined }));
        }}
      />
      {formError && (
        <p role="alert" className="rounded-md bg-bad-soft p-3 text-sm text-bad-ink">
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" className={btn} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={btnPri} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Add to session"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { DynamicForm, type FieldValues } from "./DynamicForm";
import { validateAnswers, visibleFields, type FieldSpec } from "@/lib/forms/fields";
import { btnPri, card } from "@/components/ui/styles";

// The registration form. Only the questions that apply are shown and checked (see showWhen in the template).
export function RegistrationForm({ code, fields }: { code: string; fields: FieldSpec[] }) {
  const [values, setValues] = useState<FieldValues>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Honeypot: hidden from people, filled by bots.
  const [website, setWebsite] = useState("");

  const onChange = (id: string, value: unknown) => {
    setValues((v) => ({ ...v, [id]: value }));
    setErrors((e) => ({ ...e, [id]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const parsed = validateAnswers(fields, values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      setFormError("Some answers need attention.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/register/${encodeURIComponent(code)}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values, website }),
      });
      const body = await res.json().catch(() => ({ ok: false, error: "Something went wrong." }));
      if (!res.ok || !body.ok) {
        if (body.fieldErrors) setErrors(body.fieldErrors);
        setFormError(body.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div role="status" className={`${card} flex flex-col gap-2`}>
        <h2 className="font-display text-xl font-semibold text-ok-ink">You are registered.</h2>
        <p className="text-sm text-muted">Thank you. Your session details will be shared by email.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <DynamicForm fields={visibleFields(fields, values)} values={values} errors={errors} onChange={onChange} />

      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      {formError && (
        <p role="alert" className="rounded-md bg-bad-soft p-3 text-sm text-bad-ink">
          {formError}
        </p>
      )}

      <button type="submit" className={`${btnPri} w-full py-3 text-base`} disabled={submitting}>
        {submitting ? "Sending…" : "Register"}
      </button>
    </form>
  );
}

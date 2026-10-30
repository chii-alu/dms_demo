"use client";

import type { FieldSpec } from "@/lib/forms/fields";
import { formatDate } from "@/lib/dates";
import { input, fieldError } from "@/components/ui/styles";

export type FieldValues = Record<string, unknown>;

// One renderer for every form: public forms and the staff preview (SPEC §5).
// Controlled: the parent owns values and errors.
export function DynamicForm({
  fields,
  values,
  errors,
  onChange,
}: {
  fields: FieldSpec[];
  values: FieldValues;
  errors: Record<string, string | undefined>;
  onChange: (id: string, value: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {fields.map((f) => (
        <FieldRow key={f.id} field={f} value={values[f.id]} error={errors[f.id]} onChange={(v) => onChange(f.id, v)} />
      ))}
    </div>
  );
}

function FieldRow({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldSpec;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const req = field.required ? <span className="text-bad"> *</span> : null;
  const err = error ? <span className={fieldError}>{error}</span> : null;
  const id = `f-${field.id}`;

  switch (field.type) {
    case "consent":
      return (
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={value === "yes"}
              onChange={(e) => onChange(e.target.checked ? "yes" : undefined)}
            />
            <span>
              {field.label}
              {req}
            </span>
          </label>
          {err}
        </div>
      );

    case "single":
    case "yesno": {
      const options = field.type === "yesno" ? ["Yes", "No"] : (field.options ?? []);
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">
            {field.label}
            {req}
          </legend>
          <div className="flex flex-col gap-1.5">
            {options.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input type="radio" name={id} value={o} checked={value === o} onChange={() => onChange(o)} className="h-4 w-4" />
                {formatChoice(o)}
              </label>
            ))}
          </div>
          {err}
        </fieldset>
      );
    }

    case "multi": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">
            {field.label}
            {req}
          </legend>
          <div className="flex flex-col gap-1.5">
            {(field.options ?? []).map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selected.includes(o)}
                  onChange={(e) => onChange(e.target.checked ? [...selected, o] : selected.filter((x) => x !== o))}
                />
                {o}
              </label>
            ))}
          </div>
          {err}
        </fieldset>
      );
    }

    case "rating":
    case "scale10": {
      const nums = field.type === "rating" ? [1, 2, 3, 4, 5] : Array.from({ length: 11 }, (_, i) => i);
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">
            {field.label}
            {req}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {nums.map((n) => (
              <label key={n} className="relative">
                <input
                  type="radio"
                  name={id}
                  value={n}
                  checked={value === n}
                  onChange={() => onChange(n)}
                  className="peer absolute opacity-0"
                />
                <span className="inline-flex min-w-10 cursor-pointer justify-center rounded-md border border-line px-2.5 py-2 text-sm tabular-nums peer-checked:border-accent peer-checked:bg-accent peer-checked:text-surface peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                  {n}
                </span>
              </label>
            ))}
          </div>
          <span className="text-xs text-muted">{field.type === "rating" ? "1 = poor, 5 = excellent" : "0 = not at all likely, 10 = extremely likely"}</span>
          {err}
        </fieldset>
      );
    }

    case "long":
      return (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {field.label}
          {req}
          <textarea
            id={id}
            className={`${input} min-h-[100px] font-normal`}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
          {err}
        </label>
      );

    default: {
      const type = field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "date" ? "date" : "text";
      return (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {field.label}
          {req}
          <input
            id={id}
            type={type}
            autoComplete={field.type === "email" ? "email" : undefined}
            className={`${input} font-normal`}
            value={(value as string | number) ?? ""}
            onChange={(e) => onChange(field.type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : e.target.value)}
          />
          {err}
        </label>
      );
    }
  }
}

// Session dates are stored as yyyy-mm-dd; show them as "12 Nov 2026".
function formatChoice(option: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(option) ? formatDate(option) : option;
}

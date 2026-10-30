"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addIntervention } from "@/app/manage/actions";
import { Dialog } from "@/components/ui/Dialog";
import { btn, btnPri, input, label } from "@/components/ui/styles";

// Opened from the sidebar under each pillar. Admins only (the sidebar shows the link to admins).
export function AddInterventionDialog({ pillar }: { pillar: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"open" | "selective">("open");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setError(null);
    setName("");
    setType("open");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = await addIntervention(pillar, name, type);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    close();
    router.push(`/manage/interventions/${r.data.id}`);
  };

  return (
    <>
      <button type="button" className="px-2.5 py-1 text-sm text-accent hover:underline" onClick={() => setOpen(true)}>
        + Add intervention
      </button>
      <Dialog open={open} onClose={close} title={`Add intervention to ${pillar}`}>
        <form onSubmit={save} className="flex flex-col gap-4">
          <label className={label}>
            Name
            <input className={input} required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="mb-1 font-semibold">Type</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name="type" checked={type === "open"} onChange={() => setType("open")} className="mt-1" />
              <span>Open: registration, attendance, feedback</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="type" checked={type === "selective"} onChange={() => setType("selective")} className="mt-1" />
              <span>Selective: application, selection, attendance, feedback</span>
            </label>
          </fieldset>
          {error && (
            <p role="alert" className="rounded-md bg-bad-soft p-3 text-sm text-bad">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" className={btn} onClick={close}>
              Cancel
            </button>
            <button type="submit" className={btnPri} disabled={busy}>
              {busy ? "Adding…" : "Add intervention"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

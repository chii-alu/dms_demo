"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { anonymiseParticipant } from "@/app/manage/actions";
import { Dialog } from "@/components/ui/Dialog";
import { btn, btnDanger } from "@/components/ui/styles";
import { usePortal } from "./usePortal";

// SPEC §8: remove a participant's personal details on request. Counts and links are kept.
export function AnonymiseButton({ pid, name }: { pid: string; name: string }) {
  const router = useRouter();
  const portal = usePortal();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const r = await anonymiseParticipant(pid);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.push(`/manage/${portal}/registry`);
  };

  return (
    <>
      <button type="button" className={`${btn} border-bad text-bad-ink`} onClick={() => setOpen(true)}>
        Remove personal details
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Remove personal details?">
        <p className="text-sm">
          {name} ({pid}) will be anonymised. Name, email, phone and demographic answers are removed. Sessions, attendance and feedback stay, so counts are unchanged. This cannot be undone.
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-md bg-bad-soft p-3 text-sm text-bad-ink">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={btn} onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="button" className={btnDanger} onClick={confirm} disabled={busy}>
            {busy ? "Removing…" : "Remove details"}
          </button>
        </div>
      </Dialog>
    </>
  );
}

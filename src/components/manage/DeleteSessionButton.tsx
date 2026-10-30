"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteSession } from "@/app/manage/actions";
import { Dialog } from "@/components/ui/Dialog";
import { btn, btnDanger } from "@/components/ui/styles";
import { usePortal } from "./usePortal";

export function DeleteSessionButton({
  sessionId,
  sessionTitle,
  registrations,
}: {
  sessionId: string;
  sessionTitle: string;
  registrations: number;
}) {
  const router = useRouter();
  const portal = usePortal();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteSession(sessionId);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    router.push(`/manage/${portal}/interventions/${result.data.interventionId}`);
  };

  return (
    <>
      <button type="button" className={`${btn} border-bad text-bad-ink`} onClick={() => setOpen(true)}>
        Delete session
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete this session?">
        <p className="text-sm">
          {sessionTitle} and its {registrations} registration{registrations === 1 ? "" : "s"}, attendance and feedback will be removed. This cannot be undone.
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-md bg-bad-soft p-3 text-sm text-bad-ink">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={btn} onClick={() => setOpen(false)}>
            Keep it
          </button>
          <button type="button" className={btnDanger} onClick={confirm} disabled={busy}>
            {busy ? "Deleting…" : "Delete session"}
          </button>
        </div>
      </Dialog>
    </>
  );
}

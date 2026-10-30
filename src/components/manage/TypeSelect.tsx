"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setInterventionType } from "@/app/manage/actions";
import { input } from "@/components/ui/styles";

// Admins change an intervention's type. Only new sessions use the new type (SPEC §4.4).
export function TypeSelect({ interventionId, type }: { interventionId: string; type: "open" | "selective" }) {
  const router = useRouter();
  const [value, setValue] = useState(type);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <select
        className={`${input} w-auto`}
        aria-label="Intervention type"
        value={value}
        onChange={async (e) => {
          const next = e.target.value as "open" | "selective";
          setValue(next);
          setError(null);
          const result = await setInterventionType(interventionId, next);
          if (!result.ok) {
            setValue(type);
            setError(result.error);
            return;
          }
          router.refresh();
        }}
      >
        <option value="open">Open intervention</option>
        <option value="selective">Selective intervention</option>
      </select>
      {error && <span className="text-sm text-bad-ink">{error}</span>}
    </div>
  );
}

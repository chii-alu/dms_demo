"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeStaff, setStaffRole } from "@/app/manage/actions";
import { btnPri, btnSm, card, input, label } from "@/components/ui/styles";

export type StaffRow = { userId: string; email: string; role: string; pillars: string[] };

const ROLES = [
  ["admin", "Admin (all pillars)"],
  ["pillar_lead", "Pillar lead"],
  ["pillar_staff", "Pillar staff"],
  ["reviewer", "Reviewer (assigned sessions only)"],
] as const;
const PILLARS = ["HENT", "HEMP", "HECO"] as const;

export function StaffAdmin({ rows }: { rows: StaffRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("pillar_staff");
  const [pillars, setPillars] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: string, r: string, p: string[]) => {
    setError(null);
    setBusy(true);
    const res = await setStaffRole(e, r, r === "admin" ? [] : p);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setEmail("");
    router.refresh();
  };

  const remove = async (userId: string, who: string) => {
    if (!window.confirm(`Remove staff access for ${who}?`)) return;
    setError(null);
    setBusy(true);
    const res = await removeStaff(userId);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <form
        className={`${card} grid gap-4 sm:grid-cols-[1fr_220px]`}
        onSubmit={(e) => {
          e.preventDefault();
          save(email, role, pillars);
        }}
      >
        <label className={label}>
          Account email
          <input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className={label}>
          Role
          <select className={input} value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {role !== "admin" && role !== "reviewer" && (
          <fieldset className="flex flex-wrap gap-4 text-sm sm:col-span-2">
            <legend className="mb-1 font-semibold">Pillars</legend>
            {PILLARS.map((p) => (
              <label key={p} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pillars.includes(p)}
                  onChange={(e) => setPillars((cur) => (e.target.checked ? [...cur, p] : cur.filter((x) => x !== p)))}
                />
                {p}
              </label>
            ))}
          </fieldset>
        )}
        <div className="sm:col-span-2">
          <button type="submit" className={btnPri} disabled={busy || !email}>
            {busy ? "Saving…" : "Grant or update access"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="rounded-md bg-bad-soft p-3 text-sm text-bad-ink">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-brand text-left text-xs font-semibold text-on-accent">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Pillars</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className="border-t border-line">
                <td className="px-3 py-2">{r.email}</td>
                <td className="px-3 py-2">{ROLES.find(([v]) => v === r.role)?.[1] ?? r.role}</td>
                <td className="px-3 py-2">{r.role === "admin" ? "All" : r.pillars.join(", ") || "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className={btnSm} onClick={() => remove(r.userId, r.email)} disabled={busy}>
                    Remove access
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-6 text-center text-muted">No staff yet.</div>}
      </div>
    </div>
  );
}

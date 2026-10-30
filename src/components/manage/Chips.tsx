// Server-safe badges used across the tracker (prototype: .chip, .st).
import type { SessionStatus } from "@/lib/rules/session-status";

const PILLAR_CLASS: Record<string, string> = {
  HENT: "bg-hent-soft text-hent-ink",
  HEMP: "bg-hemp-soft text-hemp-ink",
  HECO: "bg-heco-soft text-heco-ink",
};

export function PillarChip({ pillar }: { pillar: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${PILLAR_CLASS[pillar] ?? "bg-sunk"}`}>
      {pillar}
    </span>
  );
}

export function TypeChip({ type }: { type: "open" | "selective" }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
        type === "selective" ? "bg-accent-soft text-accent" : "border border-line bg-sunk text-muted"
      }`}
    >
      {type === "selective" ? "Selective" : "Open"}
    </span>
  );
}

const STATUS_CLASS: Record<SessionStatus, string> = {
  Upcoming: "bg-accent-soft text-accent",
  "In progress": "bg-ok-soft text-ok-ink",
  Completed: "bg-sunk text-muted",
  "Not scheduled": "bg-sunk text-muted",
};

export function StatusChip({ status }: { status: SessionStatus }) {
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>{status}</span>;
}

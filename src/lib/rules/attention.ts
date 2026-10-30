// "Needs attention" on the Overview (SPEC §7). Pure, so it can be tested without a database.
export type AttentionSession = {
  id: string;
  label: string;
  selective: boolean;
  dates: string[];
  applied: number;
  eligible: number;
  intakeStatus: "draft" | "open" | "closed";
  feedbackStatus: "draft" | "open" | "closed";
  attendanceDates: Set<string>;
};

export type AttentionItem = {
  sessionId: string;
  tab: "forms" | "people" | "attendance";
  text: string;
  detail: string;
  tone: "accent" | "warn" | "bad";
};

export function needsAttention(sessions: AttentionSession[], today: string): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const s of sessions) {
    if (s.selective && s.applied > 0) {
      items.push({
        sessionId: s.id,
        tab: "people",
        text: `${s.applied} application${s.applied === 1 ? "" : "s"} waiting for review`,
        detail: s.label,
        tone: "accent",
      });
    }

    const past = s.dates.filter((d) => d < today).sort();
    if (s.eligible > 0) {
      for (const d of past) {
        if (!s.attendanceDates.has(d)) {
          items.push({ sessionId: s.id, tab: "attendance", text: `Attendance not recorded for ${d}`, detail: s.label, tone: "bad" });
        }
      }
    }

    if (past.length > 0 && s.feedbackStatus === "draft") {
      items.push({ sessionId: s.id, tab: "forms", text: "Feedback form not opened yet", detail: s.label, tone: "warn" });
    }

    const first = [...s.dates].sort()[0];
    if (first && first > today && s.intakeStatus === "draft") {
      items.push({
        sessionId: s.id,
        tab: "forms",
        text: `${s.selective ? "Application" : "Registration"} form still in draft`,
        detail: `${s.label} · starts ${first}`,
        tone: "warn",
      });
    }
  }
  return items;
}

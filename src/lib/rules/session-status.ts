// SPEC §4.1. Dates are ISO yyyy-mm-dd strings, so string comparison orders them correctly.
export type SessionStatus = "Not scheduled" | "Upcoming" | "In progress" | "Completed";

export function sessionStatus(dates: string[], today: string): SessionStatus {
  if (dates.length === 0) return "Not scheduled";
  const sorted = [...dates].sort();
  if (sorted[sorted.length - 1] < today) return "Completed";
  if (sorted[0] > today) return "Upcoming";
  return "In progress";
}

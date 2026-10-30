// Entry statuses (SPEC §3). Open sessions use the first group, selective sessions the second.
export const ENTRY_STATUSES = [
  "registered",
  "waitlisted",
  "cancelled",
  "applied",
  "shortlisted",
  "selected",
  "rejected",
  "withdrawn",
] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const OPEN_STATUSES: EntryStatus[] = ["registered", "waitlisted", "cancelled"];
export const SELECTIVE_STATUSES: EntryStatus[] = ["applied", "shortlisted", "selected", "waitlisted", "rejected", "withdrawn"];

export const STATUS_LABEL: Record<EntryStatus, string> = {
  registered: "Registered",
  waitlisted: "Waitlisted",
  cancelled: "Cancelled",
  applied: "To review",
  shortlisted: "Shortlisted",
  selected: "Selected",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

export const statusesFor = (selective: boolean) => (selective ? SELECTIVE_STATUSES : OPEN_STATUSES);

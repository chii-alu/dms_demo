// Session status and "today" use the programme's timezone (Rwanda, UTC+2), not the server's.
const PROGRAMME_TZ = "Africa/Kigali";

// Today as yyyy-mm-dd in the programme's timezone.
export function todayIso(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PROGRAMME_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateRange(dates: string[]) {
  const sorted = [...dates].sort();
  if (sorted.length === 0) return "No dates set";
  if (sorted.length === 1) return formatDate(sorted[0]);
  const short = new Date(sorted[0] + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${short} – ${formatDate(sorted[sorted.length - 1])} · ${sorted.length} dates`;
}

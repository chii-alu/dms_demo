// SPEC §4.14: a participant completes a multi-date session when attended ≥ completion_threshold × number of dates.
export function isCompleted(attendedDates: number, totalDates: number, threshold: number) {
  if (totalDates <= 0) return false;
  return attendedDates >= threshold * totalDates;
}

// Feedback summary helpers (prototype's tFb()).
export function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

// Net promoter score: % promoters (9–10) minus % detractors (0–6), rounded. 0 when there are no responses.
export function netPromoterScore(scores: number[]) {
  if (scores.length === 0) return 0;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

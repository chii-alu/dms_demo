// SPEC §4.13: weighted score = Σ(score/5 × weight) / Σweight × 100, averaged across reviewers.
// A reviewer's score counts only when every criterion is scored. Shown only when at least one reviewer has scored all.
export type Criterion = { id: string; weight: number };
export type CriterionScores = Record<string, number>;

function rawReviewerScore(criteria: Criterion[], scores: CriterionScores): number | null {
  if (criteria.length === 0) return null;
  let total = 0;
  let weight = 0;
  for (const c of criteria) {
    const s = scores[c.id];
    if (s == null) return null;
    total += (s / 5) * c.weight;
    weight += c.weight;
  }
  return weight === 0 ? null : (total / weight) * 100;
}

export function reviewerScore(criteria: Criterion[], scores: CriterionScores): number | null {
  const raw = rawReviewerScore(criteria, scores);
  return raw == null ? null : Math.round(raw);
}

// byReviewer: reviewer id -> that reviewer's scores for one application.
export function applicationScore(criteria: Criterion[], byReviewer: Record<string, CriterionScores>): number | null {
  const values = Object.values(byReviewer)
    .map((s) => rawReviewerScore(criteria, s))
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

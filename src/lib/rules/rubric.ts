// SPEC §4.13 (weights). Scoring itself arrives in milestone 4.
export const RUBRIC_TARGET_WEIGHT = 100;

export function rubricWeightTotal(weights: number[]) {
  return weights.reduce((sum, w) => sum + (Number.isFinite(w) ? w : 0), 0);
}

export function rubricWeightWarning(weights: number[]) {
  const total = rubricWeightTotal(weights);
  return total === RUBRIC_TARGET_WEIGHT ? null : `Weights add up to ${total}%, not ${RUBRIC_TARGET_WEIGHT}%.`;
}

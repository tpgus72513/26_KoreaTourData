import { evaluateRegion, type EvaluationInput, type EvaluationModel, type EvaluationResult } from './engine';

const RANK_TOLERANCE = 1e-9;

export interface SensitivityScenario {
  id: string;
  label: string;
  weights: number[];
  results: EvaluationResult[];
  ranks: Array<number | null>;
}

export interface SensitivitySummary {
  regionId: string;
  minScore: number | null;
  maxScore: number | null;
  minRank: number | null;
  maxRank: number | null;
}

export interface SensitivityAnalysis {
  scenarios: SensitivityScenario[];
  summaries: SensitivitySummary[];
}

function cohortRanks(results: EvaluationResult[]): Array<number | null> {
  if (results.some((result) => result.totalScore === null || result.gateStatus !== 'reviewable')) {
    return results.map(() => null);
  }

  const ordered = results.map((result, index) => ({ index, score: result.totalScore! }))
    .sort((left, right) => right.score - left.score);
  const ranks: number[] = Array(results.length);
  let rank = 1;
  let groupHighestScore = ordered[0].score;
  for (const [index, result] of ordered.entries()) {
    // Compare with the highest score in a tie group, avoiding chained near-ties.
    if (groupHighestScore - result.score > RANK_TOLERANCE) {
      rank = index + 1;
      groupHighestScore = result.score;
    }
    ranks[result.index] = rank;
  }
  return ranks;
}

/**
 * Descriptive condition-score scenarios, not business priorities or confidence intervals.
 * Relative +/-20% is a service-defined stress test, not a validated universal threshold.
 * Requires a nonempty cohort with the same evaluation period. One incomplete or gated
 * region withholds every cohort rank.
 * Domain order determines weights[]; input order determines results[], ranks[], summaries[].
 */
export function analyzeSensitivity(model: EvaluationModel, inputs: EvaluationInput[]): SensitivityAnalysis {
  if (inputs.length === 0) {
    throw new Error('Sensitivity analysis requires at least one region');
  }
  if (new Set(inputs.map((input) => input.regionId)).size !== inputs.length) {
    throw new Error('Duplicate region identifiers cannot be compared');
  }

  const createScenario = (id: string, label: string, weights: number[]): SensitivityScenario => {
    const scenarioModel: EvaluationModel = {
      ...model,
      domains: model.domains.map((domain, index) => ({ ...domain, weight: weights[index] })),
    };
    const results = inputs.map((input) => evaluateRegion(scenarioModel, input));
    return { id, label, weights, results, ranks: cohortRanks(results) };
  };

  const originalWeights = model.domains.map((domain) => domain.weight);
  // Validate and evaluate the baseline before normalization could hide invalid weights.
  const scenarios = [createScenario('baseline', '현재 가중치', originalWeights)];
  if (inputs.some((input) => input.period.start !== inputs[0].period.start || input.period.end !== inputs[0].period.end)) {
    throw new Error('Compared regions must use the same evaluation period');
  }
  scenarios.push(createScenario('equal', '영역 동등 가중치', originalWeights.map(() => 1 / originalWeights.length)));

  for (const [domainIndex, domain] of model.domains.entries()) {
    for (const { factor, suffix, sign } of [
      { factor: 0.8, suffix: 'minus-20', sign: '−' },
      { factor: 1.2, suffix: 'plus-20', sign: '+' },
    ]) {
      const changed = originalWeights.map((weight, index) => index === domainIndex ? weight * factor : weight);
      const sum = changed.reduce((total, weight) => total + weight, 0);
      scenarios.push(createScenario(
        `${domain.id}-${suffix}`,
        `${domain.label} 가중치 상대 ${sign}20% · 재정규화`,
        changed.map((weight) => weight / sum),
      ));
    }
  }

  const summaries = inputs.map((input, index): SensitivitySummary => {
    const scores = scenarios.map((scenario) => scenario.results[index].totalScore)
      .filter((score): score is number => score !== null);
    const ranks = scenarios.map((scenario) => scenario.ranks[index])
      .filter((rank): rank is number => rank !== null);
    return {
      regionId: input.regionId,
      minScore: scores.length ? Math.min(...scores) : null,
      maxScore: scores.length ? Math.max(...scores) : null,
      minRank: ranks.length ? Math.min(...ranks) : null,
      maxRank: ranks.length ? Math.max(...ranks) : null,
    };
  });
  return { scenarios, summaries };
}

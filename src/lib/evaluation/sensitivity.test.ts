import { describe, expect, it } from 'vitest';

import type { EvaluationInput, EvaluationModel } from './engine';
import { analyzeSensitivity } from './sensitivity';

const period = { start: '2026-08-01', end: '2026-08-31' };
const model = (): EvaluationModel => ({
  version: 'illustrative-v1', status: 'illustrative', weightMethod: '동등 가중치 예시',
  domains: ['resource', 'stay', 'mobility', 'access', 'sustain'].map((id) => ({
    id, label: id, weight: 0.2,
    indicators: [{
      id, label: id, unit: '%', weight: 1, lower: 0, upper: 100, direction: 'benefit',
      benchmarkRationale: '시연을 위한 고정 기준', referenceIds: ['R7'], denominator: '지정 조사대상',
    }],
  })),
});
const input = (regionId = 'region-a', values: Array<number | null> = [80, 60, 70, 50, 65]): EvaluationInput => ({
  regionId, dataVersion: 'example-data-v1', period,
  observations: model().domains.map((domain, index) => ({
    indicatorId: domain.id, value: values[index], unit: '%', source: '시연용 조사 기록', period,
    scope: regionId, denominator: '지정 조사대상', kind: 'example',
  })),
  gates: [{ id: 'route', label: '필수 동선', status: 'pass', source: '시연용 현장 기록' }],
});

describe('weight sensitivity scenarios', () => {
  it('calculates the illustrative example and independent one-at-a-time perturbations', () => {
    const result = analyzeSensitivity(model(), [input()]);
    expect(result.scenarios).toHaveLength(12);
    expect(result.scenarios[0]).toMatchObject({ id: 'baseline', weights: [0.2, 0.2, 0.2, 0.2, 0.2] });
    expect(result.scenarios[0].results[0].totalScore).toBe(65);
    expect(result.scenarios.find((scenario) => scenario.id === 'resource-plus-20')?.results[0].totalScore).toBeCloseTo(65.57692307692308, 9);
    expect(result.scenarios.find((scenario) => scenario.id === 'resource-minus-20')?.results[0].totalScore).toBeCloseTo(64.375, 9);
    expect(result.scenarios.every((scenario) => Math.abs(scenario.weights.reduce((sum, value) => sum + value, 0) - 1) < 1e-12)).toBe(true);
    expect(result.summaries[0]).toMatchObject({ regionId: 'region-a', minRank: 1, maxRank: 1 });
    expect(result.summaries[0].minScore).toBeCloseTo(64.375, 9);
    expect(result.summaries[0].maxScore).toBeCloseTo(65.625, 9);
  });

  it('changes only domain weights in the equal-weight scenario', () => {
    const custom = model();
    custom.domains = custom.domains.slice(0, 2);
    custom.domains[0].weight = 0.75;
    custom.domains[1].weight = 0.25;
    custom.domains[0].indicators[0].weight = 0.75;
    custom.domains[0].indicators.push({ ...custom.domains[0].indicators[0], id: 'resource-extra', weight: 0.25 });
    const data = input();
    data.observations = [
      { ...data.observations[0], value: 0 },
      { ...data.observations[0], indicatorId: 'resource-extra', value: 100 },
      { ...data.observations[1], value: 100 },
    ];
    const result = analyzeSensitivity(custom, [data]);
    expect(result.scenarios[0].results[0].totalScore).toBe(43.75);
    const equal = result.scenarios.find((scenario) => scenario.id === 'equal');
    expect(equal?.weights).toEqual([0.5, 0.5]);
    expect(equal?.results[0].totalScore).toBe(62.5);
    expect(equal?.results[0].domains[0].indicators.map((indicator) => indicator.weight)).toEqual([0.375, 0.125]);
  });

  it('uses competition ranks for tied scores, including small numerical noise', () => {
    const result = analyzeSensitivity(model(), [
      input('a', [65, 65, 65, 65, 65]),
      input('b', Array(5).fill(65 + 5e-10)),
      input('c', [50, 50, 50, 50, 50]),
    ]);
    expect(result.scenarios.every((scenario) => JSON.stringify(scenario.ranks) === '[1,1,3]')).toBe(true);
  });

  it('preserves a real score difference above the tie tolerance', () => {
    const result = analyzeSensitivity(model(), [
      input('a', [65, 65, 65, 65, 65]),
      input('b', Array(5).fill(65 + 2e-8)),
    ]);
    expect(result.scenarios[0].ranks).toEqual([2, 1]);
  });

  it('withholds every rank when one member of the comparison cohort has missing evidence', () => {
    const result = analyzeSensitivity(model(), [input(), input('incomplete', [80, 60, 70, null, 65])]);
    expect(result.scenarios.every((scenario) => scenario.ranks.every((rank) => rank === null))).toBe(true);
    expect(result.summaries[0].minScore).not.toBeNull();
    expect(result.summaries[0].minRank).toBeNull();
    expect(result.summaries[1]).toEqual({ regionId: 'incomplete', minScore: null, maxScore: null, minRank: null, maxRank: null });
  });

  it.each(['fail', 'unknown'] as const)('withholds cohort ranks when a required gate is %s', (status) => {
    const blocked = input('blocked');
    blocked.gates[0].status = status;
    const result = analyzeSensitivity(model(), [input(), blocked]);
    expect(result.scenarios.every((scenario) => scenario.ranks.every((rank) => rank === null))).toBe(true);
    expect(result.summaries[1].minScore).not.toBeNull();
    expect(result.summaries[1].maxRank).toBeNull();
  });

  it('keeps region scores and ranks unchanged when the input order changes', () => {
    const inputs = [input('a'), input('b', [60, 90, 40, 70, 50]), input('c', [50, 50, 50, 50, 50])];
    const forward = analyzeSensitivity(model(), inputs);
    const reverse = analyzeSensitivity(model(), [...inputs].reverse());
    for (const scenario of forward.scenarios) {
      const reordered = reverse.scenarios.find((candidate) => candidate.id === scenario.id)!;
      for (const [index, result] of scenario.results.entries()) {
        const otherIndex = reordered.results.findIndex((candidate) => candidate.regionId === result.regionId);
        expect(reordered.results[otherIndex]).toEqual(result);
        expect(reordered.ranks[otherIndex]).toBe(scenario.ranks[index]);
      }
    }
    expect(reverse.summaries).toEqual([...forward.summaries].reverse());
  });

  it('does not mutate model weights or observations', () => {
    const definition = model();
    const data = [input()];
    const before = JSON.stringify({ definition, data });
    analyzeSensitivity(definition, data);
    expect(JSON.stringify({ definition, data })).toBe(before);
  });

  it('rejects an empty cohort rather than returning a misleading comparison', () => {
    expect(() => analyzeSensitivity(model(), [])).toThrow(/at least one region/i);
  });

  it('rejects duplicate region identifiers', () => {
    expect(() => analyzeSensitivity(model(), [input(), input()])).toThrow(/duplicate region/i);
  });

  it('rejects regions measured in different evaluation periods', () => {
    const previous = input('previous');
    previous.period = { start: '2026-07-01', end: '2026-07-31' };
    previous.observations = previous.observations.map((observation) => ({ ...observation, period: previous.period }));
    expect(() => analyzeSensitivity(model(), [input(), previous])).toThrow(/same evaluation period/i);
  });

  it('lets the evaluation engine reject invalid baseline weights', () => {
    const invalid = model();
    invalid.domains[0].weight = 0.9;
    expect(() => analyzeSensitivity(invalid, [input()])).toThrow();
  });
});

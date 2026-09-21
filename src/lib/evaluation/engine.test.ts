import { describe, expect, it } from 'vitest';

import { evaluateRegion, normalizeIndicator, type EvaluationInput, type EvaluationModel, type IndicatorDefinition, type Observation } from './engine';

const period = { start: '2026-08-01', end: '2026-08-31' };
const indicator = (id: string, weight = 1): IndicatorDefinition => ({
  id, label: id, unit: '%', weight, lower: 0, upper: 100, direction: 'benefit',
  benchmarkRationale: '예시 기준 범위', referenceIds: ['R7'], denominator: '조사대상 전체',
});
const model = (): EvaluationModel => ({
  version: 'example-v1', status: 'illustrative', weightMethod: '동일 가중치 예시',
  domains: ['resource', 'stay', 'spend', 'access', 'sustain'].map((id) => ({
    id, label: id, weight: 0.2, indicators: [indicator(id)],
  })),
});
const input = (values: Array<number | null> = [80, 60, 70, 50, 65]): EvaluationInput => ({
  regionId: 'region-a', dataVersion: 'snapshot-v1', period,
  observations: model().domains.map((domain, index) => ({
    indicatorId: domain.id, value: values[index], source: '현장 조사 2026-08', period,
    scope: 'region-a', denominator: '조사대상 전체', unit: '%', kind: 'observed',
  })),
  gates: [{ id: 'safety', label: '안전 확인', status: 'pass', source: '현장 기록 1' }],
});

describe('literature-informed weighted evaluation', () => {
  it('aggregates independently specified indicators, with traceable global contributions', () => {
    const result = evaluateRegion(model(), input());
    expect(result.totalScore).toBe(65);
    expect(result.coveragePercent).toBe(100);
    expect(result.range).toEqual({ lower: 65, upper: 65 });
    expect(result.domains.map((domain) => domain.score)).toEqual([80, 60, 70, 50, 65]);
    expect(result.domains.map((domain) => domain.contribution)).toEqual([16, 12, 14, 10, 13]);
    expect(result.domains[0].indicators[0]).toMatchObject({ weight: 0.2, contribution: 16, source: '현장 조사 2026-08', period, scope: 'region-a' });
    expect(result.gateStatus).toBe('reviewable');
  });

  it('uses domain and internal indicator weights once each', () => {
    const custom = model();
    custom.domains = [{ id: 'resource', label: 'resource', weight: 1,
      indicators: [indicator('one', 0.5), indicator('two', 0.25), indicator('three', 0.25)] }];
    const data = input();
    data.observations = [70, 10, 100].map((value, index) => ({ ...data.observations[0], indicatorId: ['one', 'two', 'three'][index], value }));
    expect(evaluateRegion(custom, data).totalScore).toBe(62.5);
  });

  it('does not replace missing values with zero or redistribute their weights', () => {
    const result = evaluateRegion(model(), input([80, 60, 70, null, 65]));
    expect(result.totalScore).toBeNull();
    expect(result.coveragePercent).toBe(80);
    expect(result.range).toEqual({ lower: 55, upper: 75 });
    expect(result.domains[3].score).toBeNull();
    expect(result.domains[3].contribution).toBeNull();
    expect(result.missingIndicatorIds).toEqual(['access']);
    expect(result.gateStatus).toBe('field-required');
  });

  it('reports a full unknown interval when no measurements exist', () => {
    const data = input();
    data.observations = [];
    const result = evaluateRegion(model(), data);
    expect(result.totalScore).toBeNull();
    expect(result.coveragePercent).toBe(0);
    expect(result.range).toEqual({ lower: 0, upper: 100 });
    expect(result.domains[0].indicators[0].unavailableReason).toBeTruthy();
  });

  it('accepts measured zero and genuine proxy observations while preserving their kind', () => {
    const data = input([0, 0, 0, 0, 0]);
    data.observations[0].kind = 'proxy';
    expect(evaluateRegion(model(), data).totalScore).toBe(0);
    expect(evaluateRegion(model(), data).domains[0].indicators[0].kind).toBe('proxy');
  });

  it.each([
    { value: Number.NaN }, { value: Number.POSITIVE_INFINITY }, { value: '50' },
    { source: '' }, { source: '   ' }, { scope: 'city-wide' }, { denominator: '다른 분모' }, { unit: '명' },
    { period: { start: '2026-08-01', end: '2026-08-30' } },
    { period: { start: '2026-02-30', end: '2026-08-31' } }, { period: null },
    { kind: 'estimated' },
  ])('withholds a measurement with invalid evidence metadata: %j', (patch) => {
    const data = input();
    data.observations[0] = { ...data.observations[0], ...patch } as Observation;
    const result = evaluateRegion(model(), data);
    expect(result.totalScore).toBeNull();
    expect(result.coveragePercent).toBe(80);
    expect(result.missingIndicatorIds).toContain('resource');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('allows synthetic values only under an illustrative model', () => {
    const data = input();
    data.observations[0].kind = 'example';
    expect(evaluateRegion(model(), data).totalScore).toBe(65);
    expect(evaluateRegion({ ...model(), status: 'provisional' }, data).totalScore).toBeNull();
  });

  it('rejects duplicate and unknown observation identifiers instead of counting twice', () => {
    const duplicate = input();
    duplicate.observations.push(duplicate.observations[0]);
    expect(() => evaluateRegion(model(), duplicate)).toThrow();
    const unknown = input();
    unknown.observations[0].indicatorId = 'unregistered';
    expect(() => evaluateRegion(model(), unknown)).toThrow();
  });

  it.each([
    (m: EvaluationModel) => { m.domains[0].weight = 0; },
    (m: EvaluationModel) => { m.domains[0].weight = 0.5; },
    (m: EvaluationModel) => { m.domains[0].indicators[0].weight = 0.5; },
    (m: EvaluationModel) => { m.domains[0].indicators[0].upper = 0; },
    (m: EvaluationModel) => { m.domains[0].indicators[0].lower = Number.NaN; },
    (m: EvaluationModel) => { m.domains[0].indicators[0].referenceIds = []; },
    (m: EvaluationModel) => { m.domains[0].indicators[0].benchmarkRationale = ''; },
    (m: EvaluationModel) => { m.domains[0].indicators[0].denominator = ''; },
    (m: EvaluationModel) => { m.domains[1].indicators[0].id = 'resource'; },
    (m: EvaluationModel) => { m.domains[1].id = 'resource'; },
  ])('rejects invalid model definitions before calculating', (breakModel) => {
    const invalid = model();
    breakModel(invalid);
    expect(() => evaluateRegion(invalid, input())).toThrow();
  });

  it('rejects invalid or reversed evaluation periods', () => {
    const data = input();
    data.period = { start: '2026-02-30', end: '2026-08-31' };
    expect(() => evaluateRegion(model(), data)).toThrow();
    data.period = { start: '2026-09-01', end: '2026-08-31' };
    expect(() => evaluateRegion(model(), data)).toThrow();
  });

  it('does not compensate a failed safety gate with a high score', () => {
    const data = input([100, 100, 100, 100, 100]);
    data.gates[0].status = 'fail';
    const result = evaluateRegion(model(), data);
    expect(result.totalScore).toBe(100);
    expect(result.gateStatus).toBe('blocked');
  });

  it.each([[], [{ id: 'safety', label: '안전', status: 'unknown' as const, source: '' }], [{ id: 'safety', label: '안전', status: 'pass' as const, source: '' }]].map((gates) => ({ gates })))('requires field verification for unverified gates', ({ gates }) => {
    expect(evaluateRegion(model(), { ...input(), gates }).gateStatus).toBe('field-required');
  });

  it('treats an unsupported failure as unknown instead of making an evidence-free block', () => {
    const data = input();
    data.gates[0] = { ...data.gates[0], status: 'fail', source: '   ' };
    const result = evaluateRegion(model(), data);
    expect(result.gateStatus).toBe('field-required');
    expect(result.gates[0].status).toBe('unknown');
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('fixed-reference normalization', () => {
  it.each([[-5, 0], [0, 0], [70, 70], [100, 100], [120, 100]])('clips %s to %s', (value, expected) => {
    expect(normalizeIndicator(value, indicator('x'))).toBe(expected);
  });
  it('reverses a cost indicator and respects nonzero fixed bounds', () => {
    expect(normalizeIndicator(20, { ...indicator('x'), lower: 10, upper: 50, direction: 'cost' })).toBe(75);
  });
  it('rejects nonfinite normalization inputs', () => {
    expect(() => normalizeIndicator(Number.NaN, indicator('x'))).toThrow();
  });
});

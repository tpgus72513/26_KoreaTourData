import { describe, expect, it } from 'vitest';

import { aggregateAhp, calculateAhp } from './ahp';

describe('AHP principal-eigenvector weights and consistency', () => {
  it('recovers known ratio-scale weights for a consistent reciprocal matrix', () => {
    const result = calculateAhp([[1, 2, 4], [0.5, 1, 2], [0.25, 0.5, 1]]);
    expect(result.weights[0]).toBeCloseTo(4 / 7, 10);
    expect(result.weights[1]).toBeCloseTo(2 / 7, 10);
    expect(result.weights[2]).toBeCloseTo(1 / 7, 10);
    expect(result.lambdaMax).toBeCloseTo(3, 10);
    expect(result.ci).toBeCloseTo(0, 10);
    expect(result.cr).toBeCloseTo(0, 10);
    expect(result.consistent).toBe(true);
  });

  it('uses CR null for the two-comparison case where RI is zero', () => {
    const result = calculateAhp([[1, 3], [1 / 3, 1]]);
    expect(result.weights).toEqual([0.75, 0.25]);
    expect(result.cr).toBeNull();
    expect(result.consistent).toBe(true);
  });

  it('marks strongly contradictory preferences inconsistent', () => {
    const result = calculateAhp([[1, 9, 1 / 9], [1 / 9, 1, 9], [9, 1 / 9, 1]]);
    expect(result.cr).toBeGreaterThan(0.1);
    expect(result.consistent).toBe(false);
  });

  it('matches an independently calculated inconsistent-but-acceptable golden eigenpair', () => {
    const result = calculateAhp([[1, 3, 5], [1 / 3, 1, 2], [1 / 5, 1 / 2, 1]]);
    expect(result.weights[0]).toBeCloseTo(0.6483290138222366, 10);
    expect(result.weights[1]).toBeCloseTo(0.2296507940626371, 10);
    expect(result.weights[2]).toBeCloseTo(0.1220201921151262, 10);
    expect(result.lambdaMax).toBeCloseTo(3.00369459806364, 10);
    expect(result.cr).toBeCloseTo(0.003184998330724, 10);
    expect(result.consistent).toBe(true);
  });

  it.each([
    [], [[1]], [[1, 2], [1, 1]], [[2, 2], [0.5, 1]], [[1, 10], [0.1, 1]],
    [[1, 0], [Number.POSITIVE_INFINITY, 1]], [[1, 2, 3], [0.5, 1]],
    [[1, Number.NaN], [0.5, 1]],
  ].map((matrix) => ({ matrix })))('rejects invalid pairwise matrices $matrix', ({ matrix }) => {
    expect(() => calculateAhp(matrix)).toThrow();
  });

  it('aggregates reciprocal judgments geometrically rather than averaging their weights', () => {
    const result = aggregateAhp([[[1, 9], [1 / 9, 1]], [[1, 1], [1, 1]]]);
    expect(result.weights[0]).toBeCloseTo(0.75, 10);
    expect(result.weights[1]).toBeCloseTo(0.25, 10);
  });

  it('rejects an inconsistent expert matrix instead of silently excluding the expert', () => {
    expect(() => aggregateAhp([[[1, 9, 1 / 9], [1 / 9, 1, 9], [9, 1 / 9, 1]]])).toThrow();
  });

  it('requires a nonempty set of equal-sized matrices', () => {
    expect(() => aggregateAhp([])).toThrow();
    expect(() => aggregateAhp([[[1, 1], [1, 1]], [[1, 1, 1], [1, 1, 1], [1, 1, 1]]])).toThrow();
  });
});

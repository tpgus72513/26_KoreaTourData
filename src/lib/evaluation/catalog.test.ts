import { describe, expect, test } from 'vitest';
import { demoSnapshot } from '../demo';
import { createDemoEvaluation, getEvaluationBundle } from './catalog';

describe('evaluation integration', () => {
  test('keeps the displayed total equal to the contributions and input-based result', () => {
    for (const region of demoSnapshot.regions) {
      const bundle = getEvaluationBundle(demoSnapshot, region.id)!;
      expect(region.potentialScore).toBe(bundle.result.totalScore);
      if (bundle.result.totalScore !== null) {
        expect(bundle.result.domains.reduce((sum, domain) => sum + domain.contribution!, 0)).toBeCloseTo(region.potentialScore!, 10);
      }
      expect(bundle.input.observations.every((observation) => observation.kind === 'example')).toBe(true);
    }
  });

  test('keeps incomplete inputs distinct from zero and complete inputs', () => {
    const { result } = createDemoEvaluation('hahoemaeul');
    expect(result.totalScore).toBeNull();
    expect(result.range).toEqual({ lower: 55, upper: 75 });
    expect(result.coveragePercent).toBe(80);
    expect(result.missingIndicatorIds).toEqual(['accessibility-ratio']);
  });

  test('does not expose synthetic evidence when a snapshot is marked live', () => {
    expect(getEvaluationBundle({ ...demoSnapshot, mode: 'live' }, 'old-town-wolyeonggyo')).toBeNull();
  });

  test('returns independently editable copies to the experiment UI', () => {
    const first = createDemoEvaluation('old-town-wolyeonggyo');
    first.input.observations[0].value = 0;
    first.model.domains[0].weight = 0.8;
    const second = createDemoEvaluation('old-town-wolyeonggyo');
    expect(second.input.observations[0].value).toBe(80);
    expect(second.model.domains[0].weight).toBe(0.2);
  });
});

import { describe, expect, test } from 'vitest';

import { demoSnapshot } from './demo';

describe('demoSnapshot', () => {
  test('labels every illustrative score as a non-policy demo value', () => {
    expect(demoSnapshot.mode).toBe('demo');
    expect(demoSnapshot.disclaimer).toContain('시연 데이터 · 실제 지역평가 아님');

    for (const region of demoSnapshot.regions) {
      expect(region.evidenceStatus).toBe('example');
      expect(region.confidenceScore).toBeNull();
    }
  });

  test('uses the documented synthetic calculation instead of arbitrary totals', () => {
    expect(demoSnapshot.regions[0].potentialScore).toBe(65);
    expect(demoSnapshot.regions[1].potentialScore).toBeNull();
    expect(demoSnapshot.regions[2].potentialScore).toBe(51);
  });

  test('does not recommend business planning before mandatory conditions are checked', () => {
    for (const region of demoSnapshot.regions) {
      if (region.evaluation?.result.gateStatus !== 'reviewable') {
        expect(region.recommendation).not.toBe('business-planning');
      }
    }
  });
});

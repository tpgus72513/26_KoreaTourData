import { describe, expect, test } from 'vitest';

import { demoSnapshot } from './demo';

describe('demoSnapshot', () => {
  test('labels every illustrative score as a non-policy demo value', () => {
    expect(demoSnapshot.mode).toBe('demo');
    expect(demoSnapshot.disclaimer).toContain('예시 데이터 · 정책 판단 금지');

    for (const region of demoSnapshot.regions) {
      expect(region.evidenceStatus).toBe('example');
      expect(region.potentialScore).toEqual(expect.any(Number));
      expect(region.confidenceScore).toEqual(expect.any(Number));
    }
  });
});

import { describe, expect, test } from 'vitest';

import { REGIONS } from './domain';

describe('REGIONS', () => {
  test('keeps the three policy comparison regions in their canonical order', () => {
    expect(REGIONS.map((region) => [region.id, region.name])).toEqual([
      ['old-town-wolyeonggyo', '원도심·월영교권'],
      ['hahoemaeul', '하회마을권'],
      ['dosan-yekki', '도산·예끼마을권'],
    ]);
  });
});

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('/report rendering mode', () => {
  it('forces request-time rendering for live task data', () => {
    const source = readFileSync('src/app/report/page.tsx', 'utf8');

    expect(source).toContain("export const dynamic = 'force-dynamic';");
  });

  it('does not serialize live tasks before an administrator logs in', () => {
    const source = readFileSync('src/app/report/page.tsx', 'utf8');

    expect(source).toContain('listPersistedTasksForAdmin');
    expect(source).toContain('로그인 후 저장된 현장검증 과제를 볼 수 있습니다.');
  });
});

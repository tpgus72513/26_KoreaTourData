import { afterEach, describe, expect, it } from 'vitest';

import { GET, POST } from './route';

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

describe('/api/sync', () => {
  it('returns 401 for missing or malformed bearer authorization without starting a write', async () => {
    process.env.CRON_SECRET = 'expected-cron-secret';

    const missing = await GET(new Request('http://localhost/api/sync'));
    const malformed = await POST(
      new Request('http://localhost/api/sync', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-secret' },
      }),
    );

    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ error: '인증에 실패했습니다.' });
    expect(malformed.status).toBe(401);
    expect(await malformed.json()).toEqual({ error: '인증에 실패했습니다.' });
  });
});

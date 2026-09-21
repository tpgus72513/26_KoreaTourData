import { afterEach, describe, expect, it } from 'vitest';

import { DELETE, POST } from './route';

const originalEnvironment = {
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  SESSION_SECRET: process.env.SESSION_SECRET,
};

afterEach(() => {
  process.env.ADMIN_PASSWORD = originalEnvironment.ADMIN_PASSWORD;
  process.env.SESSION_SECRET = originalEnvironment.SESSION_SECRET;
});

describe('POST /api/session', () => {
  it('returns 401 without setting a session cookie for a wrong password', async () => {
    process.env.ADMIN_PASSWORD = 'correct-password';
    process.env.SESSION_SECRET = 'a-long-local-test-secret';

    const response = await POST(
      new Request('http://localhost/api/session', {
        method: 'POST',
        body: JSON.stringify({ password: 'wrong-password' }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: '인증에 실패했습니다.' });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('sets an HttpOnly SameSite administrator session cookie after valid credentials', async () => {
    process.env.ADMIN_PASSWORD = 'correct-password';
    process.env.SESSION_SECRET = 'a-long-local-test-secret';

    const response = await POST(
      new Request('http://localhost/api/session', {
        method: 'POST',
        body: JSON.stringify({ password: 'correct-password' }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toMatch(/admin_session=.*HttpOnly.*SameSite=strict/i);
  });
});

describe('DELETE /api/session', () => {
  it('expires the administrator session cookie', async () => {
    const response = await DELETE();

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toMatch(/admin_session=;.*Max-Age=0/i);
  });
});

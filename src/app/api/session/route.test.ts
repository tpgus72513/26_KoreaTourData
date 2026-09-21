import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_SESSION_COOKIE, createAdminSession } from '../../../lib/auth';
import { DELETE, GET, POST } from './route';

const originalEnvironment = {
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  SESSION_SECRET: process.env.SESSION_SECRET,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('GET /api/session', () => {
  it('reports verified session state without exposing or refreshing a token', async () => {
    process.env.SESSION_SECRET = 'a-long-local-test-secret';
    const token = await createAdminSession();
    const response = await GET(new Request('http://localhost/api/session', {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: true });
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it.each([null, 'admin_session=invalid'])('does not authenticate an absent or invalid cookie: %s', async (cookie) => {
    process.env.SESSION_SECRET = 'a-long-local-test-secret';
    const response = await GET(new Request('http://localhost/api/session', {
      headers: cookie ? { cookie } : {},
    }));
    expect(await response.json()).toEqual({ authenticated: false });
  });
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

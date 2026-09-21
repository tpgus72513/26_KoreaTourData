import { afterEach, describe, expect, it } from 'vitest';

import {
  createAdminSession,
  isValidAdminPassword,
  verifyAdminSession,
} from './auth';

const originalEnvironment = {
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  SESSION_SECRET: process.env.SESSION_SECRET,
};

afterEach(() => {
  process.env.ADMIN_PASSWORD = originalEnvironment.ADMIN_PASSWORD;
  process.env.SESSION_SECRET = originalEnvironment.SESSION_SECRET;
});

describe('administrator session', () => {
  it('rejects a wrong password without exposing whether a credential is configured', async () => {
    process.env.ADMIN_PASSWORD = 'correct-password';

    await expect(isValidAdminPassword('wrong-password')).resolves.toBe(false);
  });

  it('creates a signed session that expires', async () => {
    process.env.SESSION_SECRET = 'a-long-local-test-secret';

    const session = await createAdminSession(new Date('2026-09-21T00:00:00.000Z'));

    await expect(
      verifyAdminSession(session, new Date('2026-09-21T07:59:59.000Z')),
    ).resolves.toBe(true);
    await expect(
      verifyAdminSession(session, new Date('2026-09-21T08:00:00.000Z')),
    ).resolves.toBe(false);
  });

  it('treats a malformed cookie signature as unauthenticated rather than throwing', async () => {
    process.env.SESSION_SECRET = 'a-long-local-test-secret';

    await expect(verifyAdminSession('payload.x')).resolves.toBe(false);
  });
});

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'admin_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

type SessionPayload = {
  exp: number;
  role: 'admin';
};

function encode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function decode(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function fixedLengthHash(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export async function isValidAdminPassword(password: unknown): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;

  if (typeof password !== 'string' || !expected) {
    return false;
  }

  return timingSafeEqual(fixedLengthHash(password), fixedLengthHash(expected));
}

export async function createAdminSession(now = new Date()): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('관리자 세션을 구성할 수 없습니다.');
  }

  const payload: SessionPayload = {
    exp: now.getTime() + SESSION_DURATION_MS,
    role: 'admin',
  };
  const encodedPayload = encode(JSON.stringify(payload));

  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export async function verifyAdminSession(
  token: string | undefined,
  now = new Date(),
): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) {
    return false;
  }

  const [encodedPayload, signature, ...rest] = token.split('.');
  if (!encodedPayload || !signature || rest.length > 0) {
    return false;
  }

  const expectedSignature = sign(encodedPayload, secret);
  const actualSignature = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (
    actualSignature.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(actualSignature, expectedSignatureBuffer)
  ) {
    return false;
  }

  const rawPayload = decode(encodedPayload);
  if (!rawPayload) {
    return false;
  }

  try {
    const payload = JSON.parse(rawPayload) as SessionPayload;
    return payload.role === 'admin' && Number.isFinite(payload.exp) && payload.exp > now.getTime();
  } catch {
    return false;
  }
}

export function getAdminSessionFromCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))
    ?.slice(`${ADMIN_SESSION_COOKIE}=`.length);
}

export const adminSessionMaxAgeSeconds = SESSION_DURATION_MS / 1000;

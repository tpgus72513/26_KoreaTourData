import { NextResponse } from 'next/server';

import {
  ADMIN_SESSION_COOKIE,
  adminSessionMaxAgeSeconds,
  createAdminSession,
  isValidAdminPassword,
} from '../../../lib/auth';

export const runtime = 'nodejs';

function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  const password =
    typeof body === 'object' && body !== null && 'password' in body
      ? (body as { password?: unknown }).password
      : undefined;

  if (!(await isValidAdminPassword(password))) {
    return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 });
  }

  try {
    const response = noContent();
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: await createAdminSession(),
      httpOnly: true,
      maxAge: adminSessionMaxAgeSeconds,
      path: '/',
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  } catch {
    return NextResponse.json({ error: '관리자 세션을 구성할 수 없습니다.' }, { status: 503 });
  }
}

export async function DELETE(): Promise<NextResponse> {
  const response = noContent();
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

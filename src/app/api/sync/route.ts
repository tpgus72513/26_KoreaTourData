import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { runSyncBatch } from '../../../lib/sync/run';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  return sync(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return sync(request);
}

async function sync(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 });
  }

  const serviceKey = process.env.TOUR_API_SERVICE_KEY?.trim();
  if (!serviceKey) {
    return NextResponse.json({ error: '동기화 서비스를 구성할 수 없습니다.' }, { status: 503 });
  }

  const result = await runSyncBatch({ serviceKey });
  const status = result.status === 'published' ? 200 : result.status === 'busy' ? 409 : 502;
  return NextResponse.json(result, { status });
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get('authorization');
  if (!secret || !authorization) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

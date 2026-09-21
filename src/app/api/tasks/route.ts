import { NextResponse } from 'next/server';

import { getAdminSessionFromCookie, verifyAdminSession } from '../../../lib/auth';
import { isDatabaseConfigured } from '../../../lib/db';
import {
  createPersistedTask,
  listPersistedTasks,
  parseTaskInput,
  updatePersistedTask,
} from '../../../lib/tasks';

export const runtime = 'nodejs';

const INVALID_REQUEST = { error: '요청 형식이 올바르지 않습니다.' };
const DATABASE_UNAVAILABLE = { error: '저장소가 구성되지 않았습니다.' };

async function isAuthorized(request: Request): Promise<boolean> {
  return verifyAdminSession(getAdminSessionFromCookie(request.headers.get('cookie')));
}

async function readJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function extractTaskUpdate(value: unknown): { id: string; task: unknown } | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string') {
    return null;
  }
  const { id, ...task } = record;
  return { id, task };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(DATABASE_UNAVAILABLE, { status: 503 });
  }

  try {
    return NextResponse.json({ tasks: await listPersistedTasks() });
  } catch {
    return NextResponse.json({ error: '현장검증 과제를 불러오지 못했습니다.' }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
  }

  const parsed = parseTaskInput(await readJson(request));
  if (!parsed.ok) {
    return NextResponse.json(INVALID_REQUEST, { status: 400 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json(DATABASE_UNAVAILABLE, { status: 503 });
  }

  try {
    return NextResponse.json({ task: await createPersistedTask(parsed.value) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '현장검증 과제를 저장하지 못했습니다.' }, { status: 503 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
  }

  const body = await readJson(request);
  const update = extractTaskUpdate(body);
  if (!update || !isUuid(update.id)) {
    return NextResponse.json(INVALID_REQUEST, { status: 400 });
  }
  const parsed = parseTaskInput(update.task);
  if (!parsed.ok) {
    return NextResponse.json(INVALID_REQUEST, { status: 400 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json(DATABASE_UNAVAILABLE, { status: 503 });
  }

  try {
    const task = await updatePersistedTask(update.id, parsed.value);
    if (!task) {
      return NextResponse.json({ error: '현장검증 과제를 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch {
    return NextResponse.json({ error: '현장검증 과제를 저장하지 못했습니다.' }, { status: 503 });
  }
}

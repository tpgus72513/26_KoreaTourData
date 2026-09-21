import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAdminSession } from '../../../lib/auth';
import {
  resetDatabaseForTests,
  setDatabaseForTests,
  type Database,
  type DatabaseRow,
} from '../../../lib/db';
import { GET, PATCH, POST } from './route';

const originalEnvironment = {
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
};

afterEach(() => {
  process.env.DATABASE_URL = originalEnvironment.DATABASE_URL;
  process.env.SESSION_SECRET = originalEnvironment.SESSION_SECRET;
  resetDatabaseForTests();
});

describe('PATCH /api/tasks', () => {
  it('persists an authorized workflow status transition with parameterized values', async () => {
    process.env.DATABASE_URL = 'postgres://example.invalid/test';
    process.env.SESSION_SECRET = 'a-long-local-test-secret';
    const queryCalls: Array<{ text: string; values?: readonly unknown[] }> = [];
    const row = {
      id: '3d3b3436-689a-4b5e-9a1a-3ad2b42ee77f',
      region_id: 'hahoemaeul',
      title: validTask.title,
      location: validTask.location,
      question: validTask.question,
      status: 'in-progress',
      assigned_to: null,
      scheduled_for: null,
      notes: null,
      result: null,
      related_action: null,
      checklist: [],
    };
    const database: Database = {
      query: async <T extends DatabaseRow = DatabaseRow>(text: string, values?: readonly unknown[]) => {
        queryCalls.push({ text, values });
        return {
          rowCount: 1,
          rows: [row] as unknown as T[],
        };
      },
    };
    setDatabaseForTests(database);
    const token = await createAdminSession();
    const response = await PATCH(
      taskRequest(
        { id: '3d3b3436-689a-4b5e-9a1a-3ad2b42ee77f', ...validTask, status: 'in-progress' },
        token,
        'PATCH',
      ),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).task).toMatchObject({ status: 'in-progress' });
    expect(queryCalls).toHaveLength(1);
    expect(queryCalls[0]?.text).toMatch(/UPDATE validation_tasks/i);
    expect(queryCalls[0]?.values).toContain('in-progress');
  });
});

describe('GET /api/tasks', () => {
  it('rejects an unauthenticated read before querying or serializing sensitive task fields', async () => {
    process.env.DATABASE_URL = 'postgres://example.invalid/test';
    process.env.SESSION_SECRET = 'a-long-local-test-secret';
    const query = vi.fn();
    setDatabaseForTests({ query });

    const response = await GET(taskRequest(undefined, undefined, 'GET'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: '관리자 인증이 필요합니다.' });
    expect(query).not.toHaveBeenCalled();
  });

  it('returns persisted tasks only to a verified administrator session', async () => {
    process.env.DATABASE_URL = 'postgres://example.invalid/test';
    process.env.SESSION_SECRET = 'a-long-local-test-secret';
    const database: Database = {
      query: async <T extends DatabaseRow = DatabaseRow>() => ({
        rowCount: 1,
        rows: [{
          id: '3d3b3436-689a-4b5e-9a1a-3ad2b42ee77f',
          region_id: 'hahoemaeul',
          title: validTask.title,
          location: validTask.location,
          question: validTask.question,
          status: validTask.status,
          assigned_to: '내부 담당자',
          scheduled_for: null,
          notes: '비공개 현장 메모',
          result: '비공개 검증 결과',
          related_action: null,
          checklist: [],
        }] as unknown as T[],
      }),
    };
    setDatabaseForTests(database);
    const token = await createAdminSession();

    const response = await GET(taskRequest(undefined, token, 'GET'));

    expect(response.status).toBe(200);
    expect((await response.json()).tasks[0]).toMatchObject({ notes: '비공개 현장 메모' });
  });
});

function taskRequest(body: unknown, token?: string, method = 'POST'): Request {
  return new Request('http://localhost/api/tasks', {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      'content-type': 'application/json',
      ...(token ? { cookie: `admin_session=${token}` } : {}),
    },
  });
}

const validTask = {
  regionId: 'hahoemaeul',
  title: '하회마을 주변 음식·숙박 연결 확인',
  location: '하회마을 입구',
  question: '주말 대중교통 연결이 실제로 운영되나요?',
  status: 'not-started',
};

describe('POST /api/tasks', () => {
  it('returns 401 for an unauthenticated mutation without writing', async () => {
    const response = await POST(taskRequest(validTask));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: '관리자 인증이 필요합니다.' });
  });

  it('returns 400 for malformed data from an authenticated administrator', async () => {
    process.env.SESSION_SECRET = 'a-long-local-test-secret';
    const token = await createAdminSession();

    const response = await POST(taskRequest({ ...validTask, status: 'done' }, token));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '요청 형식이 올바르지 않습니다.' });
  });

  it('returns 503 instead of pretending to save when no database is configured', async () => {
    process.env.DATABASE_URL = '';
    process.env.SESSION_SECRET = 'a-long-local-test-secret';
    const token = await createAdminSession();

    const response = await POST(taskRequest(validTask, token));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: '저장소가 구성되지 않았습니다.' });
  });
});

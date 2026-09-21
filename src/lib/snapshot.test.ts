import { afterEach, describe, expect, it } from 'vitest';

import { demoSnapshot } from './demo';
import {
  resetDatabaseForTests,
  setDatabaseForTests,
  type Database,
  type DatabaseRow,
} from './db';
import { loadSnapshot } from './snapshot';

const originalDatabaseUrl = process.env.DATABASE_URL;

function databaseWithRows(rows: DatabaseRow[]): Database {
  return {
    query: async <T extends DatabaseRow>() => ({ rows: rows as T[], rowCount: rows.length }),
  };
}

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
  resetDatabaseForTests();
});

describe('loadSnapshot', () => {
  it('returns the explicitly labelled demonstration snapshot only when no database is configured', async () => {
    delete process.env.DATABASE_URL;

    await expect(loadSnapshot()).resolves.toEqual(demoSnapshot);
  });

  it('keeps the last live snapshot and marks it stale when a live sync has failed', async () => {
    process.env.DATABASE_URL = 'postgresql://configured.example/with-local';
    setDatabaseForTests(
      databaseWithRows([
          {
            payload: {
              ...demoSnapshot,
              mode: 'live',
              disclaimer: '실시간 발행 스냅샷입니다.',
              regions: demoSnapshot.regions.map((region) => ({
                ...region,
                potentialScore: null,
                confidenceScore: null,
                evidenceStatus: 'unknown',
                recommendation: 'pending',
              })),
            },
            published_at: '2026-09-20T00:00:00.000Z',
            sync_state: 'stale',
            last_attempt_at: '2026-09-21T00:00:00.000Z',
            affected_data: ['visitor_records'],
          },
        ]),
    );

    const snapshot = await loadSnapshot();

    expect(snapshot.mode).toBe('live');
    expect(snapshot.status).toMatchObject({
      type: 'stale',
      lastAttemptAt: '2026-09-21T00:00:00.000Z',
      affectedData: ['visitor_records'],
    });
    expect(snapshot.disclaimer).not.toContain('예시 데이터');
  });

  it('returns a live-empty status instead of demonstration values when the configured database has no publication', async () => {
    process.env.DATABASE_URL = 'postgresql://configured.example/with-local';
    setDatabaseForTests(databaseWithRows([]));

    const snapshot = await loadSnapshot();

    expect(snapshot.mode).toBe('live');
    expect(snapshot.status.type).toBe('empty');
    expect(snapshot.regions.every((region) => region.potentialScore === null)).toBe(true);
    expect(snapshot.places).toEqual([]);
    expect(snapshot.disclaimer).not.toContain('예시 데이터');
  });

  it('fails closed to live-empty when a stored payload is malformed', async () => {
    process.env.DATABASE_URL = 'postgresql://configured.example/with-local';
    setDatabaseForTests(
      databaseWithRows([
          {
            payload: { mode: 'live' },
            published_at: '2026-09-21T00:00:00.000Z',
            sync_state: 'ready',
            last_attempt_at: null,
            affected_data: [],
          },
        ]),
    );

    const snapshot = await loadSnapshot();

    expect(snapshot.mode).toBe('live');
    expect(snapshot.status.type).toBe('empty');
    expect(snapshot.regions).toHaveLength(3);
    expect(snapshot.disclaimer).not.toContain('예시 데이터');
  });
});

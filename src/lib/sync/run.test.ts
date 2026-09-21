import { afterEach, describe, expect, it } from 'vitest';

import type { TourismPlace } from '../domain';
import { demoSnapshot } from '../demo';
import type { VisitorRecord } from '../tourism/datalab';
import {
  runSyncBatchWithDependencies,
  createPostgresSyncRepository,
  type SyncDependencies,
  type SyncPublication,
} from './run';

const visitors: VisitorRecord[] = [
  {
    baseYmd: '20260921',
    signguCode: '47170',
    signguNm: '안동시',
    visitorType: '2',
    count: 0,
  },
];

const originalDataLagDays = process.env.TOUR_DATA_LAG_DAYS;

afterEach(() => {
  if (originalDataLagDays === undefined) {
    delete process.env.TOUR_DATA_LAG_DAYS;
  } else {
    process.env.TOUR_DATA_LAG_DAYS = originalDataLagDays;
  }
});

const places: TourismPlace[] = [
  {
    id: 'place-1',
    name: '월영교',
    category: 'attraction',
    latitude: 36.5682,
    longitude: 128.7742,
    regionId: null,
    evidenceStatus: 'verified',
    source: 'KTO KorService2/areaBasedList2',
    address: '경상북도 안동시',
  },
];

function dependencies(overrides: Partial<SyncDependencies> = {}): SyncDependencies {
  return {
    acquireLease: async () => true,
    releaseLease: async () => undefined,
    markLatestSnapshotStale: async () => undefined,
    recordFailure: async () => undefined,
    publish: async () => undefined,
    fetchVisitors: async () => visitors,
    fetchPlaces: async () => places,
    createLeaseToken: () => 'lease-token',
    ...overrides,
  };
}

describe('runSyncBatch', () => {
  it('returns busy without fetching when another non-expired lease owns the batch', async () => {
    let visitorsFetched = false;
    const result = await runSyncBatchWithDependencies(
      { serviceKey: 'test-key', now: new Date('2026-09-21T08:00:00.000Z') },
      dependencies({
        acquireLease: async () => false,
        fetchVisitors: async () => {
          visitorsFetched = true;
          return visitors;
        },
      }),
    );

    expect(result).toEqual({ status: 'busy', date: '20260822' });
    expect(visitorsFetched).toBe(false);
  });

  it('upserts a repeated scheduled date as one publication instead of duplicating it', async () => {
    const publications = new Map<string, SyncPublication>();
    const publish = async (publication: SyncPublication) => {
      publications.set(publication.date, publication);
    };
    const options = { serviceKey: 'test-key', now: new Date('2026-09-21T08:00:00.000Z') };

    await runSyncBatchWithDependencies(options, dependencies({ publish }));
    await runSyncBatchWithDependencies(options, dependencies({ publish }));

    expect(publications).toHaveLength(1);
    expect(publications.get('20260822')?.snapshot.mode).toBe('live');
    expect(publications.get('20260822')?.snapshot.visitorContext.visitorCount).toBe(0);
  });

  it('marks the last live snapshot stale and releases its lease when either source fails', async () => {
    const events: string[] = [];

    const result = await runSyncBatchWithDependencies(
      { serviceKey: 'test-key', now: new Date('2026-09-21T08:00:00.000Z') },
      dependencies({
        fetchPlaces: async () => {
          throw new Error('provider unavailable');
        },
        publish: async () => {
          events.push('publish');
        },
        markLatestSnapshotStale: async () => {
          events.push('stale');
        },
        releaseLease: async () => {
          events.push('release');
        },
      }),
    );

    expect(result).toEqual({ status: 'failed', date: '20260822' });
    expect(events).toEqual(['stale', 'release']);
  });

  it('uses only the explicitly labelled outside-visitor category for the municipal context total', async () => {
    let publication: SyncPublication | undefined;

    await runSyncBatchWithDependencies(
      { serviceKey: 'test-key', now: new Date('2026-09-21T08:00:00.000Z') },
      dependencies({
        fetchVisitors: async () => [
          { ...visitors[0], visitorType: '1', count: 100 },
          { ...visitors[0], visitorType: '2', count: 12.5 },
          { ...visitors[0], visitorType: '3', count: 7 },
        ],
        publish: async (value) => {
          publication = value;
        },
      }),
    );

    expect(publication?.snapshot.visitorContext).toMatchObject({
      visitorCount: 12.5,
      source: 'KTO DataLabService/locgoRegnVisitrDDList (외지인, touDivCd=2)',
    });
  });

  it('uses a bounded configured data lag for the one-day batch window', async () => {
    process.env.TOUR_DATA_LAG_DAYS = '14';
    let requestedDate: string | undefined;

    const result = await runSyncBatchWithDependencies(
      { serviceKey: 'test-key', now: new Date('2026-09-21T08:00:00.000Z') },
      dependencies({
        fetchVisitors: async ({ startYmd, endYmd }) => {
          requestedDate = `${startYmd}:${endYmd}`;
          return visitors;
        },
      }),
    );

    expect(result).toEqual({ status: 'published', date: '20260907' });
    expect(requestedDate).toBe('20260907:20260907');
  });

  it('does not publish a ready snapshot when the provider returns no Andong visitor records', async () => {
    const events: string[] = [];

    const result = await runSyncBatchWithDependencies(
      { serviceKey: 'test-key', now: new Date('2026-09-21T08:00:00.000Z') },
      dependencies({
        fetchVisitors: async () => [],
        publish: async () => {
          events.push('publish');
        },
        markLatestSnapshotStale: async () => {
          events.push('stale');
        },
        releaseLease: async () => {
          events.push('release');
        },
      }),
    );

    expect(result).toEqual({ status: 'failed', date: '20260822' });
    expect(events).toEqual(['stale', 'release']);
  });

  it('durably records a failed attempt with known counts before marking the snapshot stale', async () => {
    const events: string[] = [];
    let failedRun: unknown;

    const result = await runSyncBatchWithDependencies(
      { serviceKey: 'test-key', now: new Date('2026-09-21T08:00:00.000Z') },
      dependencies({
        publish: async () => {
          events.push('publish');
          throw new Error('database write interrupted');
        },
        markLatestSnapshotStale: async () => {
          events.push('stale');
        },
        releaseLease: async () => {
          events.push('release');
        },
        recordFailure: async (value: unknown) => {
          events.push('failed-run');
          failedRun = value;
        },
      } as unknown as Partial<SyncDependencies>),
    );

    expect(result).toEqual({ status: 'failed', date: '20260822' });
    expect(failedRun).toMatchObject({
      date: '20260822',
      dateIso: '2026-08-22',
      startedAt: '2026-09-21T08:00:00.000Z',
      visitorRecordCount: 1,
      placeCount: 1,
    });
    expect(events).toEqual(['publish', 'failed-run', 'stale', 'release']);
  });

  it('still marks stale and releases the lease when failure audit storage is unavailable', async () => {
    const events: string[] = [];

    const result = await runSyncBatchWithDependencies(
      { serviceKey: 'test-key', now: new Date('2026-09-21T08:00:00.000Z') },
      dependencies({
        publish: async () => {
          events.push('publish');
          throw new Error('database write interrupted');
        },
        recordFailure: async () => {
          events.push('failed-run');
          throw new Error('audit database unavailable');
        },
        markLatestSnapshotStale: async () => {
          events.push('stale');
        },
        releaseLease: async () => {
          events.push('release');
        },
      }),
    );

    expect(result).toEqual({ status: 'failed', date: '20260822' });
    expect(events).toEqual(['publish', 'failed-run', 'stale', 'release']);
  });

  it('materializes regional POI membership with PostGIS ST_DWithin before publishing', async () => {
    const queries: string[] = [];
    const repository = createPostgresSyncRepository({
      query: async (text) => {
        queries.push(text);
        return { rows: [], rowCount: 1 };
      },
    });

    await repository.publish({
      date: '20260919',
      dateIso: '2026-09-19',
      attemptedAt: '2026-09-21T08:00:00.000Z',
      snapshot: { ...demoSnapshot, mode: 'live', disclaimer: '라이브 데이터' },
      visitorRecords: visitors,
      places,
    });

    expect(queries.some((query) => query.includes('extensions.ST_DWithin'))).toBe(true);
  });
});

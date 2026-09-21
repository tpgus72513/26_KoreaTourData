import { randomUUID } from 'node:crypto';

import { getDatabase, type Database } from '../db';
import { REGIONS, type PublishedSnapshot, type TourismPlace } from '../domain';
import { fetchAndongPlaces } from '../tourism/content';
import { fetchAndongVisitors, type VisitorRecord } from '../tourism/datalab';
import { withTourismDeadline } from '../tourism/request';

const LEASE_NAME = 'andong-tourism-sync';
const LEASE_DURATION_MS = 10 * 60 * 1000;
const DEFAULT_DATA_LAG_DAYS = 30;
const MINIMUM_DATA_LAG_DAYS = 1;
const MAXIMUM_DATA_LAG_DAYS = 90;
const INGESTION_TIMEOUT_MS = 35_000;

export type SyncPublication = {
  date: string;
  dateIso: string;
  attemptedAt: string;
  snapshot: PublishedSnapshot;
  visitorRecords: VisitorRecord[];
  places: TourismPlace[];
};

export type SyncFailure = {
  date: string;
  dateIso: string;
  startedAt: string;
  completedAt: string;
  visitorRecordCount: number | null;
  placeCount: number | null;
};

export type SyncDependencies = {
  acquireLease: (input: { token: string; now: Date }) => Promise<boolean>;
  releaseLease: (input: { token: string }) => Promise<void>;
  markLatestSnapshotStale: (input: { attemptedAt: Date }) => Promise<void>;
  recordFailure: (failure: SyncFailure) => Promise<void>;
  publish: (publication: SyncPublication) => Promise<void>;
  fetchVisitors: (input: {
    serviceKey: string;
    startYmd: string;
    endYmd: string;
    signal?: AbortSignal;
  }) => Promise<VisitorRecord[]>;
  fetchPlaces: (input: { serviceKey: string; signal?: AbortSignal }) => Promise<TourismPlace[]>;
  createLeaseToken: () => string;
};

export async function runSyncBatch(options: {
  serviceKey: string;
  now?: Date;
}): Promise<{ status: 'published' | 'busy' | 'failed'; date: string }> {
  return runSyncBatchWithDependencies(options, createProductionDependencies());
}

export async function runSyncBatchWithDependencies(
  options: { serviceKey: string; now?: Date },
  dependencies: SyncDependencies,
): Promise<{ status: 'published' | 'busy' | 'failed'; date: string }> {
  const now = options.now ?? new Date();
  const date = formatYmd(laggedScheduledDate(now));
  const token = dependencies.createLeaseToken();
  let leaseAcquired = false;
  let visitorRecords: VisitorRecord[] | undefined;
  let fetchedPlaces: TourismPlace[] | undefined;

  try {
    leaseAcquired = await dependencies.acquireLease({ token, now });
    if (!leaseAcquired) {
      return { status: 'busy', date };
    }

    const fetched = await withTourismDeadline((signal) => Promise.all([
      dependencies.fetchVisitors({
        serviceKey: options.serviceKey,
        startYmd: date,
        endYmd: date,
        signal,
      }).then((records) => {
        visitorRecords = records;
        return records;
      }),
      dependencies.fetchPlaces({ serviceKey: options.serviceKey, signal }).then((places) => {
        fetchedPlaces = places;
        return places;
      }),
    ]), INGESTION_TIMEOUT_MS);
    [visitorRecords, fetchedPlaces] = fetched;
    validateBatchSources(date, visitorRecords, fetchedPlaces);
    const publication = createPublication({ date, now, visitorRecords, places: fetchedPlaces });
    await dependencies.publish(publication);
    return { status: 'published', date };
  } catch {
    if (leaseAcquired) {
      try {
        await dependencies.recordFailure({
          date,
          dateIso: toIsoDate(date),
          startedAt: now.toISOString(),
          completedAt: new Date().toISOString(),
          visitorRecordCount: visitorRecords?.length ?? null,
          placeCount: fetchedPlaces?.length ?? null,
        });
      } catch {
        // Audit writes must not mask the ingestion failure or bypass the lease release.
      }
      try {
        await dependencies.markLatestSnapshotStale({ attemptedAt: now });
      } catch {
        // A database outage cannot be reported to the caller with additional sensitive detail.
      }
    }
    return { status: 'failed', date };
  } finally {
    if (leaseAcquired) {
      try {
        await dependencies.releaseLease({ token });
      } catch {
        // TTL remains the final overlap guard if a connection is interrupted during release.
      }
    }
  }
}

function createProductionDependencies(): SyncDependencies {
  const repository = createPostgresSyncRepository(getDatabase());
  return {
    acquireLease: repository.acquireLease,
    releaseLease: repository.releaseLease,
    markLatestSnapshotStale: repository.markLatestSnapshotStale,
    recordFailure: repository.recordFailure,
    publish: repository.publish,
    fetchVisitors: fetchAndongVisitors,
    fetchPlaces: fetchAndongPlaces,
    createLeaseToken: randomUUID,
  };
}

export function createPostgresSyncRepository(database: Database) {
  return {
    acquireLease: async ({ token, now }: { token: string; now: Date }): Promise<boolean> => {
      const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS);
      const result = await database.query(
        `INSERT INTO sync_leases (lease_name, lease_token, expires_at)
         VALUES ($1, $2::uuid, $3)
         ON CONFLICT (lease_name) DO UPDATE
         SET lease_token = EXCLUDED.lease_token, expires_at = EXCLUDED.expires_at
         WHERE sync_leases.expires_at <= $4
         RETURNING lease_name`,
        [LEASE_NAME, token, expiresAt, now],
      );
      return result.rowCount === 1;
    },
    releaseLease: async ({ token }: { token: string }): Promise<void> => {
      await database.query(
        'DELETE FROM sync_leases WHERE lease_name = $1 AND lease_token = $2::uuid',
        [LEASE_NAME, token],
      );
    },
    markLatestSnapshotStale: async ({ attemptedAt }: { attemptedAt: Date }): Promise<void> => {
      await database.query(
        `UPDATE published_snapshots
         SET sync_state = 'stale', last_attempt_at = $1, affected_data = $2::text[]
         WHERE source_date = (SELECT source_date FROM published_snapshots ORDER BY published_at DESC LIMIT 1)`,
        [attemptedAt, ['visitor_records', 'tourism_places']],
      );
    },
    recordFailure: async (failure: SyncFailure): Promise<void> => {
      await database.query(
        `INSERT INTO sync_runs
         (source_date, started_at, completed_at, status, visitor_record_count, place_count)
         VALUES ($1::date, $2, $3, 'failed', $4, $5)`,
        [
          failure.dateIso,
          failure.startedAt,
          failure.completedAt,
          failure.visitorRecordCount,
          failure.placeCount,
        ],
      );
    },
    publish: async (publication: SyncPublication): Promise<void> => {
      await inTransaction(database, async (connection) => {
        for (const record of publication.visitorRecords) {
          await connection.query(
            `INSERT INTO visitor_records
             (base_ymd, signgu_code, signgu_name, visitor_type, visitor_count)
             VALUES ($1::date, $2, $3, $4, $5)
             ON CONFLICT (base_ymd, signgu_code, visitor_type) DO UPDATE
             SET signgu_name = EXCLUDED.signgu_name,
                 visitor_count = EXCLUDED.visitor_count,
                 synchronized_at = now()`,
            [toIsoDate(record.baseYmd), record.signguCode, record.signguNm, record.visitorType, record.count],
          );
        }

        for (const place of publication.places) {
          await connection.query(
            `INSERT INTO tourism_places
             (content_id, collected_on, name, category, source, address, latitude, longitude, location, region_id, evidence_status)
             VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8,
                     extensions.ST_SetSRID(extensions.ST_MakePoint($8, $7), 4326)::extensions.geography, $9, $10)
             ON CONFLICT (content_id, collected_on) DO UPDATE
             SET name = EXCLUDED.name, category = EXCLUDED.category, source = EXCLUDED.source,
                 address = EXCLUDED.address, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
                 location = EXCLUDED.location, region_id = EXCLUDED.region_id,
                 evidence_status = EXCLUDED.evidence_status, synchronized_at = now()`,
            [
              place.id,
              publication.dateIso,
              place.name,
              place.category,
              place.source,
              place.address,
              place.latitude,
              place.longitude,
              place.regionId,
              place.evidenceStatus,
            ],
          );
        }

        await connection.query(
          `UPDATE tourism_places AS place
           SET region_id = (
             SELECT region.id
             FROM tourism_regions AS region
             WHERE extensions.ST_DWithin(region.center, place.location, region.radius_meters)
             ORDER BY extensions.ST_Distance(region.center, place.location)
             LIMIT 1
           )
           WHERE place.collected_on = $1::date`,
          [publication.dateIso],
        );

        await connection.query(
          `INSERT INTO published_snapshots
           (source_date, payload, sync_state, published_at, last_attempt_at, affected_data)
           VALUES ($1::date, $2::jsonb, 'ready', $3, $3, ARRAY[]::text[])
           ON CONFLICT (source_date) DO UPDATE
           SET payload = EXCLUDED.payload, sync_state = 'ready', published_at = EXCLUDED.published_at,
               last_attempt_at = EXCLUDED.last_attempt_at, affected_data = ARRAY[]::text[]`,
          [publication.dateIso, JSON.stringify(publication.snapshot), publication.attemptedAt],
        );

        await connection.query(
          `INSERT INTO sync_runs
           (source_date, started_at, completed_at, status, visitor_record_count, place_count)
           VALUES ($1::date, $2, $3, 'published', $4, $5)`,
          [
            publication.dateIso,
            publication.attemptedAt,
            publication.attemptedAt,
            publication.visitorRecords.length,
            publication.places.length,
          ],
        );
      });
    },
  };
}

function createPublication({
  date,
  now,
  visitorRecords,
  places,
}: {
  date: string;
  now: Date;
  visitorRecords: VisitorRecord[];
  places: TourismPlace[];
}): SyncPublication {
  const dateIso = toIsoDate(date);
  const normalizedPlaces = places.map((place) => ({ ...place, regionId: regionForPlace(place) }));
  const outsideVisitorRecords = visitorRecords.filter((record) => record.visitorType === '2');
  const hasOutsideVisitorData = outsideVisitorRecords.length > 0;

  return {
    date,
    dateIso,
    attemptedAt: now.toISOString(),
    visitorRecords,
    places: normalizedPlaces,
    snapshot: {
      mode: 'live',
      publishedAt: now.toISOString(),
      disclaimer: '라이브 데이터는 마지막 정상 발행본만 표시합니다.',
      visitorContext: {
        scope: '안동시',
        source: 'KTO DataLabService/locgoRegnVisitrDDList (외지인, touDivCd=2)',
        period: { start: dateIso, end: dateIso },
        visitorCount: hasOutsideVisitorData
          ? outsideVisitorRecords.reduce((total, record) => total + record.count, 0)
          : null,
        evidenceStatus: hasOutsideVisitorData ? 'verified' : 'unknown',
        note: '외지인(touDivCd=2) 시·군 단위 방문자 맥락 지표이며 관광권역별 관측값으로 사용하지 않습니다.',
      },
      regions: REGIONS.map((region) => ({
        id: region.id,
        potentialScore: null,
        confidenceScore: null,
        evidenceStatus: 'unknown',
        recommendation: 'pending',
        summary: '산출 대기',
        reasons: [],
        bottleneck: '권역별 독립 관측값이 필요합니다.',
        missingDataCount: null,
      })),
      places: normalizedPlaces,
      limitations: [
        '시·군 단위 방문자 수는 관광권역별 실측값으로 배분하지 않습니다.',
        '권역별 잠재력과 데이터 신뢰도는 독립 입력 전까지 산출 대기입니다.',
      ],
      status: {
        type: 'ready',
        message: '마지막 정상 라이브 스냅샷입니다.',
        lastAttemptAt: now.toISOString(),
        affectedData: [],
      },
    },
  };
}

function validateBatchSources(date: string, visitorRecords: VisitorRecord[], places: TourismPlace[]): void {
  const identities = new Set<string>();
  for (const record of visitorRecords) {
    if (record.baseYmd !== date || record.signguNm !== '안동시' || !record.signguCode.trim() ||
        !record.visitorType.trim() || !Number.isFinite(record.count) || record.count < 0) {
      throw new Error('Invalid Andong visitor records for the scheduled date');
    }
    const identity = `${record.baseYmd}:${record.signguCode}:${record.visitorType}`;
    if (identities.has(identity)) throw new Error('Duplicate Andong visitor records');
    identities.add(identity);
  }
  const outsideVisitors = visitorRecords.filter((record) => record.visitorType === '2');
  if (outsideVisitors.length !== 1) {
    throw new Error('A unique outside-visitor record is required for the scheduled date');
  }
  if (places.length === 0) throw new Error('No usable Andong tourism places are available');
  const placeIds = new Set<string>();
  for (const place of places) {
    if (!place.id.trim() || !place.name.trim() || !Number.isFinite(place.latitude) ||
        !Number.isFinite(place.longitude) || Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) {
      throw new Error('Invalid Andong tourism places');
    }
    if (placeIds.has(place.id)) throw new Error('Duplicate Andong tourism places');
    placeIds.add(place.id);
  }
}

async function inTransaction(
  database: Database,
  action: (connection: Database) => Promise<void>,
): Promise<void> {
  if (!database.connect) {
    await action(database);
    return;
  }

  const connection = await database.connect();
  try {
    await connection.query('BEGIN');
    await action(connection);
    await connection.query('COMMIT');
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}

function regionForPlace(place: TourismPlace): TourismPlace['regionId'] {
  const matchingRegion = REGIONS.find((region) => {
    const distanceMeters = haversineMeters(
      region.center.latitude,
      region.center.longitude,
      place.latitude,
      place.longitude,
    );
    return distanceMeters <= region.radiusMeters;
  });
  return matchingRegion?.id ?? null;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function laggedScheduledDate(now: Date): Date {
  const scheduled = new Date(now);
  scheduled.setUTCDate(scheduled.getUTCDate() - configuredDataLagDays());
  return scheduled;
}

function configuredDataLagDays(): number {
  const rawValue = process.env.TOUR_DATA_LAG_DAYS;
  if (!rawValue || !/^\d+$/.test(rawValue)) {
    return DEFAULT_DATA_LAG_DAYS;
  }

  const value = Number(rawValue);
  return value >= MINIMUM_DATA_LAG_DAYS && value <= MAXIMUM_DATA_LAG_DAYS
    ? value
    : DEFAULT_DATA_LAG_DAYS;
}

function toIsoDate(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

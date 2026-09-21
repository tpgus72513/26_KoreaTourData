import { REGIONS, type PublishedSnapshot, type RegionOverview } from './domain';
import { demoSnapshot } from './demo';
import { getDatabase, isDatabaseConfigured, type DatabaseRow } from './db';

type StoredSnapshotRow = DatabaseRow & {
  payload: unknown;
  published_at: unknown;
  sync_state: unknown;
  last_attempt_at: unknown;
  affected_data: unknown;
};

export async function loadSnapshot(): Promise<PublishedSnapshot> {
  if (!isDatabaseConfigured()) {
    return demoSnapshot;
  }

  try {
    const result = await getDatabase().query<StoredSnapshotRow>(
      `SELECT payload, published_at, sync_state, last_attempt_at, affected_data
       FROM published_snapshots
       ORDER BY published_at DESC
       LIMIT 1`,
    );
    const row = result.rows[0];
    if (!row) {
      return liveEmptySnapshot('발행된 라이브 스냅샷이 없습니다.');
    }

    const snapshot = toLiveSnapshot(row.payload);
    if (!snapshot) {
      return liveEmptySnapshot('발행 스냅샷 형식을 확인할 수 없습니다.');
    }

    const stale = row.sync_state === 'stale';
    return {
      ...snapshot,
      mode: 'live',
      publishedAt: asIsoString(row.published_at) ?? snapshot.publishedAt,
      status: {
        type: stale ? 'stale' : 'ready',
        message: stale
          ? '최근 동기화에 실패하여 마지막 정상 라이브 스냅샷을 표시합니다.'
          : '마지막 정상 라이브 스냅샷입니다.',
        lastAttemptAt: asIsoString(row.last_attempt_at),
        affectedData: asStringArray(row.affected_data),
      },
    };
  } catch {
    return liveEmptySnapshot('라이브 스냅샷을 불러오지 못했습니다.', 'error');
  }
}

function liveEmptySnapshot(message: string, status: 'empty' | 'error' = 'empty'): PublishedSnapshot {
  return {
    mode: 'live',
    publishedAt: new Date(0).toISOString(),
    disclaimer: '라이브 데이터는 마지막 정상 발행본만 표시하며 시연값으로 대체하지 않습니다.',
    visitorContext: {
      scope: '안동시',
      source: '한국관광공사 관광데이터 API',
      period: { start: '', end: '' },
      visitorCount: null,
      evidenceStatus: 'unknown',
      note: '발행된 시·군 단위 방문자 맥락 지표가 없습니다.',
    },
    regions: REGIONS.map<RegionOverview>((region) => ({
      id: region.id,
      potentialScore: null,
      confidenceScore: null,
      evidenceStatus: 'unknown',
      recommendation: 'pending',
      summary: '산출 대기',
      reasons: [],
      bottleneck: '독립적인 권역 단위 입력이 필요합니다.',
      missingDataCount: 0,
    })),
    places: [],
    limitations: [
      '발행된 라이브 스냅샷이 없거나 읽을 수 없습니다.',
      '시연값으로 자동 전환하지 않습니다.',
    ],
    status: {
      type: status,
      message,
      lastAttemptAt: null,
      affectedData: [],
    },
  };
}

function toLiveSnapshot(value: unknown): PublishedSnapshot | undefined {
  const payload = typeof value === 'string' ? tryParseJson(value) : value;
  if (!isPublishedLiveSnapshot(payload)) {
    return undefined;
  }

  return payload as unknown as PublishedSnapshot;
}

function isPublishedLiveSnapshot(value: unknown): value is PublishedSnapshot {
  if (!isRecord(value) || value.mode !== 'live') {
    return false;
  }
  return (
    typeof value.publishedAt === 'string' &&
    typeof value.disclaimer === 'string' &&
    isRecord(value.visitorContext) &&
    Array.isArray(value.regions) &&
    Array.isArray(value.places) &&
    Array.isArray(value.limitations) &&
    isRecord(value.status)
  );
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function asIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === 'string' ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

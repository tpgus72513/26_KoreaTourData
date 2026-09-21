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
      missingDataCount: null,
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

export function toLiveSnapshot(value: unknown): PublishedSnapshot | undefined {
  const payload = typeof value === 'string' ? tryParseJson(value) : value;
  if (!isPublishedLiveSnapshot(payload)) {
    return undefined;
  }

  return {
    ...payload,
    regions: payload.regions.map((region) => (
      region.recommendation === 'pending' && region.evidenceStatus === 'unknown' &&
      region.potentialScore === null && region.confidenceScore === null && region.missingDataCount === 0
        ? { ...region, missingDataCount: null }
        : region
    )),
  };
}

function isPublishedLiveSnapshot(value: unknown): value is PublishedSnapshot {
  if (!isRecord(value) || value.mode !== 'live') {
    return false;
  }
  return (
    isTimestamp(value.publishedAt) &&
    typeof value.disclaimer === 'string' &&
    isVisitorContext(value.visitorContext) &&
    Array.isArray(value.regions) && value.regions.length === REGIONS.length &&
    value.regions.every(isRegionOverview) &&
    new Set(value.regions.map((region) => region.id)).size === REGIONS.length &&
    Array.isArray(value.places) && value.places.every(isTourismPlace) &&
    new Set(value.places.map((place) => place.id)).size === value.places.length &&
    isStringArray(value.limitations) &&
    isSnapshotStatus(value.status)
  );
}

function isVisitorContext(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.period)) return false;
  return value.scope === '안동시' && typeof value.source === 'string' &&
    isIsoDate(value.period.start) && isIsoDate(value.period.end) && value.period.start <= value.period.end &&
    nullableNumber(value.visitorCount, 0) && isEvidenceStatus(value.evidenceStatus) && typeof value.note === 'string';
}

function isRegionOverview(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return isRegionId(value.id) && nullableNumber(value.potentialScore, 0, 100) &&
    nullableNumber(value.confidenceScore, 0, 100) && isEvidenceStatus(value.evidenceStatus) &&
    isOneOf(value.recommendation, ['business-planning', 'field-validation', 'long-term-observation', 'pending']) &&
    typeof value.summary === 'string' && isStringArray(value.reasons) && typeof value.bottleneck === 'string' &&
    (value.missingDataCount === null || (typeof value.missingDataCount === 'number' &&
      Number.isSafeInteger(value.missingDataCount) && value.missingDataCount >= 0));
}

function isTourismPlace(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id) && isNonEmptyString(value.name) &&
    isOneOf(value.category, ['attraction', 'accommodation', 'food', 'event', 'accessibility']) &&
    finiteNumber(value.latitude, -90, 90) && finiteNumber(value.longitude, -180, 180) &&
    (value.regionId === null || isRegionId(value.regionId)) && isEvidenceStatus(value.evidenceStatus) &&
    typeof value.source === 'string' && (value.address === null || typeof value.address === 'string');
}

function isSnapshotStatus(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isOneOf(value.type, ['ready', 'stale', 'empty', 'error']) && typeof value.message === 'string' &&
    (value.lastAttemptAt === null || isTimestamp(value.lastAttemptAt)) && isStringArray(value.affectedData);
}

function isEvidenceStatus(value: unknown): boolean {
  return isOneOf(value, ['verified', 'inferred', 'field-required', 'unknown', 'example']);
}

function isRegionId(value: unknown): boolean {
  return REGIONS.some((region) => region.id === value);
}

function isOneOf(value: unknown, values: readonly string[]): boolean {
  return typeof value === 'string' && values.includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function finiteNumber(value: unknown, min: number, max = Number.MAX_VALUE): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function nullableNumber(value: unknown, min: number, max = Number.MAX_VALUE): boolean {
  return value === null || finiteNumber(value, min, max);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && isIsoDate(value.slice(0, 10)) &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function asIsoString(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }
  return isTimestamp(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

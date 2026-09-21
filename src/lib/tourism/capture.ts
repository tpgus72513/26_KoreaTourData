import type { PublishedSnapshot, TourismPlace } from '../domain';
import { toLiveSnapshot } from '../snapshot';
import { createPublication, validateBatchSources } from '../sync/run';
import { fetchAndongPlaces } from './content';
import { fetchAndongVisitors, type VisitorRecord } from './datalab';
import { withTourismDeadline } from './request';

export interface PublicTourismCapture {
  schemaVersion: 1;
  collectedAt: string;
  sourceDate: string;
  apiEndpoints: string[];
  visitorRecordCount: number;
  snapshot: PublishedSnapshot;
}

type Dependencies = {
  fetchPlaces: (options: { serviceKey: string; signal?: AbortSignal }) => Promise<TourismPlace[]>;
  fetchVisitors: (options: { serviceKey: string; startYmd: string; endYmd: string; signal?: AbortSignal }) => Promise<VisitorRecord[]>;
};

/** Only provider-derived public fields are published; credentials and request URLs are never retained. */
export async function capturePublicTourismData(
  options: { serviceKey: string; date: string; now?: Date },
  dependencies: Dependencies = { fetchPlaces: fetchAndongPlaces, fetchVisitors: fetchAndongVisitors },
): Promise<PublicTourismCapture> {
  const { date, serviceKey } = options;
  const dateIso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const parsedDate = new Date(`${dateIso}T00:00:00Z`);
  if (!/^\d{8}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateIso) {
    throw new Error('A valid YYYYMMDD source date is required');
  }
  if (!serviceKey.trim()) throw new Error('Tourism API service key is required');
  const now = options.now ?? new Date();
  const [places, visitorRecords] = await withTourismDeadline((signal) => Promise.all([
    dependencies.fetchPlaces({ serviceKey, signal }),
    dependencies.fetchVisitors({ serviceKey, startYmd: date, endYmd: date, signal }),
  ]), 35_000);
  validateBatchSources(date, visitorRecords, places);
  const publication = createPublication({ date, now, visitorRecords, places });
  const snapshot: PublishedSnapshot = {
    ...publication.snapshot,
    disclaimer: '한국관광공사 OpenAPI 실제 수집 자료 · 수집 시점의 공개 자료 사본입니다. 실시간 갱신이 아닙니다.',
    limitations: [
      ...publication.snapshot.limitations,
      '관광자원 목록과 시설 수는 실제 체류시간·소비액·관광약자 접근성의 관측값이 아닙니다.',
      '관광권역은 기획상 중심점과 고정 반경으로 묶은 검토 범위이며 법정 경계나 실제 방문권이 아닙니다.',
      '과제 작성·현장검증은 별도의 예시 시연이며 서버 영구 저장은 제공하지 않습니다.',
    ],
    status: { ...publication.snapshot.status, message: '검증된 API 응답을 수집 시점의 공개 자료 사본으로 표시합니다.' },
  };
  return {
    schemaVersion: 1, collectedAt: now.toISOString(), sourceDate: dateIso,
    apiEndpoints: ['KorService2/areaCode2', 'KorService2/areaBasedList2', 'DataLabService/locgoRegnVisitrDDList'],
    visitorRecordCount: visitorRecords.length, snapshot,
  };
}

export function readPublicTourismCapture(value: unknown): PublicTourismCapture | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<PublicTourismCapture>;
  if (candidate.schemaVersion !== 1 || typeof candidate.collectedAt !== 'string' ||
      !Number.isFinite(Date.parse(candidate.collectedAt)) || typeof candidate.sourceDate !== 'string' ||
      !Array.isArray(candidate.apiEndpoints) || !candidate.apiEndpoints.every((entry) => typeof entry === 'string') ||
      !Number.isSafeInteger(candidate.visitorRecordCount) || (candidate.visitorRecordCount ?? 0) < 1) return null;
  const snapshot = toLiveSnapshot(candidate.snapshot);
  if (!snapshot || snapshot.places.length === 0 ||
      snapshot.visitorContext.period.start !== candidate.sourceDate || snapshot.visitorContext.period.end !== candidate.sourceDate ||
      snapshot.regions.some((region) => region.potentialScore !== null || region.confidenceScore !== null || region.evaluation)) return null;
  return { ...candidate, snapshot } as PublicTourismCapture;
}

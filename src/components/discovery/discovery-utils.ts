import { REGIONS, type EvidenceStatus, type PublishedSnapshot, type RegionId } from '../../lib/domain';

export const METRICS = [
  ['관광자원 기반', '미확정'],
  ['체류·지역소비 지원 여건', '미확정'],
  ['권역 내 이동 연결', '미확정'],
  ['관광약자 이용 여건', '미확정'],
  ['주민·환경 여건', '미확정'],
] as const;

export const evidenceStatusLabel: Record<EvidenceStatus, string> = {
  verified: '확인된 데이터',
  inferred: '추론',
  'field-required': '현장확인 필요',
  unknown: '정보 없음',
  example: '예시',
};

export function getRegionName(id: RegionId) {
  return REGIONS.find((region) => region.id === id)?.name ?? id;
}

export function getRegion(snapshot: PublishedSnapshot, id: RegionId) {
  return snapshot.regions.find((region) => region.id === id);
}

export function scoreText(score: number | null) {
  return score === null ? '산출 대기' : `${score}점`;
}

export function formatPublishedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) return '미발행';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(date);
}

export function sourcePeriodText(period: PublishedSnapshot['visitorContext']['period']) {
  if (!period.start || !period.end) return '미확인';
  return period.start === period.end ? period.start : `${period.start} ~ ${period.end}`;
}

export function isDemo(snapshot: PublishedSnapshot) {
  return snapshot.mode === 'demo';
}

export function recommendationLabel(recommendation: string) {
  return {
    'business-planning': '사업기획 우선 검토',
    'field-validation': '현장검증 우선',
    'long-term-observation': '중장기 관찰',
    pending: '산출 대기',
  }[recommendation] ?? '검토 필요';
}

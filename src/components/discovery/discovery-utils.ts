import { REGIONS, type EvidenceStatus, type PublishedSnapshot, type RegionId } from '../../lib/domain';

export const METRICS = [
  ['관광수요', '30%'],
  ['체류·소비 전환', '25%'],
  ['권역 연결성', '20%'],
  ['관광약자 접근성', '15%'],
  ['지속가능성', '10%'],
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
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(date);
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

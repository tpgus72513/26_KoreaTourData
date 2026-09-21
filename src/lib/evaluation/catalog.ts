import type { PublishedSnapshot, RegionId } from '../domain';
import { evaluateRegion, type EvaluationInput, type EvaluationModel, type EvaluationResult } from './engine';

export interface EvaluationBundle {
  model: EvaluationModel;
  input: EvaluationInput;
  result: EvaluationResult;
}

export const RESEARCH_REFERENCES = [
  { id: 'R1', title: 'Park & Yoon (2011)', url: 'https://onlinelibrary.wiley.com/doi/10.1002/jtr.804', application: '지역 지표 선정과 델파이·AHP 검토 절차' },
  { id: 'R2', title: 'Hoang et al. (2018)', url: 'https://www.mdpi.com/2071-1050/10/9/3097', application: '관광자원과 지원 여건의 다기준 평가' },
  { id: 'R3', title: 'Choi & Sirakaya (2006)', url: 'https://doi.org/10.1016/j.tourman.2005.05.018', application: '주민·환경을 포함한 지속가능성 지표' },
  { id: 'R4', title: 'Darcy & Dickson (2009)', url: 'https://doi.org/10.1375/jhtm.16.1.32', application: '이용자별 연속적인 관광 경험과 접근 요구' },
  { id: 'R5', title: 'Aguiló et al. (2017)', url: 'https://doi.org/10.1016/j.tmp.2016.10.008', application: '체류와 소비를 단순 시설 수로 대체하지 않는 해석' },
  { id: 'R6', title: 'Lozano-Oyola et al. (2012)', url: 'https://doi.org/10.1016/j.ecolind.2012.01.014', application: '지속가능관광 지표를 계획에 연결' },
  { id: 'R7', title: 'Saaty (2008)', url: 'https://doi.org/10.1504/IJSSCI.2008.017590', application: 'AHP 쌍대비교와 우선순위 벡터' },
  { id: 'R8', title: 'Greco et al. (2019)', url: 'https://link.springer.com/article/10.1007/s11205-017-1832-9', application: '정규화·가중·집계·민감도에 따른 해석 한계' },
  { id: 'R9', title: 'López-del-Pino et al. (2025)', url: 'https://doi.org/10.1016/j.tbs.2025.101161', application: '관광 이동의 접근성 장벽 검토' },
] as const;

// These are service-designed illustrative indicators, not coefficients estimated in a paper.
export const ILLUSTRATIVE_MODEL: EvaluationModel = {
  version: 'with-local-conditions-demo-v1',
  status: 'illustrative',
  weightMethod: '동등가중치 20% · 전문가 조사 전의 시연 기준',
  domains: [
    { id: 'resources', label: '관광자원 기반', references: ['R1', 'R2'], indicator: '핵심 자원 운영 가능률', denominator: '가상 핵심 관광자원 20곳' },
    { id: 'stay-local', label: '체류·지역소비 지원 여건', references: ['R2', 'R5'], indicator: '숙박·식음 운영 연결률', denominator: '가상 핵심 관광지 20곳' },
    { id: 'mobility', label: '권역 내 이동 연결', references: ['R2'], indicator: '계획 시간 내 이동 연결률', denominator: '가상 사전 지정 지점 쌍 20개' },
    { id: 'accessibility', label: '관광약자 이용 여건', references: ['R4', 'R9'], indicator: '지정 이용자 이용조건 충족률', denominator: '가상 휠체어 이용자 동선·서비스 조사 항목 20개' },
    { id: 'community-environment', label: '주민·환경 여건', references: ['R3', 'R6'], indicator: '주민·환경 사전 합의조건 충족률', denominator: '가상 주민·관리기관 합의조건 20개' },
  ].map((domain) => ({
    id: domain.id,
    label: domain.label,
    weight: 0.2,
    indicators: [{
      id: `${domain.id}-ratio`, label: domain.indicator, unit: '%', weight: 1,
      lower: 0, upper: 100, direction: 'benefit',
      denominator: domain.denominator,
      benchmarkRationale: '계산 시연을 위해 고정한 0~100% 충족률 척도. 실제 지역의 타당성 검토나 현장 측정을 거친 기준이 아닙니다.',
      referenceIds: domain.references,
    }],
  })),
};

const DEMO_VALUES: Record<RegionId, (number | null)[]> = {
  'old-town-wolyeonggyo': [80, 60, 70, 50, 65],
  hahoemaeul: [80, 60, 70, null, 65],
  'dosan-yekki': [70, 50, 40, 35, 60],
};

export function createDemoEvaluation(regionId: RegionId): EvaluationBundle {
  const model = structuredClone(ILLUSTRATIVE_MODEL);
  const period = { start: '2026-09-01', end: '2026-09-07' };
  const input: EvaluationInput = {
    regionId,
    dataVersion: `synthetic-${regionId}-v1`,
    period,
    observations: model.domains.map((domain, index) => ({
      indicatorId: domain.indicators[0].id,
      value: DEMO_VALUES[regionId][index],
      unit: domain.indicators[0].unit,
      source: '문헌 계산법 설명을 위한 합성 자료 · 실측/API 응답 아님',
      period: { ...period }, scope: regionId, denominator: domain.indicators[0].denominator,
      kind: 'example',
    })),
    gates: [
      { id: 'continuous-route', label: '지정 이용자의 필수 동선', status: regionId === 'dosan-yekki' ? 'fail' : 'unknown', source: '가상 판정 시나리오 · 실제 동선 조사 아님' },
      { id: 'environment-operation', label: '환경 관리조건 및 운영주체 참여', status: 'unknown', source: '가상 판정 시나리오 · 실제 협의 아님' },
    ],
  };
  return { model, input, result: evaluateRegion(model, input) };
}

export function getEvaluationBundle(snapshot: PublishedSnapshot, regionId: RegionId): EvaluationBundle | null {
  // Never promote the demo bundle carried by a copied/legacy snapshot to live evidence.
  if (snapshot.mode !== 'demo') return null;
  const bundle = snapshot.regions.find((region) => region.id === regionId)?.evaluation;
  return bundle?.model.status === 'illustrative' && bundle.input.regionId === regionId ? bundle : null;
}

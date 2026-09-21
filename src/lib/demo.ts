import type { PublishedSnapshot, ValidationTask } from './domain';
import { createDemoEvaluation } from './evaluation/catalog';

const DEMO_DISCLAIMER = '시연 데이터 · 실제 지역평가 아님';

const baseDemoSnapshot: PublishedSnapshot = {
  mode: 'demo',
  publishedAt: '2026-09-21T00:00:00.000Z',
  disclaimer: DEMO_DISCLAIMER,
  visitorContext: {
    scope: '안동시',
    source: '시연 데이터',
    period: { start: '2026-09-01', end: '2026-09-07' },
    visitorCount: null,
    evidenceStatus: 'example',
    note: '시·군 단위 방문자 맥락 지표는 관광권역별 관측값으로 사용하지 않습니다.',
  },
  regions: [
    {
      id: 'old-town-wolyeonggyo',
      potentialScore: null,
      confidenceScore: null,
      evidenceStatus: 'example',
      recommendation: 'business-planning',
      summary: '야간 콘텐츠와 전통시장 동선의 연결을 우선 검토합니다.',
      reasons: [
        '야간 체류 콘텐츠를 연결할 여지가 있습니다.',
        '원도심 상권과 관광 동선을 함께 검토할 수 있습니다.',
        '현장 운영 정보 확인이 필요합니다.',
      ],
      bottleneck: '야간 운영과 지역상권 연계의 현장 확인 필요',
      missingDataCount: 3,
    },
    {
      id: 'hahoemaeul',
      potentialScore: null,
      confidenceScore: null,
      evidenceStatus: 'example',
      recommendation: 'field-validation',
      summary: '주변 음식·숙박과의 체류 연결을 현장에서 확인합니다.',
      reasons: [
        '대표 관광자원의 체류 연계 가능성을 검토합니다.',
        '주변 음식·숙박의 실제 운영 여부가 확인되지 않았습니다.',
        '이동과 접근성 조건을 현장에서 점검해야 합니다.',
      ],
      bottleneck: '음식·숙박 연결과 접근성의 현장 검증 필요',
      missingDataCount: 4,
    },
    {
      id: 'dosan-yekki',
      potentialScore: null,
      confidenceScore: null,
      evidenceStatus: 'example',
      recommendation: 'field-validation',
      summary: '무차량 이동과 관광약자 접근성을 우선 조사합니다.',
      reasons: [
        '분산된 관광 자원의 연결 조건을 살펴볼 수 있습니다.',
        '무차량 이동 정보가 부족합니다.',
        '관광약자 접근성은 현장 확인 전입니다.',
      ],
      bottleneck: '무차량 이동 및 관광약자 접근성 정보 부족',
      missingDataCount: 5,
    },
  ],
  places: [
    {
      id: 'demo-wolyeonggyo',
      name: '월영교',
      category: 'attraction',
      latitude: 36.5652,
      longitude: 128.7364,
      regionId: 'old-town-wolyeonggyo',
      evidenceStatus: 'example',
      source: '시연 데이터',
      address: '경상북도 안동시 상아동',
    },
    {
      id: 'demo-hahoe',
      name: '하회마을',
      category: 'attraction',
      latitude: 36.5392,
      longitude: 128.5185,
      regionId: 'hahoemaeul',
      evidenceStatus: 'example',
      source: '시연 데이터',
      address: '경상북도 안동시 풍천면 하회종가길',
    },
    {
      id: 'demo-yekki',
      name: '예끼마을',
      category: 'attraction',
      latitude: 36.7434,
      longitude: 128.8432,
      regionId: 'dosan-yekki',
      evidenceStatus: 'example',
      source: '시연 데이터',
      address: '경상북도 안동시 도산면 선성길',
    },
  ],
  limitations: [
    '현재 점수와 검토 의견은 시연 자료로 계산·작성했습니다. 실제 지역평가에는 실측자료와 검증이 필요합니다.',
    '관광권역 여건 점수는 성장확률이나 투자효과가 아닙니다. 지표·가중치와 평가모형은 검증 전입니다.',
    '시·군 단위 방문자 수는 관광권역별 실측값으로 배분하지 않습니다.',
    '관광약자 접근성, 운영시간, 이동 연결성은 현장 확인 전입니다.',
  ],
  status: {
    type: 'ready',
    message: '시연 데이터 모드입니다.',
    lastAttemptAt: null,
    affectedData: [],
  },
};

export const demoSnapshot: PublishedSnapshot = {
  ...baseDemoSnapshot,
  regions: baseDemoSnapshot.regions.map((region) => {
    const evaluation = createDemoEvaluation(region.id);
    return {
      ...region,
      recommendation: evaluation.result.gateStatus === 'reviewable' ? region.recommendation : 'field-validation',
      potentialScore: evaluation.result.totalScore,
      missingDataCount: evaluation.result.missingIndicatorIds.length,
      evaluation,
    };
  }),
};

export const demoTasks: ValidationTask[] = [
  {
    id: 'demo-task-hahoe-stay',
    regionId: 'hahoemaeul',
    title: '하회마을 주변 음식·숙박 연결 확인',
    location: '하회마을 인근',
    question: '방문객이 식사와 숙박으로 이어질 수 있는 실제 운영 동선이 있는가?',
    status: 'not-started',
    assignedTo: null,
    scheduledFor: null,
    notes: null,
    result: null,
    relatedAction: '하회마을과 주변 음식·숙박 연결 검토',
    checklist: [
      { id: 'operating-hours', label: '실제 운영 여부와 운영시간', completed: false },
      { id: 'walking-route', label: '도보·대중교통 연결', completed: false },
      { id: 'local-partners', label: '지역상권 참여 가능성', completed: false },
    ],
  },
  {
    id: 'demo-task-dosan-accessibility',
    regionId: 'dosan-yekki',
    title: '도산권 무차량 이동·접근성 조사',
    location: '도산·예끼마을권',
    question: '무차량 방문자와 관광약자가 이동할 수 있는 조건이 갖춰져 있는가?',
    status: 'not-started',
    assignedTo: null,
    scheduledFor: null,
    notes: null,
    result: null,
    relatedAction: '도산권 무차량 이동·관광약자 접근성 현장조사',
    checklist: [
      { id: 'entrance', label: '경사·턱·출입구·화장실', completed: false },
      { id: 'transport', label: '대중교통 연결', completed: false },
      { id: 'parking', label: '주차·수용 능력', completed: false },
    ],
  },
];

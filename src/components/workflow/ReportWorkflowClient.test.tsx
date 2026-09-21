import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { ValidationTask } from '../../lib/domain';
import { ReportWorkflowClient } from './ReportWorkflowClient';
import { displayAnalysisDate } from './WorkflowShell';
import { uniqueSourceLabels } from './WorkflowViews';

const task: ValidationTask = {
  id: 'demo-task',
  regionId: 'hahoemaeul',
  title: '초기 과제',
  location: '하회마을',
  question: '확인 질문',
  status: 'in-progress',
  assignedTo: null,
  scheduledFor: null,
  notes: null,
  result: null,
  relatedAction: '세션에서 복원된 실행과제',
  checklist: [],
};

afterEach(() => window.sessionStorage.clear());

describe('ReportWorkflowClient', () => {
  it('uses 미발행 rather than the epoch when no live snapshot has been published', () => {
    expect(displayAnalysisDate('1970-01-01T00:00:00.000Z')).toBe('미발행');
  });

  it('deduplicates nonempty source labels before report rendering', () => {
    expect(uniqueSourceLabels(['예시 데이터', '', '예시 데이터', ' 한국관광공사 관광정보 API '])).toEqual([
      '예시 데이터',
      '한국관광공사 관광정보 API',
    ]);
  });

  it('uses same-tab demo validation edits in the report preview', async () => {
    window.sessionStorage.setItem('andong-demo-validation-tasks', JSON.stringify([task]));
    render(
      <ReportWorkflowClient
        initialTasks={[]}
        mode="demo"
        report={{
          analyzedAt: '2026-09-21',
          sources: ['예시 데이터', '예시 데이터', ''],
          limitations: ['예시 데이터입니다.'],
          priorityRegion: '하회마을권',
          reasons: ['현장 확인이 필요합니다.'],
          potentialScore: 68,
          confidenceScore: 42,
          mode: 'demo',
        }}
      />,
    );

    expect(await screen.findByText('세션에서 복원된 실행과제')).toBeTruthy();
    expect(screen.getByText('예시 데이터 · 정책 판단 금지')).toBeTruthy();
    expect(screen.getByText('관광권역 여건 점수')).toBeTruthy();
    expect(screen.getByText('68점')).toBeTruthy();
    expect(screen.getByText('자료 검증 기준 수립 전')).toBeTruthy();
    expect(screen.queryByText('42점')).toBeNull();
    expect(screen.getByText('확인 중 1건')).toBeTruthy();
    expect(screen.getByText('KPI 초안: 현장검증 과제 완료 0/1건')).toBeTruthy();
  });
});

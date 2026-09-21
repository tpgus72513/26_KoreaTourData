import { cleanup, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActionTaskCard, FieldValidationBoard, ReportPreview } from './WorkflowViews';
import type { ValidationTask } from '../../lib/domain';
import { createDemoEvaluation } from '../../lib/evaluation/catalog';

afterEach(cleanup);

const task: ValidationTask = {
  id: 'field-1',
  regionId: 'hahoemaeul',
  title: '하회마을 주변 음식·숙박 연결 확인',
  location: '하회마을 입구',
  question: '주말 대중교통 연결이 실제로 운영되나요?',
  status: 'not-started' as const,
  checklist: [],
  notes: null,
  result: null,
  relatedAction: '하회마을과 주변 음식·숙박 연결 검토',
  assignedTo: null,
  scheduledFor: null,
};

describe('workflow views', () => {
  it('includes the shared calculation and missing-data bounds in the live report', () => {
    const { container } = render(<ReportPreview report={{
      analyzedAt: '2026-09-21', mode: 'live', sources: [], limitations: [],
          priorityRegion: '하회마을권', potentialScore: 68, confidenceScore: 42, reasons: [], tasks: [],
      snapshotStatus: { type: 'ready', message: '자료 동기화 완료', affectedData: [], lastAttemptAt: null },
      evaluations: [createDemoEvaluation('old-town-wolyeonggyo'), createDemoEvaluation('hahoemaeul')],
    }} />);
    const report = within(container);
    expect(report.getByRole('table', { name: '권역별 계산 결과와 근거 버전' })).toBeTruthy();
    expect(report.getByText('65.0점')).toBeTruthy();
    expect(report.getByText('55.0 ~ 75.0점')).toBeTruthy();
    expect(report.getByText('80.0%')).toBeTruthy();
    expect(report.getByText('synthetic-hahoemaeul-v1')).toBeTruthy();
  });
  it('links an action task to its related field validation item', () => {
    render(<ActionTaskCard task={task} />);

    expect(screen.getByRole('link', { name: '현장검증에서 보기' }).getAttribute('href')).toBe(
      '/field?task=field-1',
    );
  });

  it('keeps the field workflow focused on saved validation work', () => {
    render(<FieldValidationBoard tasks={[task]} mode="demo" onSave={vi.fn()} />);

    expect(screen.queryByText(/시연 모드/)).toBeNull();
    expect(screen.getByLabelText('담당자')).toBeTruthy();
    expect(screen.getByLabelText('예정일')).toBeTruthy();
    expect(screen.getByLabelText('검증 결과')).toBeTruthy();
    expect(screen.getByRole('button', { name: '현장검증 내용 저장' })).toBeTruthy();
  });

  it('uses a restored task prop after returning to the field screen', () => {
    const { container, rerender } = render(<FieldValidationBoard tasks={[task]} mode="demo" onSave={vi.fn()} />);

    rerender(
      <FieldValidationBoard
        tasks={[{ ...task, notes: '다시 연 화면에서도 유지되는 메모' }]}
        mode="demo"
        onSave={vi.fn()}
      />,
    );

    expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('다시 연 화면에서도 유지되는 메모');
  });

  it('renders report date, sources, limitations, and a real print action', () => {
    render(
      <ReportPreview
        report={{
          analyzedAt: '2026-09-21',
          mode: 'demo',
          sources: ['한국관광공사 관광정보 API'],
          limitations: ['권역별 실측 방문 데이터가 없습니다.'],
          priorityRegion: '하회마을권',
          potentialScore: 68,
          confidenceScore: 42,
          reasons: ['체류·소비 연결을 현장 확인합니다.'],
          tasks: [task],
        }}
      />,
    );

    expect(screen.getByText('스냅샷 발행일: 2026-09-21')).toBeTruthy();
    expect(screen.getByText('한국관광공사 관광정보 API')).toBeTruthy();
    expect(screen.getByText('포함된 데이터 출처')).toBeTruthy();
    expect(screen.queryByText('데이터 한계')).toBeNull();
    expect(screen.queryByText('관광권역 여건 점수')).toBeNull();
    expect(screen.queryByText('최신 자료 반영')).toBeNull();
    expect(screen.getByText('현장검증 및 실행')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PDF 미리보기' })).toBeTruthy();
  });
});

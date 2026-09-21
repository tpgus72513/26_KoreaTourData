import { cleanup, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ActionsPage from '../../app/actions/page';
import FieldPage from '../../app/field/page';
import ReportPage from '../../app/report/page';
import { demoSnapshot, demoTasks } from '../../lib/demo';
import { loadSnapshot } from '../../lib/snapshot';
import { listPersistedTasksForAdmin } from '../../lib/tasks';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('../../lib/snapshot', () => ({ loadSnapshot: vi.fn() }));
vi.mock('../../lib/tasks', () => ({ listPersistedTasksForAdmin: vi.fn() }));
vi.mock('./AdminSessionControl', () => ({ AdminSessionControl: () => null }));

afterEach(() => { cleanup(); window.sessionStorage.clear(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe('workflow page evidence integrity', () => {
  it('does not choose a priority from pending regions and prints stale data and unavailable tasks', async () => {
    vi.stubGlobal('React', React);
    vi.mocked(loadSnapshot).mockResolvedValue({
      ...demoSnapshot, mode: 'live', publishedAt: '2026-09-21T00:00:00.000Z',
      visitorContext: { ...demoSnapshot.visitorContext, period: { start: '2026-08-20', end: '2026-08-20' } },
      regions: demoSnapshot.regions.map((region) => ({ ...region, recommendation: 'pending', potentialScore: null, confidenceScore: null })),
      status: { type: 'stale', message: '최근 동기화에 실패했습니다.', lastAttemptAt: '2026-09-21T01:00:00.000Z', affectedData: ['방문자 자료'] },
    });
    vi.mocked(listPersistedTasksForAdmin).mockResolvedValue({ authorized: true, tasks: [], failed: true });
    render(await ReportPage());
    const report = within(screen.getByRole('article', { name: '안동 관광권역 정책 검토안' }));
    expect(report.queryByText('원도심·월영교권')).toBeNull();
    expect(report.getByText('최근 동기화에 실패했습니다.')).toBeTruthy();
    expect(report.getByText(/방문자 자료 기간: 2026-08-20/)).toBeTruthy();
    expect(report.getByText('스냅샷 발행일: 2026-09-21')).toBeTruthy();
    expect(report.getByText(/현장검증 자료를 불러오지 못해/)).toBeTruthy();
    expect(report.queryByText(/완료 0\/0건/)).toBeNull();
    expect(report.queryByText('등록된 현장검증 과제가 없습니다.')).toBeNull();
  });

  it('uses saved demo task statuses on the action screen', async () => {
    vi.stubGlobal('React', React);
    vi.mocked(loadSnapshot).mockResolvedValue(demoSnapshot);
    window.sessionStorage.setItem('andong-demo-validation-tasks', JSON.stringify([{ ...demoTasks[0], status: 'completed' }]));
    render(await ActionsPage());
    expect(screen.getByText('확인 완료')).toBeTruthy();
    expect(screen.queryByText('확인 전')).toBeNull();
  });

  it('passes the selected action task through to the field screen', async () => {
    vi.mocked(loadSnapshot).mockResolvedValue(demoSnapshot);
    render(await FieldPage({ searchParams: Promise.resolve({ task: demoTasks[1].id }) }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: demoTasks[1].title }).closest('article'));
  });
});

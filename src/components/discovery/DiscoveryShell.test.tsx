import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import { demoSnapshot } from '../../lib/demo';

import { ComparisonView } from './ComparisonView';
import { DiscoveryShell } from './DiscoveryShell';
import { EvidenceDetail } from './EvidenceDetail';

afterEach(cleanup);

describe('discovery screens', () => {
  test('renders a named map region and the data exploration status', () => {
    render(<DiscoveryShell snapshot={demoSnapshot} />);

    expect(screen.getByText('안동 관광권역 탐색')).not.toBeNull();
    expect(screen.getByRole('button', { name: /원도심·월영교권 선택/ })).not.toBeNull();
    expect(screen.getByText('관광 데이터 탐색 자료')).not.toBeNull();
  });

  test('compares all three canonical regions', () => {
    render(<ComparisonView snapshot={demoSnapshot} />);

    for (const name of ['원도심·월영교권', '하회마을권', '도산·예끼마을권']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  test('shows the evidence source, spatial scope, and period', () => {
    render(<EvidenceDetail snapshot={demoSnapshot} regionId="hahoemaeul" />);

    expect(screen.getAllByText('출처 API').length).toBeGreaterThan(0);
    expect(screen.getAllByText('공간 범위').length).toBeGreaterThan(0);
    expect(screen.getAllByText('기준 기간').length).toBeGreaterThan(0);
    expect(screen.getByText('원천 데이터와 공간 단위를 함께 확인합니다')).not.toBeNull();
  });

  test('renders null live scores as pending rather than zero', () => {
    const liveSnapshot = {
      ...demoSnapshot,
      mode: 'live' as const,
      regions: demoSnapshot.regions.map((region) => ({
        ...region,
        evaluation: undefined,
        potentialScore: null,
        confidenceScore: null,
      })),
    };

    render(<ComparisonView snapshot={liveSnapshot} />);

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('검토 점수 0')).toBeNull();
  });

  test('filters the map fallback resources as the resource category changes', () => {
    render(<DiscoveryShell snapshot={demoSnapshot} />);

    fireEvent.change(screen.getByLabelText('자원 유형'), { target: { value: '숙박' } });

    expect(screen.getByText('지도 대체 자원 0건')).not.toBeNull();
  });

  test('labels an unissued live snapshot date as unpublished', () => {
    render(<DiscoveryShell snapshot={{ ...demoSnapshot, mode: 'live', publishedAt: '1970-01-01T00:00:00.000Z' }} />);

    expect(screen.getByText('발행일 미발행')).not.toBeNull();
  });

  test('does not select a priority region when every recommendation is pending', () => {
    render(<ComparisonView snapshot={{
      ...demoSnapshot,
      mode: 'live',
      regions: demoSnapshot.regions.map((region) => ({ ...region, recommendation: 'pending' })),
    }} />);

    expect(screen.queryByText('현재 우선 검토 권역')).toBeNull();
    expect(screen.getByText('권역을 선택해 확인하세요')).not.toBeNull();
  });

  test('labels a map selection as a selection rather than a recommendation', () => {
    render(<DiscoveryShell snapshot={demoSnapshot} />);
    fireEvent.click(screen.getByRole('button', { name: '하회마을권 선택' }));

    expect(screen.getByText('현재 선택 권역')).not.toBeNull();
    expect(screen.queryByText('현재 우선 검토')).toBeNull();
  });

  test('uses the observation period separately from the snapshot publication date', () => {
    render(<DiscoveryShell snapshot={{
      ...demoSnapshot,
      publishedAt: '2026-09-21T00:00:00.000Z',
      visitorContext: { ...demoSnapshot.visitorContext, period: { start: '2026-08-20', end: '2026-08-22' } },
    }} />);

    expect(screen.getAllByText('안동시 방문자 기준 기간 2026-08-20 ~ 2026-08-22').length).toBeGreaterThan(0);
    expect(screen.queryByText(/분석 기준일/)).toBeNull();
    expect(screen.getByText(/발행일/)).not.toBeNull();
  });

  test('does not mark an empty live snapshot as verified', () => {
    render(<DiscoveryShell snapshot={{
      ...demoSnapshot,
      mode: 'live',
      places: [],
      status: { ...demoSnapshot.status, type: 'empty', message: '발행된 자료 없음' },
    }} />);

    expect(screen.queryByText('데이터 확인 상태: 확인된 데이터')).toBeNull();
    expect(screen.getByText('자료 모드: 라이브')).not.toBeNull();
  });

  test('keeps an unassessed missing-data count distinct from an observed zero', () => {
    render(<ComparisonView snapshot={{
      ...demoSnapshot,
      regions: demoSnapshot.regions.map((region, index) => ({ ...region, missingDataCount: index === 0 ? null : 0 })),
    }} />);

    expect(screen.getByText('연결 데이터')).not.toBeNull();
    expect(screen.getAllByText('0건')).toHaveLength(2);
  });

  test('demo comparison directs visitors to public data without synthetic scores', () => {
    render(<ComparisonView snapshot={{ ...demoSnapshot, mode: 'demo', regions: demoSnapshot.regions.map((region) => ({ ...region, evaluation: undefined })) }} />);
    expect(screen.queryByText('65점')).toBeNull();
    expect(screen.queryByText('51점')).toBeNull();
    expect(screen.getByRole('link', { name: '실제 공공데이터 탐색하기' })).not.toBeNull();
    expect(screen.queryByText('사업기획 우선 검토')).toBeNull();
    expect(screen.queryByText('현장검증 우선')).toBeNull();
  });

  test.each([72, null])('does not draw invented contributions for a total of %s', (potentialScore) => {
    const { container } = render(<EvidenceDetail snapshot={{
      ...demoSnapshot,
      regions: demoSnapshot.regions.map((region) => ({ ...region, potentialScore, evaluation: undefined })),
    }} regionId="old-town-wolyeonggyo" />);

    expect(screen.queryAllByText(/검토용 예시 \d+점/)).toHaveLength(0);
    expect(container.querySelectorAll('.contribution-track')).toHaveLength(0);
    expect(screen.getByRole('link', { name: '실제 공공데이터 탐색하기' })).not.toBeNull();
    expect(screen.queryByText(/권역 분석은 .* 기준으로 계산했습니다/)).toBeNull();
  });

  test('shows a condition score with a neutral analysis status', () => {
    render(<EvidenceDetail snapshot={demoSnapshot} regionId="old-town-wolyeonggyo" />);

    expect(screen.queryByText('관광권역 여건 점수')).toBeNull();
    expect(screen.queryByText('65점')).toBeNull();
    expect(screen.getByRole('link', { name: '실제 공공데이터 탐색하기' })).not.toBeNull();
  });

  test('uses independently calculated domain scores and exposes the same detailed total', () => {
    const { unmount } = render(<ComparisonView snapshot={demoSnapshot} />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('link', { name: '실제 공공데이터 탐색하기' })).not.toBeNull();
    unmount();

    render(<EvidenceDetail snapshot={demoSnapshot} regionId="old-town-wolyeonggyo" />);
    expect(screen.queryByRole('table', { name: '지표별 계산 추적표' })).toBeNull();
    expect(screen.queryByText('65.0점')).toBeNull();
  });

  test('names the evidence modal, traps keyboard focus, and returns focus after Escape', () => {
    render(<EvidenceDetail snapshot={demoSnapshot} regionId="old-town-wolyeonggyo" />);
    const opener = screen.getByRole('button', { name: '원자료 상세 열기' });
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: '표시된 근거의 범위' });
    const closeButton = within(dialog).getByRole('button', { name: '닫기' });
    expect(document.activeElement).toBe(closeButton);
    expect(opener.closest('[inert]')).not.toBeNull();
    expect(fireEvent.keyDown(closeButton, { key: 'Tab' })).toBe(false);
    expect(fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })).toBe(false);
    fireEvent.keyDown(closeButton, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(opener.closest('[inert]')).toBeNull();
  });
});

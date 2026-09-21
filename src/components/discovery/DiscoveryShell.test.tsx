import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import { demoSnapshot } from '../../lib/demo';

import { ComparisonView } from './ComparisonView';
import { DiscoveryShell } from './DiscoveryShell';
import { EvidenceDetail } from './EvidenceDetail';

afterEach(cleanup);

describe('discovery screens', () => {
  test('renders a named map region and the required demo policy disclaimer', () => {
    render(<DiscoveryShell snapshot={demoSnapshot} />);

    expect(screen.getByText('안동 관광권역 탐색')).not.toBeNull();
    expect(screen.getByRole('button', { name: /원도심·월영교권 선택/ })).not.toBeNull();
    expect(screen.getByText('예시 데이터 · 정책 판단 금지')).not.toBeNull();
  });

  test('compares all three canonical regions', () => {
    render(<ComparisonView snapshot={demoSnapshot} />);

    for (const name of ['원도심·월영교권', '하회마을권', '도산·예끼마을권']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  test('shows the evidence source, spatial scope, period, and limitation', () => {
    render(<EvidenceDetail snapshot={demoSnapshot} regionId="hahoemaeul" />);

    expect(screen.getAllByText('출처 API').length).toBeGreaterThan(0);
    expect(screen.getAllByText('공간 범위').length).toBeGreaterThan(0);
    expect(screen.getAllByText('기준 기간').length).toBeGreaterThan(0);
    expect(screen.getByText('해석 한계')).not.toBeNull();
  });

  test('renders null live scores as pending rather than zero', () => {
    const liveSnapshot = {
      ...demoSnapshot,
      mode: 'live' as const,
      regions: demoSnapshot.regions.map((region) => ({
        ...region,
        potentialScore: null,
        confidenceScore: null,
      })),
    };

    render(<ComparisonView snapshot={liveSnapshot} />);

    expect(screen.getAllByText('산출 대기').length).toBeGreaterThan(0);
    expect(screen.queryByText('검토 점수 0')).toBeNull();
  });

  test('filters the map fallback resources as the resource category changes', () => {
    render(<DiscoveryShell snapshot={demoSnapshot} />);

    fireEvent.change(screen.getByLabelText('자원 유형'), { target: { value: '숙박' } });

    expect(screen.getByText('지도 대체 자원 0건')).not.toBeNull();
  });

  test('labels an unissued live snapshot date as unpublished', () => {
    render(<DiscoveryShell snapshot={{ ...demoSnapshot, mode: 'live', publishedAt: '1970-01-01T00:00:00.000Z' }} />);

    expect(screen.getByText('분석 기준일 미발행')).not.toBeNull();
  });
});

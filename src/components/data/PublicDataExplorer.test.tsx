import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublicDataExplorer } from './PublicDataExplorer';
import { capturePublicTourismData } from '../../lib/tourism/capture';

vi.mock('../discovery/MapCanvas', () => ({
  MapCanvas: ({ places }: { places: { id: string; name: string }[] }) => <div data-testid="resource-map">{places.map((place) => <span key={place.id}>{place.name}</span>)}</div>,
}));

describe('real public resource explorer', () => {
  it('filters observed map resources by region and category without showing illustrative scores', async () => {
    const capture = await capturePublicTourismData({ serviceKey: 'secret', date: '20260820' }, {
      fetchVisitors: async () => [{ baseYmd: '20260820', signguCode: '47170', signguNm: '안동시', visitorType: '2', count: 100 }],
      fetchPlaces: async () => [
        { id: '1', name: '원도심 숙소', category: 'accommodation', latitude: 36.5652, longitude: 128.7364, regionId: null, evidenceStatus: 'verified', source: 'KTO', address: '안동시' },
        { id: '2', name: '원도심 식당', category: 'food', latitude: 36.5652, longitude: 128.7364, regionId: null, evidenceStatus: 'verified', source: 'KTO', address: '안동시' },
        { id: '3', name: '하회 관광지', category: 'attraction', latitude: 36.5392, longitude: 128.5185, regionId: null, evidenceStatus: 'verified', source: 'KTO', address: '안동시' },
      ],
    });
    render(<PublicDataExplorer capture={capture} />);
    const map = screen.getByTestId('resource-map');
    expect(within(map).getByText('원도심 숙소')).toBeTruthy();
    expect(within(map).getByText('원도심 식당')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('자원 유형'), { target: { value: 'food' } });
    expect(within(map).queryByText('원도심 숙소')).toBeNull();
    expect(within(map).getByText('원도심 식당')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('관광권역'), { target: { value: 'hahoemaeul' } });
    expect(map.textContent).toBe('');
    fireEvent.change(screen.getByLabelText('자원 유형'), { target: { value: 'all' } });
    expect(within(map).getByText('하회 관광지')).toBeTruthy();
    expect(screen.getAllByText('독립 관측값 필요')).toHaveLength(3);
    expect(screen.getByRole('link', { name: '권역 근거 검토 시연' }).getAttribute('href')).toBe('/regions/hahoemaeul');
    expect(screen.getByText(/2026-08-20 · 시 전체 맥락/)).toBeTruthy();
  });
});

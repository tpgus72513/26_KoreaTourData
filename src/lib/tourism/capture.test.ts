import { describe, expect, it, vi } from 'vitest';
import { capturePublicTourismData, readPublicTourismCapture } from './capture';
import type { TourismPlace } from '../domain';

const place: TourismPlace = {
  id: '123', name: '공공 관광자원', category: 'attraction', latitude: 36.5652,
  longitude: 128.7364, regionId: null, evidenceStatus: 'verified',
  source: 'KTO KorService2/areaBasedList2', address: '안동시',
};
const visitors = [{ baseYmd: '20260820', signguCode: '47170', signguNm: '안동시', visitorType: '2', count: 1234 }];

describe('public tourism capture', () => {
  it('publishes observed resources and city visitors without manufacturing region scores', async () => {
    const result = await capturePublicTourismData({ serviceKey: 'secret-not-for-publication', date: '20260820', now: new Date('2026-09-21T06:00:00Z') }, {
      fetchPlaces: vi.fn().mockResolvedValue([place]), fetchVisitors: vi.fn().mockResolvedValue(visitors),
    });
    expect(result.snapshot.places[0].regionId).toBe('old-town-wolyeonggyo');
    expect(result.snapshot.visitorContext.visitorCount).toBe(1234);
    expect(result.snapshot.visitorContext.period.start).toBe('2026-08-20');
    expect(result.snapshot.regions.every((region) => region.potentialScore === null)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('secret-not-for-publication');
    expect(readPublicTourismCapture(result)).toEqual(result);
  });

  it('does not publish a partial or ambiguous source batch', async () => {
    await expect(capturePublicTourismData({ serviceKey: 'secret', date: '20260820' }, {
      fetchPlaces: vi.fn().mockResolvedValue([place]), fetchVisitors: vi.fn().mockResolvedValue([]),
    })).rejects.toThrow();
  });

  it.each(['20260230', '2026-08-20', '2026082'])('rejects invalid collection date %s before making requests', async (date) => {
    const fetchPlaces = vi.fn();
    await expect(capturePublicTourismData({ serviceKey: 'secret', date }, { fetchPlaces, fetchVisitors: vi.fn() })).rejects.toThrow();
    expect(fetchPlaces).not.toHaveBeenCalled();
  });

  it('treats an absent or malformed stored capture as unavailable', () => {
    expect(readPublicTourismCapture(null)).toBeNull();
    expect(readPublicTourismCapture({ schemaVersion: 1, snapshot: {} })).toBeNull();
  });

  it('rejects a stored capture with fabricated scores', async () => {
    const result = await capturePublicTourismData({ serviceKey: 'secret', date: '20260820' }, {
      fetchPlaces: vi.fn().mockResolvedValue([place]), fetchVisitors: vi.fn().mockResolvedValue(visitors),
    });
    result.snapshot.regions[0].potentialScore = 90;
    expect(readPublicTourismCapture(result)).toBeNull();
  });
});

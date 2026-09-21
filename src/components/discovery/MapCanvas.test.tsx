import { describe, expect, test, vi } from 'vitest';

import { demoSnapshot } from '../../lib/demo';

import { addTourismPlaceMarkers, fitPolicyRegions } from './map-markers';

describe('MapCanvas', () => {
  test('uses vector POI markers and fits the three policy regions', () => {
    const layer = { addTo: vi.fn(), bindTooltip: vi.fn() };
    layer.addTo.mockReturnValue(layer);
    layer.bindTooltip.mockReturnValue(layer);
    const leaflet = { circleMarker: vi.fn(() => layer) };
    const map = { fitBounds: vi.fn() };

    addTourismPlaceMarkers(leaflet, map, demoSnapshot.places);
    fitPolicyRegions(map);

    expect(leaflet.circleMarker).toHaveBeenCalledTimes(demoSnapshot.places.length);
    expect(map.fitBounds).toHaveBeenCalledWith(expect.any(Array), { padding: [28, 28] });
    expect((layer.bindTooltip.mock.calls[0][0] as HTMLElement).textContent).toBe('월영교 · attraction');
  });
});

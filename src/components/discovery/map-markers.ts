import { REGIONS, type TourismPlace } from '../../lib/domain';

interface VectorMarker {
  addTo(map: unknown): VectorMarker;
  bindTooltip(content: HTMLElement): VectorMarker;
}

interface VectorMarkerFactory {
  circleMarker(position: [number, number], options: { color: string; fillColor: string; fillOpacity: number; radius: number; weight: number }): VectorMarker;
}

interface MapViewport {
  fitBounds(bounds: Array<[number, number]>, options: { padding: [number, number] }): unknown;
}

export function addTourismPlaceMarkers(leaflet: VectorMarkerFactory, map: unknown, places: TourismPlace[]) {
  for (const place of places) {
    const label = document.createElement('span');
    label.textContent = `${place.name} · ${place.category}`;

    leaflet.circleMarker([place.latitude, place.longitude], {
      color: '#0d513e',
      fillColor: '#4d9681',
      fillOpacity: 0.95,
      radius: 7,
      weight: 2,
    }).addTo(map).bindTooltip(label);
  }
}

export function fitPolicyRegions(map: MapViewport) {
  const bounds = REGIONS.flatMap((region) => {
    const latitudeOffset = region.radiusMeters / 111_320;
    const longitudeOffset = region.radiusMeters / (111_320 * Math.cos(region.center.latitude * (Math.PI / 180)));
    return [
      [region.center.latitude - latitudeOffset, region.center.longitude - longitudeOffset] as [number, number],
      [region.center.latitude + latitudeOffset, region.center.longitude + longitudeOffset] as [number, number],
    ];
  });
  map.fitBounds(bounds, { padding: [28, 28] });
}

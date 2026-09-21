'use client';

import React, { useEffect, useRef, useState } from 'react';

import type { PublishedSnapshot, RegionId, TourismPlace } from '../../lib/domain';
import { REGIONS } from '../../lib/domain';

import { getRegionName } from './discovery-utils';
import { addTourismPlaceMarkers, fitPolicyRegions } from './map-markers';

interface MapCanvasProps {
  snapshot: PublishedSnapshot;
  places: TourismPlace[];
  selectedRegionId: RegionId;
  onSelectRegion: (id: RegionId) => void;
}

export function MapCanvas({ snapshot, places, selectedRegionId, onSelectRegion }: MapCanvasProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!mapElement.current || !('ResizeObserver' in window)) {
      setMapState('error');
      return;
    }

    let disposed = false;
    let map: import('leaflet').Map | undefined;
    setMapState('loading');

    void import('leaflet').then((leaflet) => {
      if (disposed || !mapElement.current) return;

      map = leaflet.map(mapElement.current, { scrollWheelZoom: false }).setView([36.62, 128.7], 10);
      const tiles = process.env.NEXT_PUBLIC_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      const tileLayer = leaflet.tileLayer(tiles, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      });
      tileLayer.on('load', () => setMapState('ready'));
      tileLayer.on('tileerror', () => setMapState('error'));
      tileLayer.addTo(map);

      for (const region of REGIONS) {
        const circle = leaflet.circle([region.center.latitude, region.center.longitude], {
          color: region.id === selectedRegionId ? '#0d513e' : '#587368',
          fillColor: region.id === selectedRegionId ? '#4d9681' : '#a9c2b8',
          fillOpacity: region.id === selectedRegionId ? 0.26 : 0.12,
          radius: region.radiusMeters,
          weight: 2,
        }).addTo(map);
        circle.bindTooltip(region.name, { permanent: region.id === selectedRegionId, direction: 'center' });
        circle.on('click', () => onSelectRegion(region.id));
      }
      fitPolicyRegions(map);

      const visiblePlaces = places.filter((place) => snapshot.mode === 'demo' || place.evidenceStatus === 'verified');
      addTourismPlaceMarkers(leaflet, map, visiblePlaces);
    }).catch(() => setMapState('error'));

    return () => {
      disposed = true;
      map?.remove();
    };
  }, [onSelectRegion, places, selectedRegionId, snapshot]);

  return (
    <section className="map-frame" aria-label="안동 관광권역 지도">
      <div className="map-visual">
      <div className="map-canvas" ref={mapElement} aria-hidden="true" />
      {mapState === 'loading' && <div className="map-loading-layer" role="status">지도를 준비하는 중</div>}
      {mapState === 'error' && <p className="map-error" role="status">지도 타일을 불러오지 못했습니다. 아래 목록으로 권역과 자원을 확인할 수 있습니다.</p>}
      <div className="map-legend" aria-label="지도 범례">
        <strong>지도 범례</strong>
        <span>원형: 관광권역 반경</span>
        <span>{snapshot.mode === 'demo' ? '점: 예시 관광 자원' : '점: 공공 API 관광 자원'}</span>
      </div>
      <p className="map-attribution">© OpenStreetMap contributors · 지도 타일은 사전 로딩하지 않습니다.</p>
      </div>
      <div className="map-fallback" aria-label="지도 대체 권역 목록">
        <h3>지도 대체 목록</h3>
        <p>{mapState === 'error' ? '지도 오류 중에도 이 목록은 계속 사용할 수 있습니다.' : '지도를 사용하지 않는 경우에도 이 목록으로 권역과 자원을 검토할 수 있습니다.'}</p>
        <div className="region-select-list">
          {REGIONS.map((region) => (
            <button
              className={region.id === selectedRegionId ? 'region-select is-selected' : 'region-select'}
              key={region.id}
              onClick={() => onSelectRegion(region.id)}
              type="button"
            >
              {getRegionName(region.id)} 선택
            </button>
          ))}
        </div>
        <p className="fallback-resource-count">지도 대체 자원 {places.length}건</p>
        {places.length > 0 && <ul className="fallback-resource-list">{places.map((place) => <li key={place.id}>{place.name} · {place.category}</li>)}</ul>}
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';

import type { PublishedSnapshot, RegionId } from '../../lib/domain';
import { REGIONS } from '../../lib/domain';

import { MapCanvas } from './MapCanvas';
import { DataStatusBadge, ProvenanceBadge, ScorePair } from './StatusBadges';
import { formatPublishedAt, getRegion, getRegionName, recommendationLabel, scoreText, sourcePeriodText } from './discovery-utils';

const CATEGORIES = ['전체', '관광지', '숙박', '음식', '행사', '무장애'] as const;

export function DiscoveryShell({ snapshot }: { snapshot: PublishedSnapshot }) {
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId>(REGIONS[0].id);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('전체');
  const selected = getRegion(snapshot, selectedRegionId) ?? snapshot.regions[0];
  const selectedName = selected ? getRegionName(selected.id) : '권역 정보 없음';
  const visiblePlaces = useMemo(() => {
    if (category === '전체') return snapshot.places.length;
    const categoryMap = { 관광지: 'attraction', 숙박: 'accommodation', 음식: 'food', 행사: 'event', 무장애: 'accessibility' } as const;
    return snapshot.places.filter((place) => place.category === categoryMap[category]);
  }, [category, snapshot.places]);
  const filteredPlaces = Array.isArray(visiblePlaces) ? visiblePlaces : snapshot.places;
  const publishedAt = formatPublishedAt(snapshot.publishedAt);
  const sourcePeriod = sourcePeriodText(snapshot.visitorContext.period);

  return (
    <div className="discovery-app">
      <header className="app-header">
        <Link className="wordmark" href="/">동행로컬</Link>
        <div className="header-context"><strong>안동시</strong><span>안동시 방문자 기준 기간 {sourcePeriod}</span><span>발행일 {publishedAt}</span></div>
        <ProvenanceBadge snapshot={snapshot} />
      </header>

      <aside className="side-navigation" aria-label="주요 메뉴">
        <p className="eyebrow">관광 의사결정 도구</p>
        <nav>
          <Link aria-current="page" href="/">관광권역 탐색</Link>
          <Link href="/compare">후보 권역 비교</Link>
          <Link href="/evaluation">평가방법 실험실</Link>
          <Link href={`/regions/${selectedRegionId}`}>근거 상세</Link>
          <Link href="/actions">실행과제</Link>
          <Link href="/field">현장검증</Link>
          <Link href="/report">정책 검토안</Link>
        </nav>
        <div className="nav-note"><strong>데이터 기준</strong><span>{snapshot.visitorContext.scope} · {snapshot.visitorContext.source}</span></div>
      </aside>

      <main className="discovery-main">
        <section className="priority-banner" aria-labelledby="discovery-title">
          <div>
            <p className="eyebrow">안동 관광권역 탐색</p>
            <h1 id="discovery-title">흩어진 관광 데이터를 실행 우선순위로</h1>
            <p>안동의 관광권역을 비교하고, 체류·지역소비·접근성 병목을 근거와 함께 찾습니다.</p>
          </div>
          {selected && <div className="priority-reason"><span>현재 선택 권역</span><strong>{selectedName}</strong><p>{selected.reasons[0] ?? '권역별 근거 확인 후 검토 의견을 제시합니다.'}</p><Link href="/evaluation">분석 방법 보기</Link></div>}
        </section>

        <section className="map-workspace" aria-label="관광권역 탐색 작업 영역">
          <div className="filters" aria-label="관광 자원 필터">
            <label>자원 유형
              <select value={category} onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}>
                {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <span>{filteredPlaces.length}개 자원 표시</span>
            <span>자료 모드: {snapshot.mode === 'demo' ? '예시' : '라이브'}</span>
          </div>
          <MapCanvas snapshot={snapshot} places={filteredPlaces} selectedRegionId={selectedRegionId} onSelectRegion={setSelectedRegionId} />
        </section>

        {selected && <aside className="region-summary" aria-labelledby="region-summary-title">
          <div className="panel-heading"><div><p className="eyebrow">선택 권역</p><h2 id="region-summary-title">{selectedName}</h2></div><DataStatusBadge status={selected.evidenceStatus} /></div>
          <p className="summary-copy">{selected.summary}</p>
          <ScorePair potential={selected.potentialScore} example={snapshot.mode === 'demo'} />
          <p className="recommendation">{recommendationLabel(selected.recommendation)}</p>
          <h3>핵심 이유</h3>
          <ul>{selected.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <p className="data-date">안동시 방문자 기준 기간 {sourcePeriod}</p>
          <Link className="primary-link" href={`/regions/${selected.id}`}>상세 근거 보기</Link>
        </aside>}

        <section className="quick-compare" aria-labelledby="quick-compare-title">
          <div><p className="eyebrow">동일 기준 빠른 비교</p><h2 id="quick-compare-title">세 권역의 검토 상태</h2></div>
          <div className="quick-compare-grid">
            {snapshot.regions.map((region) => <button key={region.id} type="button" onClick={() => setSelectedRegionId(region.id)}><strong>{getRegionName(region.id)}</strong><span>관광권역 여건 점수 {scoreText(region.potentialScore)}{snapshot.mode === 'demo' && region.potentialScore !== null ? ' · 예시' : ''}</span><span>모형 검증 전</span></button>)}
          </div>
        </section>
      </main>
    </div>
  );
}

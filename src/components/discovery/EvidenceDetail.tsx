'use client';

import Link from 'next/link';
import React, { useRef, useState } from 'react';

import type { PublishedSnapshot, RegionId } from '../../lib/domain';

import { DataStatusBadge, ProvenanceBadge, ScorePair } from './StatusBadges';
import { METRICS, formatPublishedAt, getRegion, getRegionName, recommendationLabel } from './discovery-utils';

export function EvidenceDetail({ snapshot, regionId }: { snapshot: PublishedSnapshot; regionId: RegionId }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const region = getRegion(snapshot, regionId);

  if (!region) {
    return <main className="screen-page"><p>요청한 관광권역 정보를 찾을 수 없습니다.</p><Link href="/">탐색 화면으로 돌아가기</Link></main>;
  }

  const regionPlaces = snapshot.places.filter((place) => place.regionId === regionId);

  function closeDrawer() {
    setDrawerOpen(false);
    requestAnimationFrame(() => openButton.current?.focus());
  }

  return (
    <main className="screen-page evidence-page">
      <header className="screen-topline"><Link className="back-link" href="/compare">← 후보 권역 비교</Link><ProvenanceBadge snapshot={snapshot} /></header>
      <section className="evidence-hero">
        <div><p className="eyebrow">권역 근거 상세</p><h1>{getRegionName(region.id)}</h1><p>{region.summary}</p><p className="recommendation">{recommendationLabel(region.recommendation)}</p></div>
        <div className="mini-map" aria-label={`${getRegionName(region.id)} 지도 미니뷰`}><span>안동시</span><strong>{getRegionName(region.id)}</strong><p>권역 중심점과 반경은 탐색 편의용이며 법정 경계나 실제 방문권을 뜻하지 않습니다.</p></div>
      </section>

      <section className="evidence-summary"><div><p className="eyebrow">추천 결론</p><h2>{region.bottleneck}</h2><ul>{region.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div><ScorePair potential={region.potentialScore} confidence={region.confidenceScore} /></section>

      <section className="contribution-section" aria-labelledby="contribution-title"><div><p className="eyebrow">점수 구성요소</p><h2 id="contribution-title">왜 이 점수인가?</h2><p>아래 가중치는 공개된 초기 가설입니다. 예시 수치를 실제 정책 효과나 예측으로 해석하지 않습니다.</p></div><div className="contribution-bars">{METRICS.map(([metric, weight], index) => <div key={metric}><div><span>{metric}</span><strong>{weight}</strong></div><span aria-hidden="true" className="contribution-track"><span style={{ width: `${Math.max(20, (region.potentialScore ?? 0) - index * 7)}%` }} /></span><small>{region.potentialScore === null ? '산출 대기' : `검토용 예시 ${Math.max(0, region.potentialScore - index * 7)}점`}</small></div>)}</div></section>

      <section className="evidence-cards" aria-labelledby="evidence-title"><div className="section-heading"><div><p className="eyebrow">근거 카드</p><h2 id="evidence-title">원천 데이터와 공간 단위를 함께 확인합니다</h2></div><button ref={openButton} className="secondary-button" onClick={() => setDrawerOpen(true)} type="button">원자료 상세 열기</button></div><div className="evidence-card-grid"><article><DataStatusBadge status={region.evidenceStatus} /><h3>권역 검토 지표</h3><dl><div><dt>값과 단위</dt><dd>{region.potentialScore === null ? '산출 대기' : `${region.potentialScore}점 · 예시 데이터`}</dd></div><div><dt>기준 기간</dt><dd>{snapshot.visitorContext.period.start} ~ {snapshot.visitorContext.period.end}</dd></div><div><dt>공간 범위</dt><dd>{getRegionName(region.id)} 중심점·반경 기반 탐색</dd></div><div><dt>출처 API</dt><dd>{snapshot.mode === 'demo' ? '예시 데이터' : snapshot.visitorContext.source}</dd></div></dl></article><article><DataStatusBadge status={snapshot.visitorContext.evidenceStatus} /><h3>안동시 방문자 맥락</h3><dl><div><dt>값과 단위</dt><dd>{snapshot.visitorContext.visitorCount === null ? '정보 없음' : `${snapshot.visitorContext.visitorCount.toLocaleString()}명`}</dd></div><div><dt>기준 기간</dt><dd>{snapshot.visitorContext.period.start} ~ {snapshot.visitorContext.period.end}</dd></div><div><dt>공간 범위</dt><dd>{snapshot.visitorContext.scope} 시·군 단위</dd></div><div><dt>출처 API</dt><dd>{snapshot.visitorContext.source}</dd></div></dl><p>{snapshot.visitorContext.note}</p></article></div></section>

      <section className="limitation-notice"><p className="eyebrow">해석 한계</p><h2>이 결과로 할 수 없는 판단</h2><ul>{snapshot.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul><p>현장 운영, 이동, 접근성은 아래 POI 목록과 별도로 현장확인이 필요합니다.</p></section>

      <section className="places-section"><h2>확인된 관광 자원 목록</h2>{regionPlaces.length === 0 ? <p>이 권역에서 확인된 POI가 아직 없습니다.</p> : <ul>{regionPlaces.map((place) => <li key={place.id}><strong>{place.name}</strong><span>{place.category} · {place.address ?? '주소 정보 없음'}</span><DataStatusBadge status={place.evidenceStatus} /></li>)}</ul>}</section>
      <Link className="primary-link" href="/actions">실행과제 보기</Link>

      {drawerOpen && <div aria-modal="true" className="evidence-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }} role="dialog"><aside className="evidence-drawer" aria-labelledby="drawer-title"><div className="drawer-header"><div><p className="eyebrow">원자료 상세</p><h2 id="drawer-title">표시된 근거의 범위</h2></div><button autoFocus onClick={closeDrawer} type="button">닫기</button></div><dl><div><dt>스냅샷 발행</dt><dd>{formatPublishedAt(snapshot.publishedAt)}</dd></div><div><dt>상태</dt><dd>{snapshot.status.message}</dd></div><div><dt>영향 데이터</dt><dd>{snapshot.status.affectedData.length ? snapshot.status.affectedData.join(', ') : '없음'}</dd></div><div><dt>자원 수</dt><dd>{regionPlaces.length}건</dd></div></dl><p>이 드로어는 닫으면 원자료 상세 열기 버튼으로 키보드 포커스를 돌려줍니다.</p></aside></div>}
    </main>
  );
}

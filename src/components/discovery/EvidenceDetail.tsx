'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';

import type { PublishedSnapshot, RegionId } from '../../lib/domain';
import { getEvaluationBundle } from '../../lib/evaluation/catalog';
import { EvaluationTrace } from '../evaluation/EvaluationTrace';

import { DataStatusBadge, ProvenanceBadge, ScorePair } from './StatusBadges';
import { METRICS, formatPublishedAt, getRegion, getRegionName, recommendationLabel, sourcePeriodText } from './discovery-utils';

export function EvidenceDetail({ snapshot, regionId }: { snapshot: PublishedSnapshot; regionId: RegionId }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const region = getRegion(snapshot, regionId);

  useEffect(() => {
    if (!drawerOpen) return;
    const returnFocus = openButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocus?.focus();
    };
  }, [drawerOpen]);

  if (!region) {
    return <main className="screen-page"><p>요청한 관광권역 정보를 찾을 수 없습니다.</p><Link href="/">탐색 화면으로 돌아가기</Link></main>;
  }

  const regionPlaces = snapshot.places.filter((place) => place.regionId === regionId);
  const example = snapshot.mode === 'demo';
  const evaluation = getEvaluationBundle(snapshot, regionId);

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function handleDrawerKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <main className="screen-page evidence-page">
      <div inert={drawerOpen || undefined}>
        <header className="screen-topline"><Link className="back-link" href="/compare">← 후보 권역 비교</Link><ProvenanceBadge snapshot={snapshot} /></header>
        <section className="evidence-hero">
          <div><p className="eyebrow">권역 근거 상세</p><h1>{getRegionName(region.id)}</h1><p>{region.summary}</p><p className="recommendation">{recommendationLabel(region.recommendation)}</p></div>
          <div className="mini-map" aria-label={`${getRegionName(region.id)} 탐색 범위 안내`}><span>안동시</span><strong>{getRegionName(region.id)}</strong><p>권역 중심점과 반경은 탐색 편의용이며 법정 경계나 실제 방문권을 뜻하지 않습니다.</p></div>
        </section>

        <section className="evidence-summary">
          <div><p className="eyebrow">검토 의견</p><h2>{region.bottleneck}</h2><ul>{region.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
          <ScorePair potential={evaluation?.result.totalScore ?? null} example={example} />
        </section>

        {evaluation ? <EvaluationTrace bundle={evaluation} /> : <section className="contribution-section" aria-labelledby="contribution-title">
          <div><p className="eyebrow">지표 후보와 근거</p><h2 id="contribution-title">지표 근거 상태</h2><p>영역 구성과 가중치는 검토·검증 전입니다. 독립된 지표 근거가 없어 점수와 총점 기여분은 산출하지 않습니다.</p></div>
          <div className="indicator-status-list">
            {METRICS.map(([metric, weight]) => <div key={metric}><div><span>{metric}</span><strong>가중치 {weight}</strong></div><small>지표 근거 미등록 · 산출 대기</small></div>)}
          </div>
          <p className="method-note"><a href="https://onlinelibrary.wiley.com/doi/10.1002/jtr.804">Park &amp; Yoon (2011)</a>은 지표 선정과 가중치 검토 절차, <a href="https://link.springer.com/article/10.1007/s11205-017-1832-9">Greco et al. (2019)</a>는 종합지수의 가중·집계·강건성 검토를 위한 방법론 근거입니다. 이 문헌이 동행로컬의 지표나 기존 30·25·20·15·10% 가중치를 검증한 것은 아닙니다.</p>
        </section>}
        <p><Link className="secondary-link" href="/evaluation">평가방법 실험실 열기</Link></p>

        <section className="evidence-cards" aria-labelledby="evidence-title">
          <div className="section-heading"><div><p className="eyebrow">근거 카드</p><h2 id="evidence-title">원천 데이터와 공간 단위를 함께 확인합니다</h2></div><button ref={openButton} className="secondary-button" onClick={() => setDrawerOpen(true)} type="button">원자료 상세 열기</button></div>
          <div className="evidence-card-grid">
            <article>
              <DataStatusBadge status={region.evidenceStatus} /><h3>권역 검토 지표</h3>
              <dl>
                <div><dt>값과 단위</dt><dd>{evaluation?.result.totalScore != null ? `${evaluation.result.totalScore}점 · 합성 자료로 계산한 시연 결과` : '지표 근거 미등록 또는 결측 · 산출 대기'}</dd></div>
                <div><dt>기준 기간</dt><dd>{evaluation ? `${evaluation.input.period.start} ~ ${evaluation.input.period.end} · 가상 조사기간` : '권역 지표 기준 기간 미등록'}</dd></div>
                <div><dt>공간 범위</dt><dd>{getRegionName(region.id)} 중심점·반경 기반 탐색</dd></div>
                <div><dt>출처 API</dt><dd>{evaluation ? '합성 자료 · 실제 API 응답 아님 · 위 계산 추적표 참조' : '권역 지표 원자료 미등록'}</dd></div>
              </dl>
            </article>
            <article>
              <DataStatusBadge status={snapshot.visitorContext.evidenceStatus} /><h3>안동시 방문자 맥락</h3>
              <dl>
                <div><dt>값과 단위</dt><dd>{snapshot.visitorContext.visitorCount === null ? '정보 없음' : `${snapshot.visitorContext.visitorCount.toLocaleString()}명`}</dd></div>
                <div><dt>기준 기간</dt><dd>{sourcePeriodText(snapshot.visitorContext.period)}</dd></div>
                <div><dt>공간 범위</dt><dd>{snapshot.visitorContext.scope} 시·군 단위</dd></div>
                <div><dt>출처 API</dt><dd>{snapshot.visitorContext.source}</dd></div>
              </dl><p>{snapshot.visitorContext.note}</p>
            </article>
          </div>
        </section>

        <section className="limitation-notice">
          <p className="eyebrow">해석 한계</p><h2>이 결과로 할 수 없는 판단</h2>
          <ul>{snapshot.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
          <p>여건 점수는 성장확률이나 사업 투자효과가 아닙니다. 관광자원 수만으로 실제 체류·소비를 추정하지 않습니다. 자료 확보와 현장 확인 상태는 통계적 신뢰도나 모형 정확도가 아닙니다.</p>
          <p>현장 운영, 이동, 접근성은 아래 자원 목록과 별도로 현장확인이 필요합니다. 정보 없음은 0점이나 접근 불가능을 뜻하지 않습니다.</p>
        </section>

        <section className="places-section"><h2>등록된 관광 자원 목록</h2>{regionPlaces.length === 0 ? <p>이 권역에 등록된 자원 정보가 아직 없습니다. 실제 자원이 없다는 뜻은 아닙니다.</p> : <ul>{regionPlaces.map((place) => <li key={place.id}><strong>{place.name}</strong><span>{place.category} · {place.address ?? '주소 정보 없음'}</span><DataStatusBadge status={place.evidenceStatus} /></li>)}</ul>}</section>
        <Link className="primary-link" href="/actions">실행과제 보기</Link>
      </div>

      {drawerOpen && (
        <div aria-modal="true" aria-labelledby="drawer-title" className="evidence-drawer-backdrop" onKeyDown={handleDrawerKeyDown} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }} role="dialog">
          <aside className="evidence-drawer">
            <div className="drawer-header"><div><p className="eyebrow">원자료 상세</p><h2 id="drawer-title">표시된 근거의 범위</h2></div><button ref={closeButton} onClick={closeDrawer} type="button">닫기</button></div>
            <dl>
              <div><dt>스냅샷 발행</dt><dd>{formatPublishedAt(snapshot.publishedAt)}</dd></div>
              <div><dt>안동시 방문자 기준 기간</dt><dd>{sourcePeriodText(snapshot.visitorContext.period)}</dd></div>
              <div><dt>상태</dt><dd>{snapshot.status.message}</dd></div>
              <div><dt>영향 데이터</dt><dd>{snapshot.status.affectedData.length ? snapshot.status.affectedData.join(', ') : '없음'}</dd></div>
              <div><dt>등록 자원 수</dt><dd>{regionPlaces.length}건</dd></div>
            </dl>
            <p>{evaluation ? `권역 점수는 ${evaluation.result.modelVersion} 모형과 ${evaluation.result.dataVersion} 합성 자료로 계산했습니다. 실제 관측자료가 아닙니다.` : '권역 지표의 원자료와 계산 근거는 아직 등록되지 않았습니다.'} 위 방문자 기간과 출처는 안동시 전체 맥락 자료에만 해당합니다.</p>
          </aside>
        </div>
      )}
    </main>
  );
}

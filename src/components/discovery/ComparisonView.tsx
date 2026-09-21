import Link from 'next/link';
import React from 'react';

import type { PublishedSnapshot } from '../../lib/domain';
import { getEvaluationBundle } from '../../lib/evaluation/catalog';
import { evaluationGateLabel, formatEvaluationNumber } from '../evaluation/EvaluationTrace';

import { DataStatusBadge, ProvenanceBadge, ScorePair } from './StatusBadges';
import { METRICS, getRegionName, recommendationLabel, scoreText } from './discovery-utils';

export function ComparisonView({ snapshot }: { snapshot: PublishedSnapshot }) {
  const priority = snapshot.mode === 'live' ? snapshot.regions.find((region) => region.recommendation === 'business-planning') : null;
  const evaluations = snapshot.regions.map((region) => getEvaluationBundle(snapshot, region.id));
  const comparisonModel = evaluations.find((bundle) => bundle !== null)?.model;

  return (
    <main className="screen-page comparison-page">
      <header className="screen-topline">
        <Link className="back-link" href="/">← 관광권역 탐색</Link>
        <ProvenanceBadge snapshot={snapshot} />
      </header>
      <section className="comparison-intro">
        <div><p className="eyebrow">후보 권역 비교</p><h1>같은 기준에서 권역을 비교합니다</h1><p>관광자원 분포와 권역별 자료를 한 화면에서 확인하고 다음 실행 대상을 선택합니다.</p></div>
        {priority ? <aside className="conclusion-card"><span>우선 검토 권역</span><strong>{getRegionName(priority.id)}</strong><p>{priority.reasons[0]}</p><DataStatusBadge status={priority.evidenceStatus} /></aside> : <aside className="conclusion-card"><strong>{snapshot.mode === 'demo' ? '공공데이터로 권역을 탐색하세요' : '권역을 선택해 확인하세요'}</strong><p>{snapshot.mode === 'demo' ? <Link className="primary-link" href="/data">한국관광공사 공공데이터 탐색하기</Link> : '권역별 근거를 확인하면 다음 실행 대상을 정할 수 있습니다.'}</p></aside>}
      </section>

      <section className="comparison-grid" aria-label="관광권역 비교">
        {snapshot.regions.map((region, index) => (
          <article className="comparison-card" key={region.id}>
            <div className="card-title"><div><p className="eyebrow">관광권역</p><h2>{getRegionName(region.id)}</h2></div><DataStatusBadge status={region.evidenceStatus} /></div>
            {snapshot.mode === 'live' && <p className="recommendation">{recommendationLabel(region.recommendation)}</p>}
            {snapshot.mode === 'live' && <><ScorePair potential={evaluations[index]?.result.totalScore ?? null} />{evaluations[index] && <p>{evaluationGateLabel(evaluations[index].result.gateStatus)}</p>}</>}
            <dl className="comparison-facts"><div><dt>주요 강점</dt><dd>{region.reasons[0] ?? '연결 데이터'}</dd></div><div><dt>가장 큰 병목</dt><dd>{region.bottleneck}</dd></div><div><dt>추가 데이터</dt><dd>{region.missingDataCount === null ? '연결 데이터' : `${region.missingDataCount}건`}</dd></div></dl>
            <Link className="secondary-link" href={`/regions/${region.id}`}>이 권역 상세 분석</Link>
          </article>
        ))}
      </section>

      {snapshot.mode === 'live' ? <section className="metric-section" aria-labelledby="metric-title">
        <div><p className="eyebrow">비교 지표와 근거</p><h2 id="metric-title">{comparisonModel ? '동일 기준으로 계산한 영역별 지표' : '지표별 근거 등록 상태'}</h2></div>
        <div className="metric-table-wrap"><table><caption>{comparisonModel ? '영역별 계산 결과' : '지표별 근거 등록 상태'}</caption><thead><tr><th scope="col">평가 영역</th><th scope="col">영역 가중치</th>{snapshot.regions.map((region) => <th key={region.id} scope="col">{getRegionName(region.id)}</th>)}</tr></thead><tbody>{comparisonModel ? comparisonModel.domains.map((domain) => <tr key={domain.id}><th scope="row">{domain.label}</th><td>{(domain.weight * 100).toFixed(1)}%</td>{snapshot.regions.map((region, index) => {
          const bundle = evaluations[index];
          const comparable = bundle?.model.version === comparisonModel.version;
          const result = comparable ? bundle.result.domains.find((item) => item.id === domain.id) : null;
          return <td key={region.id}>{result ? formatEvaluationNumber(result.score, '점') : '지표 근거 미등록'}</td>;
        })}</tr>) : METRICS.map(([metric, weight]) => <tr key={metric}><th scope="row">{metric}</th><td>{weight}</td>{snapshot.regions.map((region) => <td key={region.id}>지표 근거 미등록</td>)}</tr>)}</tbody></table></div>
        <p className="table-note">각 지표의 출처·기준 기간·공간 범위는 권역 근거 상세에서 확인할 수 있습니다.</p>
        <Link className="secondary-link" href="/evaluation">평가방법 실험실 열기</Link>
      </section> : <section className="metric-section" aria-labelledby="metric-title"><div><p className="eyebrow">공공데이터 탐색</p><h2 id="metric-title">권역 분석을 위한 원자료 확인</h2><p>한국관광공사 관광자원과 방문자 통계를 확인하고 현장 실행 과제로 연결하세요.</p></div><Link className="primary-link" href="/data">실제 공공데이터 탐색하기</Link></section>}

        <section className="comparison-summary"><h2>권역별 다음 실행</h2><p>선택한 권역의 근거 상세에서 원자료와 현장 실행 과제를 이어서 확인하세요.</p><span className="visually-hidden">{scoreText(null)}은 자료 확인 중 상태입니다.</span></section>
    </main>
  );
}

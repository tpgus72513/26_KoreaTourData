import Link from 'next/link';
import React from 'react';

import type { PublishedSnapshot } from '../../lib/domain';
import { getEvaluationBundle } from '../../lib/evaluation/catalog';
import { evaluationGateLabel, formatEvaluationNumber } from '../evaluation/EvaluationTrace';

import { DataStatusBadge, ProvenanceBadge, ScorePair } from './StatusBadges';
import { METRICS, getRegionName, recommendationLabel, scoreText } from './discovery-utils';

export function ComparisonView({ snapshot }: { snapshot: PublishedSnapshot }) {
  const priority = snapshot.regions.find((region) => region.recommendation === 'business-planning');
  const evaluations = snapshot.regions.map((region) => getEvaluationBundle(snapshot, region.id));
  const comparisonModel = evaluations.find((bundle) => bundle !== null)?.model;

  return (
    <main className="screen-page comparison-page">
      <header className="screen-topline">
        <Link className="back-link" href="/">← 관광권역 탐색</Link>
        <ProvenanceBadge snapshot={snapshot} />
      </header>
      <section className="comparison-intro">
        <div><p className="eyebrow">후보 권역 비교</p><h1>같은 기준에서, 먼저 검토할 권역을 고릅니다</h1><p>관광권역 여건과 자료의 확인 상태를 구분합니다. 여건 점수는 성장확률이나 투자효과가 아니며, 평가모형은 검증 전입니다.</p></div>
        {priority ? <aside className="conclusion-card"><span>{snapshot.mode === 'demo' ? '시연 기준 우선 검토 권역' : '현재 우선 검토 권역'}</span><strong>{getRegionName(priority.id)}</strong><p>{priority.reasons[0]}</p><DataStatusBadge status={priority.evidenceStatus} /></aside> : <aside className="conclusion-card"><strong>우선순위 산출 대기</strong><p>권역별 근거와 검토 의견이 등록되기 전에는 우선 권역을 정하지 않습니다.</p></aside>}
      </section>

      <section className="comparison-grid" aria-label="관광권역 비교">
        {snapshot.regions.map((region, index) => (
          <article className="comparison-card" key={region.id}>
            <div className="card-title"><div><p className="eyebrow">관광권역</p><h2>{getRegionName(region.id)}</h2></div><DataStatusBadge status={region.evidenceStatus} /></div>
            <p className="recommendation">{recommendationLabel(region.recommendation)}</p>
            <ScorePair potential={evaluations[index]?.result.totalScore ?? null} example={snapshot.mode === 'demo'} />
            {evaluations[index] && <p>{evaluationGateLabel(evaluations[index].result.gateStatus)}</p>}
            <dl className="comparison-facts"><div><dt>주요 강점</dt><dd>{region.reasons[0] ?? '근거 확인 전'}</dd></div><div><dt>가장 큰 병목</dt><dd>{region.bottleneck}</dd></div><div><dt>미확인 데이터</dt><dd>{region.missingDataCount === null ? '미집계' : `${region.missingDataCount}건`}</dd></div></dl>
            <Link className="secondary-link" href={`/regions/${region.id}`}>이 권역 상세 분석</Link>
          </article>
        ))}
      </section>

      <section className="metric-section" aria-labelledby="metric-title">
        <div><p className="eyebrow">비교 지표와 근거</p><h2 id="metric-title">{comparisonModel ? '동일 모형으로 계산한 영역별 여건' : '지표·가중치는 검토와 실증 검증 전입니다'}</h2></div>
        <div className="metric-table-wrap"><table><caption>{comparisonModel ? '합성 자료의 영역별 계산 결과 · 정책 판단 금지' : '지표별 근거 등록 상태'}</caption><thead><tr><th scope="col">평가 영역</th><th scope="col">영역 가중치</th>{snapshot.regions.map((region) => <th key={region.id} scope="col">{getRegionName(region.id)}</th>)}</tr></thead><tbody>{comparisonModel ? comparisonModel.domains.map((domain) => <tr key={domain.id}><th scope="row">{domain.label}</th><td>{(domain.weight * 100).toFixed(1)}% · 시연 기준</td>{snapshot.regions.map((region, index) => {
          const bundle = evaluations[index];
          const comparable = bundle?.model.version === comparisonModel.version;
          const result = comparable ? bundle.result.domains.find((item) => item.id === domain.id) : null;
          return <td key={region.id}>{result ? formatEvaluationNumber(result.score, '점') : '지표 근거 미등록'}</td>;
        })}</tr>) : METRICS.map(([metric, weight]) => <tr key={metric}><th scope="row">{metric}</th><td>{weight}</td>{snapshot.regions.map((region) => <td key={region.id}>지표 근거 미등록</td>)}</tr>)}</tbody></table></div>
        <p className="table-note">독립된 지표값·출처·기준 기간·공간 범위가 등록되기 전에는 지표 점수와 총점 기여분을 산출하지 않습니다. 관광자원 수만으로 실제 체류·소비나 이용 가능성을 판단하지 않습니다.</p>
        {comparisonModel && <p className="table-note">현재 표는 합성 지표값으로 계산한 시연 결과입니다. 가중치와 정규화 기준은 실증 검증 전이며, 결측으로 총점이 없는 권역까지 포함한 순위를 만들지 않습니다.</p>}
        <Link className="secondary-link" href="/evaluation">평가방법 실험실 열기</Link>
      </section>

      <section className="comparison-summary"><h2>검토 전 확인할 데이터 한계</h2><ul>{snapshot.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul><span className="visually-hidden">{scoreText(null)}은 정보 없음과 0을 구분하는 상태입니다.</span></section>
    </main>
  );
}

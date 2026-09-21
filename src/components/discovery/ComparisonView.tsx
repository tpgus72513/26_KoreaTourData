import Link from 'next/link';
import React from 'react';

import type { PublishedSnapshot } from '../../lib/domain';

import { DataStatusBadge, ProvenanceBadge, ScorePair } from './StatusBadges';
import { METRICS, getRegionName, recommendationLabel, scoreText } from './discovery-utils';

export function ComparisonView({ snapshot }: { snapshot: PublishedSnapshot }) {
  const priority = snapshot.regions.find((region) => region.recommendation === 'business-planning') ?? snapshot.regions[0];

  return (
    <main className="screen-page comparison-page">
      <header className="screen-topline">
        <Link className="back-link" href="/">← 관광권역 탐색</Link>
        <ProvenanceBadge snapshot={snapshot} />
      </header>
      <section className="comparison-intro">
        <div><p className="eyebrow">후보 권역 비교</p><h1>같은 기준에서, 먼저 검토할 권역을 고릅니다</h1><p>점수는 잠재력과 데이터 신뢰도를 분리해 보여줍니다. 신뢰도가 낮은 경우 즉시 투자 판단이 아니라 현장확인 대상으로 다룹니다.</p></div>
        {priority && <aside className="conclusion-card"><span>현재 우선 검토 권역</span><strong>{getRegionName(priority.id)}</strong><p>{priority.reasons[0]}</p><DataStatusBadge status={priority.evidenceStatus} /></aside>}
      </section>

      <section className="comparison-grid" aria-label="관광권역 비교">
        {snapshot.regions.map((region) => (
          <article className="comparison-card" key={region.id}>
            <div className="card-title"><div><p className="eyebrow">관광권역</p><h2>{getRegionName(region.id)}</h2></div><DataStatusBadge status={region.evidenceStatus} /></div>
            <p className="recommendation">{recommendationLabel(region.recommendation)}</p>
            <ScorePair potential={region.potentialScore} confidence={region.confidenceScore} />
            <dl className="comparison-facts"><div><dt>주요 강점</dt><dd>{region.reasons[0]}</dd></div><div><dt>가장 큰 병목</dt><dd>{region.bottleneck}</dd></div><div><dt>미확인 데이터</dt><dd>{region.missingDataCount}건</dd></div></dl>
            <Link className="secondary-link" href={`/regions/${region.id}`}>이 권역 상세 분석</Link>
          </article>
        ))}
      </section>

      <section className="metric-section" aria-labelledby="metric-title">
        <div><p className="eyebrow">비교 지표</p><h2 id="metric-title">가중치는 초기 가설이며, 실제 데이터 검증 후 변경됩니다</h2></div>
        <div className="metric-table-wrap"><table><caption>지표별 비교용 텍스트 대안</caption><thead><tr><th scope="col">지표</th><th scope="col">가중치</th>{snapshot.regions.map((region) => <th key={region.id} scope="col">{getRegionName(region.id)}</th>)}</tr></thead><tbody>{METRICS.map(([metric, weight], index) => <tr key={metric}><th scope="row">{metric}</th><td>{weight}</td>{snapshot.regions.map((region) => <td key={region.id}>{region.potentialScore === null ? '산출 대기' : `${Math.max(0, region.potentialScore - index * 4)}점 · 예시`}</td>)}</tr>)}</tbody></table></div>
        <p className="table-note">표의 개별 지표 값은 시연용 표기입니다. 권역별 실측 방문·소비·접근성 점수는 독립 입력이 확보되기 전까지 산출하지 않습니다.</p>
      </section>

      <section className="comparison-summary"><h2>검토 전 확인할 데이터 한계</h2><ul>{snapshot.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul><span className="visually-hidden">{scoreText(null)}은 정보 없음과 0을 구분하는 상태입니다.</span></section>
    </main>
  );
}

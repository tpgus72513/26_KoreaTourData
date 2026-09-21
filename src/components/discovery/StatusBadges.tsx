import React from 'react';
import type { EvidenceStatus, PublishedSnapshot } from '../../lib/domain';

import { evidenceStatusLabel, isDemo, scoreText } from './discovery-utils';

export function ProvenanceBadge({ snapshot }: { snapshot: PublishedSnapshot }) {
  if (isDemo(snapshot)) {
    return <span className="status-chip status-chip-demo">관광 데이터 탐색 자료</span>;
  }

  return <span className={`status-chip status-chip-${snapshot.status.type}`}>{snapshot.status.message}</span>;
}

export function DataStatusBadge({ status }: { status: EvidenceStatus }) {
  return <span className={`data-status data-status-${status}`}>{evidenceStatusLabel[status]}</span>;
}

export function ScorePair({ potential }: { potential: number | null }) {
  return (
    <dl className="score-pair">
      <div>
        <dt>관광권역 여건 점수</dt>
        <dd>{scoreText(potential)}</dd>
      </div>
      <div>
        <dt>분석 상태</dt>
        <dd>자료 확인 중</dd>
      </div>
    </dl>
  );
}

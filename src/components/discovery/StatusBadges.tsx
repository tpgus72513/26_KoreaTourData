import React from 'react';
import type { EvidenceStatus, PublishedSnapshot } from '../../lib/domain';

import { evidenceStatusLabel, isDemo, scoreText } from './discovery-utils';

export function ProvenanceBadge({ snapshot }: { snapshot: PublishedSnapshot }) {
  if (isDemo(snapshot)) {
    return <span className="status-chip status-chip-demo">{snapshot.disclaimer}</span>;
  }

  return <span className={`status-chip status-chip-${snapshot.status.type}`}>{snapshot.status.message}</span>;
}

export function DataStatusBadge({ status }: { status: EvidenceStatus }) {
  return <span className={`data-status data-status-${status}`}>{evidenceStatusLabel[status]}</span>;
}

export function ScorePair({ potential, example }: { potential: number | null; example: boolean }) {
  return (
    <dl className="score-pair">
      <div>
        <dt>관광권역 여건 점수</dt>
        <dd>{scoreText(potential)}{example && potential !== null ? ' · 시연' : ''}</dd>
      </div>
      <div>
        <dt>모형 검증</dt>
        <dd>검증 전</dd>
      </div>
    </dl>
  );
}

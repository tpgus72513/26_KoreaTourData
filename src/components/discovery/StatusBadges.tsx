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

export function ScorePair({ potential, confidence }: { potential: number | null; confidence: number | null }) {
  return (
    <dl className="score-pair">
      <div>
        <dt>잠재력 점수</dt>
        <dd>{scoreText(potential)}</dd>
      </div>
      <div>
        <dt>데이터 신뢰도</dt>
        <dd>{scoreText(confidence)}</dd>
      </div>
    </dl>
  );
}

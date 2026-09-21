import '../../styles/workflow.css';
import React from 'react';
import { headers } from 'next/headers';

import { ReportWorkflowClient } from '../../components/workflow/ReportWorkflowClient';
import { displayAnalysisDate, displayVisitorPeriod, WorkflowShell } from '../../components/workflow/WorkflowShell';
import { demoTasks } from '../../lib/demo';
import { REGIONS } from '../../lib/domain';
import { getEvaluationBundle } from '../../lib/evaluation/catalog';
import { loadSnapshot } from '../../lib/snapshot';
import { listPersistedTasksForAdmin } from '../../lib/tasks';

export const dynamic = 'force-dynamic';

export default async function ReportPage() {
  const snapshot = await loadSnapshot();
  const liveTaskRead = snapshot.mode === 'live'
    ? await listPersistedTasksForAdmin((await headers()).get('cookie'))
    : null;
  const tasks = snapshot.mode === 'demo' ? demoTasks : liveTaskRead?.tasks ?? [];
  const loginRequired = snapshot.mode === 'live' && !liveTaskRead?.authorized;
  const taskReadFailed = liveTaskRead?.failed ?? false;
  const priority = snapshot.regions.find((region) => region.recommendation === 'business-planning');

  return (
    <WorkflowShell analyzedAt={displayAnalysisDate(snapshot.publishedAt)} visitorPeriod={snapshot.visitorContext.period}>
      <main className="workflow-page">
        {loginRequired ? (
          <p className="workflow-notice" role="status">관리자 로그인 후 저장된 현장검증 과제를 볼 수 있습니다.</p>
        ) : (
          <>
            <ReportWorkflowClient
              initialTasks={tasks}
              mode={snapshot.mode}
              report={{
                evaluations: snapshot.regions.flatMap((region) => {
                  const evaluation = getEvaluationBundle(snapshot, region.id);
                  return evaluation ? [evaluation] : [];
                }),
                analyzedAt: displayAnalysisDate(snapshot.publishedAt),
                visitorPeriod: displayVisitorPeriod(snapshot.visitorContext.period),
                snapshotStatus: snapshot.status,
                taskReadFailed,
                mode: snapshot.mode,
                sources: [snapshot.visitorContext.source, ...snapshot.places.map((place) => place.source)],
                limitations: snapshot.limitations,
                priorityRegion: priority ? REGIONS.find((region) => region.id === priority.id)?.name ?? '권역 분석' : '권역 분석',
                potentialScore: priority?.potentialScore ?? null,
                confidenceScore: priority?.confidenceScore ?? null,
                reasons: priority?.reasons ?? ['독립적인 권역 단위 입력이 필요합니다.'],
              }}
            />
            {taskReadFailed ? <p className="workflow-notice" role="alert">저장된 현장검증 과제를 불러오지 못했습니다. 데이터베이스 상태를 확인하세요.</p> : null}
          </>
        )}
      </main>
    </WorkflowShell>
  );
}

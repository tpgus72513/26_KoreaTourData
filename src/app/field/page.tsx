import '../../styles/workflow.css';
import React from 'react';
import { headers } from 'next/headers';

import { FieldWorkflowClient } from '../../components/workflow/FieldWorkflowClient';
import { displayAnalysisDate, WorkflowShell } from '../../components/workflow/WorkflowShell';
import { demoTasks } from '../../lib/demo';
import { loadSnapshot } from '../../lib/snapshot';
import { listPersistedTasksForAdmin } from '../../lib/tasks';

export const dynamic = 'force-dynamic';

export default async function FieldPage({ searchParams }: { searchParams?: Promise<{ task?: string | string[] }> }) {
  const snapshot = await loadSnapshot();
  const liveTaskRead = snapshot.mode === 'live'
    ? await listPersistedTasksForAdmin((await headers()).get('cookie'))
    : null;
  const tasks = snapshot.mode === 'demo' ? demoTasks : liveTaskRead?.tasks ?? [];
  const loginRequired = snapshot.mode === 'live' && !liveTaskRead?.authorized;
  const taskReadFailed = liveTaskRead?.failed ?? false;
  const selected = (await searchParams)?.task;
  const selectedTaskId = typeof selected === 'string' ? selected : undefined;

  return (
    <WorkflowShell analyzedAt={displayAnalysisDate(snapshot.publishedAt)} visitorPeriod={snapshot.visitorContext.period}>
      <main className="workflow-page">
        {loginRequired ? (
          <p className="workflow-notice" role="status">관리자 로그인 후 저장된 현장검증 과제를 볼 수 있습니다.</p>
        ) : (
          <>
            {!taskReadFailed ? <FieldWorkflowClient initialTasks={tasks} mode={snapshot.mode} selectedTaskId={selectedTaskId} /> : null}
            {taskReadFailed ? <p className="workflow-notice" role="alert">저장된 현장검증 과제를 불러오지 못했습니다. 데이터베이스 상태를 확인하세요.</p> : null}
          </>
        )}
      </main>
    </WorkflowShell>
  );
}

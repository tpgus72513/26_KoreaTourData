import '../../styles/workflow.css';
import { headers } from 'next/headers';

import { FieldWorkflowClient } from '../../components/workflow/FieldWorkflowClient';
import { displayAnalysisDate, WorkflowShell } from '../../components/workflow/WorkflowShell';
import { demoTasks } from '../../lib/demo';
import { loadSnapshot } from '../../lib/snapshot';
import { listPersistedTasksForAdmin } from '../../lib/tasks';

export const dynamic = 'force-dynamic';

export default async function FieldPage() {
  const snapshot = await loadSnapshot();
  const liveTaskRead = snapshot.mode === 'live'
    ? await listPersistedTasksForAdmin((await headers()).get('cookie'))
    : null;
  const tasks = snapshot.mode === 'demo' ? demoTasks : liveTaskRead?.tasks ?? [];
  const loginRequired = snapshot.mode === 'live' && !liveTaskRead?.authorized;
  const taskReadFailed = liveTaskRead?.failed ?? false;

  return (
    <WorkflowShell analyzedAt={displayAnalysisDate(snapshot.publishedAt)}>
      <main className="workflow-page">
        {loginRequired ? (
          <p className="workflow-notice" role="status">관리자 로그인 후 저장된 현장검증 과제를 볼 수 있습니다.</p>
        ) : (
          <>
            <FieldWorkflowClient initialTasks={tasks} mode={snapshot.mode} />
            {taskReadFailed ? <p className="workflow-notice" role="alert">저장된 현장검증 과제를 불러오지 못했습니다. 데이터베이스 상태를 확인하세요.</p> : null}
          </>
        )}
      </main>
    </WorkflowShell>
  );
}

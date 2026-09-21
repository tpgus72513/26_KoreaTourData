import '../../styles/workflow.css';
import { headers } from 'next/headers';

import { ActionTaskCard } from '../../components/workflow/WorkflowViews';
import { displayAnalysisDate, WorkflowShell } from '../../components/workflow/WorkflowShell';
import { demoTasks } from '../../lib/demo';
import { loadSnapshot } from '../../lib/snapshot';
import { listPersistedTasksForAdmin } from '../../lib/tasks';

export const dynamic = 'force-dynamic';

export default async function ActionsPage() {
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
      <header className="workflow-heading">
        <div>
          <p className="workflow-eyebrow">우선 실행과제</p>
          <h1>분석 결과를 현장검증과 실행으로 연결합니다</h1>
          <p>추천은 확정이 아니며, 각 과제의 근거와 현장 확인 항목을 함께 검토합니다.</p>
        </div>
        {snapshot.mode === 'demo' ? <p className="workflow-notice">{snapshot.disclaimer}</p> : null}
      </header>
      {loginRequired ? (
        <p className="workflow-notice" role="status">관리자 로그인 후 저장된 현장검증 과제를 볼 수 있습니다.</p>
      ) : (
        <>
          <section className="field-task-grid" aria-label="추천 실행과제">
            {tasks.map((task) => <ActionTaskCard key={task.id} task={task} />)}
          </section>
          {taskReadFailed ? <p className="workflow-notice" role="alert">저장된 현장검증 과제를 불러오지 못했습니다. 데이터베이스 상태를 확인하세요.</p> : null}
          {tasks.length === 0 && !taskReadFailed ? <p className="workflow-notice">등록된 현장검증 과제가 없습니다.</p> : null}
        </>
      )}
    </main>
    </WorkflowShell>
  );
}

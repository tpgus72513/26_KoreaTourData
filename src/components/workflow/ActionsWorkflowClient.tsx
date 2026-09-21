'use client';

import React from 'react';

import type { SnapshotMode, ValidationTask } from '../../lib/domain';
import { useWorkflowTasks } from './useWorkflowTasks';
import { ActionTaskCard } from './WorkflowViews';

export function ActionsWorkflowClient({ initialTasks, mode }: { initialTasks: ValidationTask[]; mode: SnapshotMode }) {
  const [tasks] = useWorkflowTasks(initialTasks, mode);
  return <>
    <section className="field-task-grid" aria-label="추천 실행과제">
      {tasks.map((task) => <ActionTaskCard key={task.id} task={task} />)}
    </section>
    {tasks.length === 0 ? <p className="workflow-notice">등록된 현장검증 과제가 없습니다.</p> : null}
    <a className="workflow-link" href="/field#new-field-task-heading">새 현장검증 과제 만들기</a>
  </>;
}

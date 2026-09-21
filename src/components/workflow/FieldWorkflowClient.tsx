'use client';

import { useEffect, useState } from 'react';

import type { SnapshotMode, ValidationTask } from '../../lib/domain';
import { FieldValidationBoard } from './WorkflowViews';

type FieldWorkflowClientProps = {
  initialTasks: ValidationTask[];
  mode: SnapshotMode;
};

const DEMO_TASKS_STORAGE_KEY = 'andong-demo-validation-tasks';

function readDemoTasks(fallback: ValidationTask[]): ValidationTask[] {
  try {
    const stored = window.sessionStorage.getItem(DEMO_TASKS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) ? (parsed as ValidationTask[]) : fallback;
  } catch {
    return fallback;
  }
}

export function FieldWorkflowClient({ initialTasks, mode }: FieldWorkflowClientProps) {
  const [tasks, setTasks] = useState(initialTasks);

  useEffect(() => {
    if (mode === 'demo') {
      setTasks(readDemoTasks(initialTasks));
    }
  }, [initialTasks, mode]);

  const saveTask = async (task: ValidationTask) => {
    if (mode === 'demo') {
      const nextTasks = tasks.map((current) => (current.id === task.id ? task : current));
      window.sessionStorage.setItem(DEMO_TASKS_STORAGE_KEY, JSON.stringify(nextTasks));
      setTasks(nextTasks);
      return;
    }

    const response = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (!response.ok) {
      throw new Error('Task save failed');
    }
    const body = (await response.json()) as { task: ValidationTask };
    setTasks((current) => current.map((item) => (item.id === body.task.id ? body.task : item)));
  };

  return <FieldValidationBoard tasks={tasks} mode={mode} onSave={saveTask} />;
}

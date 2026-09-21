'use client';

import React from 'react';

import { isValidationTask, readDemoTasks, writeDemoTasks } from '../../lib/demo-task-storage';
import type { SnapshotMode, ValidationTask } from '../../lib/domain';
import { NewTaskForm, type NewTaskInput } from './NewTaskForm';
import { useWorkflowTasks } from './useWorkflowTasks';
import { FieldValidationBoard } from './WorkflowViews';

type FieldWorkflowClientProps = {
  initialTasks: ValidationTask[];
  mode: SnapshotMode;
  selectedTaskId?: string;
};

export function FieldWorkflowClient({ initialTasks, mode, selectedTaskId }: FieldWorkflowClientProps) {
  const [tasks, setTasks] = useWorkflowTasks(initialTasks, mode);

  const saveTask = async (task: ValidationTask) => {
    if (mode === 'demo') {
      const nextTasks = readDemoTasks(tasks).map((current) => (current.id === task.id ? task : current));
      writeDemoTasks(nextTasks);
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
    const body: { task: unknown } = await response.json();
    if (!isValidationTask(body.task) || body.task.id !== task.id) throw new Error('Invalid saved task');
    const savedTask = body.task;
    setTasks((current) => current.map((item) => (item.id === savedTask.id ? savedTask : item)));
  };

  const createTask = async (input: NewTaskInput) => {
    if (mode === 'demo') {
      const task = { ...input, id: `demo-task-${crypto.randomUUID()}` };
      const nextTasks = [...readDemoTasks(tasks), task];
      writeDemoTasks(nextTasks);
      setTasks(nextTasks);
      return;
    }
    const response = await fetch('/api/tasks', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Task creation failed');
    const body: { task: unknown } = await response.json();
    if (!isValidationTask(body.task)) throw new Error('Invalid created task');
    const savedTask = body.task;
    setTasks((current) => [...current, savedTask]);
  };

  return <>
    <FieldValidationBoard tasks={tasks} mode={mode} onSave={saveTask} selectedTaskId={selectedTaskId} />
    <NewTaskForm onCreate={createTask} />
  </>;
}

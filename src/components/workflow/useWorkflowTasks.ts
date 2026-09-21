'use client';

import { useEffect, useState } from 'react';

import { DEMO_TASKS_CHANGED, readDemoTasks } from '../../lib/demo-task-storage';
import type { SnapshotMode, ValidationTask } from '../../lib/domain';

export function useWorkflowTasks(initialTasks: ValidationTask[], mode: SnapshotMode) {
  const [tasks, setTasks] = useState(initialTasks);
  useEffect(() => {
    const restore = () => setTasks(mode === 'demo' ? readDemoTasks(initialTasks) : initialTasks);
    restore();
    if (mode !== 'demo') return;
    window.addEventListener(DEMO_TASKS_CHANGED, restore);
    window.addEventListener('focus', restore);
    window.addEventListener('pageshow', restore);
    return () => {
      window.removeEventListener(DEMO_TASKS_CHANGED, restore);
      window.removeEventListener('focus', restore);
      window.removeEventListener('pageshow', restore);
    };
  }, [initialTasks, mode]);
  return [tasks, setTasks] as const;
}

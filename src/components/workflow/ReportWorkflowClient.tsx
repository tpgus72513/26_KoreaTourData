'use client';

import React, { useEffect, useState } from 'react';

import type { SnapshotMode, ValidationTask } from '../../lib/domain';
import { ReportPreview, type ReportModel } from './WorkflowViews';

const DEMO_TASKS_STORAGE_KEY = 'andong-demo-validation-tasks';

type ReportWorkflowClientProps = {
  initialTasks: ValidationTask[];
  mode: SnapshotMode;
  report: Omit<ReportModel, 'tasks'>;
};

export function ReportWorkflowClient({ initialTasks, mode, report }: ReportWorkflowClientProps) {
  const [tasks, setTasks] = useState(initialTasks);

  useEffect(() => {
    if (mode !== 'demo') {
      setTasks(initialTasks);
      return;
    }
    try {
      const stored = window.sessionStorage.getItem(DEMO_TASKS_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      setTasks(Array.isArray(parsed) ? (parsed as ValidationTask[]) : initialTasks);
    } catch {
      setTasks(initialTasks);
    }
  }, [initialTasks, mode]);

  return <ReportPreview report={{ ...report, tasks }} />;
}

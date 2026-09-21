'use client';

import React from 'react';

import type { SnapshotMode, ValidationTask } from '../../lib/domain';
import { ReportPreview, type ReportModel } from './WorkflowViews';
import { useWorkflowTasks } from './useWorkflowTasks';

type ReportWorkflowClientProps = {
  initialTasks: ValidationTask[];
  mode: SnapshotMode;
  report: Omit<ReportModel, 'tasks'>;
};

export function ReportWorkflowClient({ initialTasks, mode, report }: ReportWorkflowClientProps) {
  const [tasks] = useWorkflowTasks(initialTasks, mode);

  return <ReportPreview report={{ ...report, tasks }} />;
}

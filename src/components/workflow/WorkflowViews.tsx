'use client';

import React, { useEffect, useRef, useState } from 'react';

import type { SnapshotMode, SnapshotStatus, ValidationTask, ValidationTaskStatus } from '../../lib/domain';
import { REGIONS } from '../../lib/domain';
import type { EvaluationBundle } from '../../lib/evaluation/catalog';
import { ReportEvaluationSummary } from './ReportEvaluationSummary';

export type ReportModel = {
  evaluations?: EvaluationBundle[];
  analyzedAt: string;
  mode: SnapshotMode;
  sources: string[];
  limitations: string[];
  priorityRegion: string;
  potentialScore: number | null;
  confidenceScore: number | null;
  reasons: string[];
  tasks: ValidationTask[];
  visitorPeriod?: string;
  snapshotStatus?: SnapshotStatus;
  taskReadFailed?: boolean;
};

const STATUS_LABELS: Record<ValidationTaskStatus, string> = {
  'not-started': '예정',
  'in-progress': '확인 중',
  completed: '확인 완료',
  'needs-improvement': '개선 필요',
};

export function uniqueSourceLabels(sources: string[]): string[] {
  return [...new Set(sources.map((source) => source.trim()).filter(Boolean))];
}

function scoreLabel(score: number | null): string {
  return score === null ? '권역 분석' : `${score}점`;
}

function taskStatusSummary(tasks: ValidationTask[]): Array<{ label: string; count: number }> {
  return (Object.keys(STATUS_LABELS) as ValidationTaskStatus[])
    .map((status) => ({ label: STATUS_LABELS[status], count: tasks.filter((task) => task.status === status).length }))
    .filter((item) => item.count > 0);
}

export function ActionTaskCard({ task }: { task: ValidationTask }) {
  const regionName = REGIONS.find((region) => region.id === task.regionId)?.name ?? task.regionId;
  return (
    <article className="workflow-card action-task-card">
      <p className="workflow-eyebrow">{regionName}</p>
      <h2>{task.relatedAction ?? task.title}</h2>
      <p>{task.question}</p>
      <dl className="workflow-meta">
        <div>
          <dt>조사 장소</dt>
          <dd>{task.location}</dd>
        </div>
        <div>
          <dt>확인 상태</dt>
          <dd>{STATUS_LABELS[task.status]}</dd>
        </div>
      </dl>
      <a className="workflow-link" href={`/field?task=${encodeURIComponent(task.id)}`}>
        현장검증에서 보기
      </a>
      <a className="workflow-text-link" href={`/regions/${task.regionId}`}>
        추천 근거 보기
      </a>
    </article>
  );
}

type FieldValidationBoardProps = {
  tasks: ValidationTask[];
  mode: SnapshotMode;
  onSave: (task: ValidationTask) => void | Promise<void>;
  selectedTaskId?: string;
};

export function FieldValidationBoard({ tasks, mode, onSave, selectedTaskId }: FieldValidationBoardProps) {
  const [drafts, setDrafts] = useState(() => new Map<string, ValidationTask>());
  const [saving, setSaving] = useState<string[]>([]);
  const savingIds = useRef(new Set<string>());
  const [notice, setNotice] = useState<string | null>(null);
  const items = tasks.map((task) => drafts.get(task.id) ?? task);
  const selectedTaskExists = tasks.some((task) => task.id === selectedTaskId);

  useEffect(() => {
    if (!selectedTaskId || !selectedTaskExists) return;
    const card = document.getElementById(`field-task-${selectedTaskId}`);
    card?.focus();
    card?.scrollIntoView?.({ block: 'center' });
  }, [selectedTaskId, selectedTaskExists]);

  const updateTask = (id: string, update: (task: ValidationTask) => ValidationTask) => {
    setDrafts((current) => {
      const task = current.get(id) ?? tasks.find((item) => item.id === id);
      return task ? new Map(current).set(id, update(task)) : current;
    });
    setNotice(null);
  };

  const saveTask = async (task: ValidationTask) => {
    if (savingIds.current.has(task.id)) return;
    savingIds.current.add(task.id);
    setSaving([...savingIds.current]);
    try {
      await onSave(task);
      setDrafts((current) => {
        if (current.get(task.id) !== task) return current;
        const next = new Map(current);
        next.delete(task.id);
        return next;
      });
      setNotice(mode === 'demo' ? '현장검증 작업을 이 작업공간에 반영했습니다.' : '현장검증 과제를 저장했습니다.');
    } catch {
      setNotice('저장하지 못했습니다. 네트워크와 관리자 권한을 확인한 뒤 다시 시도하세요.');
    } finally {
      savingIds.current.delete(task.id);
      setSaving([...savingIds.current]);
    }
  };

  return (
    <section aria-labelledby="field-validation-heading">
      <div className="workflow-heading">
        <div>
          <p className="workflow-eyebrow">현장검증·실행관리</p>
          <h1 id="field-validation-heading">현장에서 확인할 조건을 기록합니다</h1>
        </div>
      </div>
      {notice ? <p className="workflow-notice" role="status">{notice}</p> : null}
      {selectedTaskId && !selectedTaskExists ? <p role="status">선택한 과제를 찾을 수 없습니다. 아래 과제 목록을 확인하세요.</p> : null}
      {items.length === 0 ? <p>등록된 현장검증 과제가 없습니다. 아래에서 첫 과제를 만드세요.</p> : null}
      <div className="field-task-grid">
        {items.map((task) => (
          <article className="workflow-card field-task-card" key={task.id} id={`field-task-${task.id}`} tabIndex={-1}>
            <div className="workflow-card-heading">
              <div>
                <p className="workflow-eyebrow">{task.location}</p>
                <h2>{task.title}</h2>
              </div>
              <label>
                <span className="sr-only">{task.title} 상태</span>
                <select
                  aria-label={`${task.title} 상태`}
                  value={task.status}
                  onChange={(event) =>
                    updateTask(task.id, (current) => ({
                      ...current,
                      status: event.target.value as ValidationTaskStatus,
                    }))
                  }
                >
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <option key={status} value={status}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <p>{task.question}</p>
            <fieldset>
              <legend>현장검증 체크리스트</legend>
              <p>체크는 조사 수행 여부를 기록합니다. 접근성 충족 여부는 검증 결과에 별도로 기록하세요.</p>
              {task.checklist.map((item) => (
                <label className="workflow-check" key={item.id}>
                  <input
                    checked={item.completed}
                    type="checkbox"
                    onChange={(event) =>
                      updateTask(task.id, (current) => ({
                        ...current,
                        checklist: current.checklist.map((check) =>
                          check.id === item.id ? { ...check, completed: event.target.checked } : check,
                        ),
                      }))
                    }
                  />
                  {item.label}
                </label>
              ))}
            </fieldset>
            <label className="workflow-textarea-label">
              담당자
              <input
                maxLength={120}
                value={task.assignedTo ?? ''}
                onChange={(event) =>
                  updateTask(task.id, (current) => ({ ...current, assignedTo: event.target.value || null }))
                }
              />
            </label>
            <label className="workflow-textarea-label">
              예정일
              <input
                type="date"
                value={task.scheduledFor ?? ''}
                onChange={(event) =>
                  updateTask(task.id, (current) => ({ ...current, scheduledFor: event.target.value || null }))
                }
              />
            </label>
            <label className="workflow-textarea-label">
              현장 메모
              <textarea
                maxLength={4000}
                value={task.notes ?? ''}
                onChange={(event) =>
                  updateTask(task.id, (current) => ({ ...current, notes: event.target.value || null }))
                }
              />
            </label>
            <label className="workflow-textarea-label">
              검증 결과
              <textarea
                maxLength={4000}
                value={task.result ?? ''}
                onChange={(event) =>
                  updateTask(task.id, (current) => ({ ...current, result: event.target.value || null }))
                }
              />
            </label>
            <button className="workflow-button" type="button" disabled={saving.includes(task.id)} onClick={() => void saveTask(task)}>
              {saving.includes(task.id) ? '저장 중…' : '현장검증 내용 저장'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ReportPreview({ report }: { report: ReportModel }) {
  return (
    <article className="report-preview" aria-labelledby="report-heading">
      <header>
        <p className="workflow-eyebrow">정책 검토안 미리보기</p>
        <h1 id="report-heading">안동 관광권역 정책 검토안</h1>
        <p>스냅샷 발행일: {report.analyzedAt}</p>
        <p>방문자 자료 기간: {report.visitorPeriod ?? '자료 없음'}</p>
        {report.snapshotStatus && report.snapshotStatus.type !== 'ready' ? (
          <div className="workflow-notice" role="status">
            <p>{report.snapshotStatus.message}</p>
            {report.snapshotStatus.lastAttemptAt ? <p>최근 수집 시도: {report.snapshotStatus.lastAttemptAt}</p> : null}
            {report.snapshotStatus.affectedData.length > 0 ? <p>영향받은 자료: {report.snapshotStatus.affectedData.join(', ')}</p> : null}
          </div>
        ) : null}
        {report.taskReadFailed ? <p className="workflow-notice" role="alert">현장검증 자료를 불러오지 못해 과제 목록과 진행 건수를 확인할 수 없습니다.</p> : null}
      </header>
      {report.mode === 'live' ? <>
        <section>
          <h2>우선 검토 권역</h2>
          <p>{report.priorityRegion}</p>
        </section>
        <section>
          <h2>관광권역 여건과 자료 검증</h2>
          <dl className="workflow-meta">
            <div>
              <dt>관광권역 여건 점수</dt>
              <dd>{scoreLabel(report.potentialScore)}</dd>
            </div>
            <div>
              <dt>자료 상태</dt>
              <dd>{report.snapshotStatus?.type === 'ready' || !report.snapshotStatus ? '최신 자료 반영' : '동기화 확인 필요'}</dd>
            </div>
          </dl>
        </section>
      </> : null}
      {report.mode === 'demo' ? (
        <section>
          <h2>현장검증 및 실행</h2>
          <p>등록된 과제를 확인하고 현장 결과와 실행 상태를 기록하세요.</p>
          <a className="workflow-link" href="/field">현장검증 과제 보기</a>
        </section>
      ) : (
        <>
          <section>
            <h2>핵심 근거</h2>
            <ul>{report.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </section>
          <ReportEvaluationSummary evaluations={report.evaluations ?? []} />
        </>
      )}
      <section>
        <h2>우선 실행과제</h2>
        {report.taskReadFailed ? <p>과제 목록 확인 불가</p> : <ul>{report.tasks.map((task) => <li key={task.id}>{task.relatedAction ?? task.title}</li>)}</ul>}
      </section>
      <section>
        <h2>현장검증 상태</h2>
        {report.taskReadFailed ? <p>진행 현황 확인 불가</p> : report.tasks.length === 0 ? <p>등록된 현장검증 과제가 없습니다.</p> : (
          <ul>{taskStatusSummary(report.tasks).map((item) => <li key={item.label}>{item.label} {item.count}건</li>)}</ul>
        )}
      </section>
      <section>
        <h2>KPI 초안</h2>
        {report.taskReadFailed ? <p>자료 조회 후 집계할 수 있습니다.</p> : <p>KPI 초안: 현장검증 과제 완료 {report.tasks.filter((task) => task.status === 'completed').length}/{report.tasks.length}건</p>}
        <p>이 수치는 조사 수행 현황이며 접근성 충족이나 사업 효과를 의미하지 않습니다. 현장 결과를 별도로 검토해야 합니다.</p>
      </section>
      <section>
        <h2>포함된 데이터 출처</h2>
        {uniqueSourceLabels(report.sources).length > 0 ? (
          <ul>{uniqueSourceLabels(report.sources).map((source) => <li key={source}>{source}</li>)}</ul>
        ) : <p>출처 정보 없음</p>}
      </section>
      <div className="report-actions no-print">
        <button className="workflow-button" type="button" onClick={() => window.print()}>
          PDF 미리보기
        </button>
        <button
          className="workflow-secondary-button"
          type="button"
          onClick={() => void navigator.clipboard?.writeText(window.location.href)}
        >
          링크 복사
        </button>
      </div>
    </article>
  );
}

'use client';

import React, { useEffect, useState } from 'react';

import type { SnapshotMode, ValidationTask, ValidationTaskStatus } from '../../lib/domain';
import { REGIONS } from '../../lib/domain';

export type ReportModel = {
  analyzedAt: string;
  mode: SnapshotMode;
  sources: string[];
  limitations: string[];
  priorityRegion: string;
  potentialScore: number | null;
  confidenceScore: number | null;
  reasons: string[];
  tasks: ValidationTask[];
};

const STATUS_LABELS: Record<ValidationTaskStatus, string> = {
  'not-started': '확인 전',
  'in-progress': '확인 중',
  completed: '확인 완료',
  'needs-improvement': '개선 필요',
};

export function uniqueSourceLabels(sources: string[]): string[] {
  return [...new Set(sources.map((source) => source.trim()).filter(Boolean))];
}

function scoreLabel(score: number | null): string {
  return score === null ? '산출 대기' : `${score}점`;
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
};

export function FieldValidationBoard({ tasks, mode, onSave }: FieldValidationBoardProps) {
  const [items, setItems] = useState(tasks);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  const updateTask = (id: string, update: (task: ValidationTask) => ValidationTask) => {
    setItems((current) => current.map((task) => (task.id === id ? update(task) : task)));
    setNotice(null);
  };

  const saveTask = async (task: ValidationTask) => {
    try {
      await onSave(task);
      setNotice(mode === 'demo' ? '시연 변경사항을 이 브라우저 세션에 저장했습니다.' : '현장검증 과제를 저장했습니다.');
    } catch {
      setNotice('저장하지 못했습니다. 네트워크와 관리자 권한을 확인한 뒤 다시 시도하세요.');
    }
  };

  return (
    <section aria-labelledby="field-validation-heading">
      <div className="workflow-heading">
        <div>
          <p className="workflow-eyebrow">현장검증·실행관리</p>
          <h1 id="field-validation-heading">현장에서 확인할 조건을 기록합니다</h1>
        </div>
        {mode === 'demo' ? (
          <p className="workflow-notice" role="status">
            시연 모드: 이 변경은 이 브라우저 세션에서만 유지됩니다.
          </p>
        ) : null}
      </div>
      {notice ? <p className="workflow-notice" role="status">{notice}</p> : null}
      <div className="field-task-grid">
        {items.map((task) => (
          <article className="workflow-card field-task-card" key={task.id}>
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
            <button className="workflow-button" type="button" onClick={() => void saveTask(task)}>
              현장검증 내용 저장
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
        <p>분석 기준일: {report.analyzedAt}</p>
        {report.mode === 'demo' ? <p className="workflow-notice">예시 데이터 · 정책 판단 금지</p> : null}
      </header>
      <section>
        <h2>우선 검토 권역</h2>
        <p>{report.priorityRegion}</p>
      </section>
      <section>
        <h2>점수와 신뢰도</h2>
        <dl className="workflow-meta">
          <div>
            <dt>잠재력 점수</dt>
            <dd>{scoreLabel(report.potentialScore)}</dd>
          </div>
          <div>
            <dt>데이터 신뢰도</dt>
            <dd>{scoreLabel(report.confidenceScore)}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>핵심 근거</h2>
        <ul>{report.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      </section>
      <section>
        <h2>우선 실행과제</h2>
        <ul>{report.tasks.map((task) => <li key={task.id}>{task.relatedAction ?? task.title}</li>)}</ul>
      </section>
      <section>
        <h2>현장검증 상태</h2>
        {report.tasks.length === 0 ? <p>등록된 현장검증 과제가 없습니다.</p> : (
          <ul>{taskStatusSummary(report.tasks).map((item) => <li key={item.label}>{item.label} {item.count}건</li>)}</ul>
        )}
      </section>
      <section>
        <h2>KPI 초안</h2>
        <p>KPI 초안: 현장검증 과제 완료 {report.tasks.filter((task) => task.status === 'completed').length}/{report.tasks.length}건</p>
        <p>이 수치는 현장검증 진행 현황을 위한 초안이며 사업 효과를 의미하지 않습니다.</p>
      </section>
      <section>
        <h2>포함된 데이터 출처</h2>
        {uniqueSourceLabels(report.sources).length > 0 ? (
          <ul>{uniqueSourceLabels(report.sources).map((source) => <li key={source}>{source}</li>)}</ul>
        ) : <p>출처 정보 없음</p>}
      </section>
      <section>
        <h2>데이터 한계</h2>
        <ul>{report.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
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

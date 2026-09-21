'use client';

import React, { useRef, useState } from 'react';

import { REGIONS, type RegionId, type ValidationTask } from '../../lib/domain';

export type NewTaskInput = Omit<ValidationTask, 'id'>;

export function NewTaskForm({ onCreate }: { onCreate: (task: NewTaskInput) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get('title') ?? '').trim();
    const location = String(data.get('location') ?? '').trim();
    const question = String(data.get('question') ?? '').trim();
    if (!title || !location || !question) {
      setNotice('제목, 조사 장소와 확인할 질문을 입력하세요.');
      return;
    }
    pending.current = true;
    setSaving(true);
    setNotice(null);
    try {
      await onCreate({
        regionId: String(data.get('regionId')) as RegionId, title, location, question,
        status: 'not-started', assignedTo: null, scheduledFor: null, notes: null,
        result: null, relatedAction: null, checklist: [],
      });
      form.reset();
      setNotice('현장검증 과제를 만들었습니다.');
    } catch {
      setNotice('과제를 만들지 못했습니다. 입력 내용은 유지됩니다. 관리자 권한과 네트워크를 확인하세요.');
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="workflow-card" aria-labelledby="new-field-task-heading">
      <h2 id="new-field-task-heading">새 현장검증 과제</h2>
      <p>검토할 근거와 현장에서 확인할 질문을 기록하세요.</p>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={saving}>
          <legend>과제 기본 정보</legend>
          <label className="workflow-textarea-label">대상 권역
            <select name="regionId">{REGIONS.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select>
          </label>
          <label className="workflow-textarea-label">새 과제 제목<input required maxLength={180} name="title" /></label>
          <label className="workflow-textarea-label">조사 장소<input required maxLength={180} name="location" /></label>
          <label className="workflow-textarea-label">확인할 질문<textarea required maxLength={1000} name="question" /></label>
          <button className="workflow-button" type="submit">{saving ? '과제 만드는 중…' : '현장검증 과제 만들기'}</button>
        </fieldset>
      </form>
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
}

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ValidationTask } from '../../lib/domain';
import { FieldWorkflowClient } from './FieldWorkflowClient';

const task: ValidationTask = {
  id: '3d3b3436-689a-4b5e-9a1a-3ad2b42ee77f', regionId: 'hahoemaeul', title: '첫 조사',
  location: '하회마을', question: '운영 여부 확인', status: 'not-started', assignedTo: null,
  scheduledFor: null, notes: null, result: null, relatedAction: null, checklist: [],
};
const secondTask = { ...task, id: '3d3b3436-689a-4b5e-9a1a-3ad2b42ee770', title: '둘째 조사' };

afterEach(() => { cleanup(); window.sessionStorage.clear(); vi.unstubAllGlobals(); });

describe('field workflow persistence', () => {
  it('preserves another task draft and edits made during a pending save', async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; })));
    render(<FieldWorkflowClient initialTasks={[task, secondTask]} mode="live" />);
    const first = within(screen.getByText('첫 조사').closest('article')!);
    const second = within(screen.getByText('둘째 조사').closest('article')!);
    fireEvent.change(first.getByLabelText('현장 메모'), { target: { value: '저장할 메모' } });
    fireEvent.change(second.getByLabelText('현장 메모'), { target: { value: '다른 과제 초안' } });
    fireEvent.click(first.getByRole('button', { name: '현장검증 내용 저장' }));
    fireEvent.change(first.getByLabelText('현장 메모'), { target: { value: '저장 중 추가 메모' } });
    await act(async () => finish(Response.json({ task: { ...task, notes: '저장할 메모' } })));
    expect((first.getByLabelText('현장 메모') as HTMLTextAreaElement).value).toBe('저장 중 추가 메모');
    expect((second.getByLabelText('현장 메모') as HTMLTextAreaElement).value).toBe('다른 과제 초안');
  });

  it('creates the first live task through the authorized API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ task }, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<FieldWorkflowClient initialTasks={[]} mode="live" />);
    fireEvent.change(screen.getByLabelText('대상 권역'), { target: { value: 'hahoemaeul' } });
    fireEvent.change(screen.getByLabelText('새 과제 제목'), { target: { value: '첫 조사' } });
    fireEvent.change(screen.getByLabelText('조사 장소'), { target: { value: '하회마을' } });
    fireEvent.change(screen.getByLabelText('확인할 질문'), { target: { value: '운영 여부 확인' } });
    fireEvent.click(screen.getByRole('button', { name: '현장검증 과제 만들기' }));
    expect(await screen.findByRole('heading', { name: '첫 조사' })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ regionId: 'hahoemaeul', title: '첫 조사', status: 'not-started' });
  });

  it('restores validated demo tasks and focuses a linked task', () => {
    window.sessionStorage.setItem('andong-demo-validation-tasks', JSON.stringify([null]));
    render(<FieldWorkflowClient initialTasks={[task, secondTask]} mode="demo" selectedTaskId={secondTask.id} />);
    expect(document.activeElement).toBe(screen.getByText('둘째 조사').closest('article'));
    expect(screen.getByText('첫 조사')).toBeTruthy();
  });

  it('handles a stored task identifier that matches an object property', () => {
    window.sessionStorage.setItem('andong-demo-validation-tasks', JSON.stringify([{ ...task, id: 'constructor' }]));
    render(<FieldWorkflowClient initialTasks={[]} mode="demo" />);
    expect(screen.getByRole('heading', { name: '첫 조사' })).toBeTruthy();
  });

  it('retains first-task input when the API refuses creation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<FieldWorkflowClient initialTasks={[]} mode="live" />);
    fireEvent.change(screen.getByLabelText('새 과제 제목'), { target: { value: '권한 확인 후 저장' } });
    fireEvent.change(screen.getByLabelText('조사 장소'), { target: { value: '현장' } });
    fireEvent.change(screen.getByLabelText('확인할 질문'), { target: { value: '경사 조사' } });
    fireEvent.click(screen.getByRole('button', { name: '현장검증 과제 만들기' }));
    expect(await screen.findByText(/과제를 만들지 못했습니다/)).toBeTruthy();
    expect((screen.getByLabelText('새 과제 제목') as HTMLInputElement).value).toBe('권한 확인 후 저장');
    expect(screen.queryByRole('heading', { name: '권한 확인 후 저장' })).toBeNull();
  });

  it('does not restore demo tasks or send API writes when creating in demo mode', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(<FieldWorkflowClient initialTasks={[]} mode="demo" />);
    fireEvent.change(screen.getByLabelText('새 과제 제목'), { target: { value: '시연 조사' } });
    fireEvent.change(screen.getByLabelText('조사 장소'), { target: { value: '시연 장소' } });
    fireEvent.change(screen.getByLabelText('확인할 질문'), { target: { value: '시연 질문' } });
    fireEvent.click(screen.getByRole('button', { name: '현장검증 과제 만들기' }));
    expect(await screen.findByRole('heading', { name: '시연 조사' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    unmount();
    render(<FieldWorkflowClient initialTasks={[task]} mode="live" />);
    expect(screen.queryByRole('heading', { name: '시연 조사' })).toBeNull();
    expect(screen.getByRole('heading', { name: '첫 조사' })).toBeTruthy();
  });
});

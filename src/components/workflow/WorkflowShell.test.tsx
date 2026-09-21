import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowShell } from './WorkflowShell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ authenticated: false })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('WorkflowShell', () => {
  it('keeps workflow screens connected to the Korean navigation and current region context', async () => {
    render(<WorkflowShell analyzedAt="2026-09-21"><p>화면 내용</p></WorkflowShell>);
    await waitFor(() => expect((screen.getByRole('button', { name: '관리자 로그인' }) as HTMLButtonElement).disabled).toBe(false));

    expect(screen.getByText('동행로컬')).toBeTruthy();
    expect(screen.getByText('안동시')).toBeTruthy();
    expect(screen.getByRole('link', { name: '관광권역 탐색' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: '우선 실행과제' }).getAttribute('href')).toBe('/actions');
    expect(screen.getByRole('link', { name: '현장검증' }).getAttribute('href')).toBe('/field');
    expect(screen.getByRole('link', { name: '정책 검토안' }).getAttribute('href')).toBe('/report');
  });

  it('does not present the live-empty placeholder date as a real 1970 analysis date', async () => {
    render(<WorkflowShell analyzedAt="1970-01-01"><p>화면 내용</p></WorkflowShell>);
    await waitFor(() => expect((screen.getByRole('button', { name: '관리자 로그인' }) as HTMLButtonElement).disabled).toBe(false));

    expect(screen.getByText('스냅샷 발행일 미발행')).toBeTruthy();
  });
});

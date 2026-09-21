import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminSessionControl } from './AdminSessionControl';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  refresh.mockReset();
});

describe('AdminSessionControl', () => {
  it('obtains the HttpOnly session through the app without retaining the password', async () => {
    const fetchMock = vi.fn().mockImplementation((_url, options) => Promise.resolve(
      options?.method === 'POST'
        ? new Response(null, { status: 204 })
        : Response.json({ authenticated: false }),
    ));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminSessionControl />);

    await waitFor(() => expect((screen.getByRole('button', { name: '관리자 로그인' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: '관리자 로그인' }));
    fireEvent.change(screen.getByLabelText('관리자 비밀번호'), { target: { value: 'not-persisted' } });
    fireEvent.submit(screen.getByRole('button', { name: '로그인' }).closest('form')!);

    expect(await screen.findByText('관리자 세션이 활성화되었습니다.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/session', expect.objectContaining({ method: 'POST' }));
    expect(screen.queryByLabelText('관리자 비밀번호')).toBeNull();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('restores an existing authenticated session after a reload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ authenticated: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminSessionControl />);

    expect(await screen.findByRole('button', { name: '로그아웃' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '관리자 로그인' })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/session', expect.objectContaining({ cache: 'no-store' }));
  });

  it.each(['http', 'network'])('does not claim logout succeeded after a %s failure', async (failure) => {
    const fetchMock = vi.fn().mockImplementation((_url, options) => {
      if (options?.method === 'DELETE') {
        return failure === 'network'
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(new Response(null, { status: 503 }));
      }
      return Promise.resolve(Response.json({ authenticated: true }));
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminSessionControl />);
    fireEvent.click(await screen.findByRole('button', { name: '로그아웃' }));

    expect(await screen.findByText(/로그아웃하지 못했습니다/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeTruthy();
    expect(screen.queryByText('관리자 세션을 종료했습니다.')).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('clears the authenticated UI only after a successful logout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options) => Promise.resolve(
      options?.method === 'DELETE'
        ? new Response(null, { status: 204 })
        : Response.json({ authenticated: true }),
    )));
    render(<AdminSessionControl />);
    fireEvent.click(await screen.findByRole('button', { name: '로그아웃' }));

    expect(await screen.findByText('관리자 세션을 종료했습니다.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '관리자 로그인' })).toBeTruthy();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each(['request', 'body'])('allows login recovery when session status %s stalls', async (stage) => {
    vi.useFakeTimers();
    const never = new Promise<never>(() => {});
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => stage === 'request'
      ? never
      : Promise.resolve({ ok: true, json: () => never })));
    render(<AdminSessionControl />);
    expect((screen.getByRole('button', { name: '관리자 로그인' }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(10_001); });

    expect(screen.getByText(/세션 확인 시간이 초과/)).toBeTruthy();
    expect((screen.getByRole('button', { name: '관리자 로그인' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

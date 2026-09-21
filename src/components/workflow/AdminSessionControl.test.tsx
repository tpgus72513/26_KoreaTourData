import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminSessionControl } from './AdminSessionControl';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  refresh.mockReset();
});

describe('AdminSessionControl', () => {
  it('obtains the HttpOnly session through the app without retaining the password', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<AdminSessionControl />);

    fireEvent.click(screen.getByRole('button', { name: '관리자 로그인' }));
    fireEvent.change(screen.getByLabelText('관리자 비밀번호'), { target: { value: 'not-persisted' } });
    fireEvent.submit(screen.getByRole('button', { name: '로그인' }).closest('form')!);

    expect(await screen.findByText('관리자 세션이 활성화되었습니다.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith('/api/session', expect.objectContaining({ method: 'POST' }));
    expect(screen.queryByLabelText('관리자 비밀번호')).toBeNull();
    expect(refresh).toHaveBeenCalledOnce();
  });
});

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminSessionControl() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      setMessage('세션 확인 시간이 초과했습니다. 네트워크를 확인하거나 다시 로그인하세요.');
      setChecking(false);
    }, 10_000);
    void (async () => {
      try {
        const response = await fetch('/api/session', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Session status unavailable');
        const body: unknown = await response.json();
        if (typeof body !== 'object' || body === null || !('authenticated' in body)
          || typeof body.authenticated !== 'boolean') throw new Error('Invalid session status');
        if (!controller.signal.aborted) setActive(body.authenticated);
      } catch {
        if (!controller.signal.aborted) setMessage('관리자 세션 상태를 확인하지 못했습니다. 네트워크를 확인하세요.');
      } finally {
        clearTimeout(timeout);
        if (!controller.signal.aborted) setChecking(false);
      }
    })();
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      setPassword('');
      if (!response.ok) {
        setMessage('로그인하지 못했습니다. 비밀번호와 관리자 설정을 확인하세요.');
        return;
      }
      setActive(true);
      setExpanded(false);
      setMessage('관리자 세션이 활성화되었습니다.');
      router.refresh();
    } catch {
      setPassword('');
      setMessage('로그인하지 못했습니다. 네트워크를 확인한 뒤 다시 시도하세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/session', { method: 'DELETE' });
      if (!response.ok) throw new Error('Session logout failed');
      setActive(false);
      setExpanded(false);
      setPassword('');
      setMessage('관리자 세션을 종료했습니다.');
      router.refresh();
    } catch {
      setMessage('로그아웃하지 못했습니다. 관리자 세션이 유지될 수 있으므로 다시 시도하세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (active) {
    return (
      <div className="admin-session-control">
        <span>관리자 세션 활성</span>
        <button disabled={submitting} type="button" onClick={() => void logout()}>로그아웃</button>
        {message ? <span role="status">{message}</span> : null}
      </div>
    );
  }

  return (
    <div className="admin-session-control">
      <button disabled={checking || submitting} type="button" onClick={() => setExpanded((value) => !value)}>관리자 로그인</button>
      {checking ? <span role="status">관리자 세션 확인 중</span> : null}
      {expanded ? (
        <form onSubmit={login}>
          <label>
            관리자 비밀번호
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button disabled={submitting} type="submit">로그인</button>
        </form>
      ) : null}
      {message ? <span role="status">{message}</span> : null}
    </div>
  );
}

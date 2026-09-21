'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminSessionControl() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    try {
      await fetch('/api/session', { method: 'DELETE' });
    } finally {
      setActive(false);
      setExpanded(false);
      setPassword('');
      setMessage('관리자 세션을 종료했습니다.');
      router.refresh();
    }
  };

  if (active) {
    return (
      <div className="admin-session-control">
        <span>관리자 세션 활성</span>
        <button type="button" onClick={() => void logout()}>로그아웃</button>
        {message ? <span role="status">{message}</span> : null}
      </div>
    );
  }

  return (
    <div className="admin-session-control">
      <button type="button" onClick={() => setExpanded((value) => !value)}>관리자 로그인</button>
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

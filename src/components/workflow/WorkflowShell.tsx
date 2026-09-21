import React, { type ReactNode } from 'react';
import Link from 'next/link';

import { AdminSessionControl } from './AdminSessionControl';

type WorkflowShellProps = {
  analyzedAt: string;
  visitorPeriod?: { start: string; end: string };
  children: ReactNode;
};

const navigation = [
  { href: '/', label: '관광권역 탐색' },
  { href: '/compare', label: '후보 권역 비교' },
  { href: '/evaluation', label: '평가방법 실험실' },
  { href: '/actions', label: '우선 실행과제' },
  { href: '/field', label: '현장검증' },
  { href: '/report', label: '정책 검토안' },
];

export function displayAnalysisDate(value: string): string {
  return !value || value.startsWith('1970-01-01') ? '미발행' : value.slice(0, 10);
}

export function displayVisitorPeriod(period?: { start: string; end: string }): string {
  return period?.start && period.end ? (period.start === period.end ? period.start : `${period.start} ~ ${period.end}`) : '자료 없음';
}

export function WorkflowShell({ analyzedAt, visitorPeriod, children }: WorkflowShellProps) {
  const displayDate = displayAnalysisDate(analyzedAt);
  return (
    <div className="workflow-app">
      <header className="workflow-global-header">
        <Link className="workflow-brand" href="/" aria-label="동행로컬 관광권역 탐색으로 이동">
          동행로컬
        </Link>
        <div className="workflow-context" aria-label="현재 분석 맥락">
          <strong>안동시</strong>
          <span>스냅샷 발행일 {displayDate}</span>
          {visitorPeriod ? <span>방문자 자료 기간 {displayVisitorPeriod(visitorPeriod)}</span> : null}
        </div>
        <AdminSessionControl />
      </header>
      <nav className="workflow-navigation" aria-label="주요 메뉴">
        {navigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
      </nav>
      <div className="workflow-content">{children}</div>
    </div>
  );
}

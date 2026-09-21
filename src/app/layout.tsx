import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: '동행로컬 | 안동 관광권역 검토',
  description: '안동 관광권역의 근거와 현장검증 과제를 검토하는 의사결정 지원 도구',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

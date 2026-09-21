import Link from 'next/link';
import '@/styles/discovery.css';
import '@/styles/public-data.css';

import storedCapture from '@/data/tourism-publication.json';
import { readPublicTourismCapture } from '@/lib/tourism/capture';
import { PublicDataExplorer } from '@/components/data/PublicDataExplorer';

export default function PublicDataPage() {
  const capture = readPublicTourismCapture(storedCapture);
  if (!capture) return (
    <main className="public-data-page">
      <Link href="/">동행로컬로 돌아가기</Link>
      <h1>한국관광공사 OpenAPI 근거 데이터</h1>
      <p role="status">실제 API 수집 자료가 아직 발행되지 않았습니다.</p>
      <p>한국관광공사 자료가 발행되면 관광자원 목록과 방문자 통계를 이 화면에서 확인할 수 있습니다.</p>
      <Link href="/">관광 데이터 탐색으로 돌아가기</Link>
    </main>
  );
  return <PublicDataExplorer capture={capture} />;
}

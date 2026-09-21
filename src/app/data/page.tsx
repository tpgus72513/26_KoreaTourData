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
      <p>이 화면은 예시 데이터로 대신 채우지 않습니다. 실제 수집이 완료된 후 자원 목록·시군 방문자·출처를 표시합니다.</p>
      <Link href="/evaluation">합성 자료로 평가방법 살펴보기</Link>
    </main>
  );
  return <PublicDataExplorer capture={capture} />;
}

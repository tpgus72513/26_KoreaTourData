'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { MapCanvas } from '../discovery/MapCanvas';
import { REGIONS, type RegionId, type TourismPlaceCategory } from '../../lib/domain';
import type { PublicTourismCapture } from '../../lib/tourism/capture';

const categories: { value: TourismPlaceCategory; label: string }[] = [
  { value: 'attraction', label: '관광·문화·기타' },
  { value: 'accommodation', label: '숙박' }, { value: 'food', label: '음식' },
  { value: 'event', label: '행사' },
];

export function PublicDataExplorer({ capture }: { capture: PublicTourismCapture }) {
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId>(REGIONS[0].id);
  const [category, setCategory] = useState('all');
  const { snapshot } = capture;
  const selectedRegion = REGIONS.find((region) => region.id === selectedRegionId)!;
  const visiblePlaces = useMemo(() => snapshot.places.filter((place) =>
    place.regionId === selectedRegionId && (category === 'all' || place.category === category)),
  [snapshot.places, selectedRegionId, category]);
  const outsideCount = snapshot.places.filter((place) => place.regionId === null).length;
  return (
    <main className="public-data-page">
      <header className="public-data-header">
        <Link className="wordmark" href="/">동행로컬</Link>
        <nav aria-label="주요 메뉴">
          <Link href="/data" aria-current="page">실제 공공데이터</Link>
          <Link href="/">의사결정 흐름 시연</Link>
          <Link href="/evaluation">평가방법 실험실</Link>
          <Link href="/field">현장검증 시연</Link>
        </nav>
      </header>
      <section className="public-data-intro">
        <p className="eyebrow">한국관광공사 OpenAPI 실제 응답</p>
        <h1>관광자원을 확인하고,<br />검증할 질문을 구체화합니다.</h1>
        <p>안동의 관광자원을 기획 권역으로 묶어 살펴보고, 시설 분포와 실제 성과를 구분해 다음 조사를 준비합니다.</p>
        <p className="public-data-badge">실제 API 수집 자료 · {new Date(capture.collectedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST 수집 · 실시간 갱신 아님</p>
      </section>
      <div className="public-data-metrics">
        <article><span>안동 전체 위치 확인 자원</span><strong>{snapshot.places.length.toLocaleString()}개</strong><small>좌표가 유효한 API 관광자원</small></article>
        <article><span>기획 권역 밖 관광자원</span><strong>{outsideCount.toLocaleString()}개</strong><small>세 고정 반경에 포함되지 않은 자원</small></article>
        <article><span>안동시 외지인 방문자</span><strong>{snapshot.visitorContext.visitorCount?.toLocaleString() ?? '정보 없음'}{snapshot.visitorContext.visitorCount !== null ? '명' : ''}</strong><small>{capture.sourceDate} · 시 전체 맥락, 권역별 실측 아님</small></article>
      </div>
      <section className="public-data-section" aria-labelledby="resource-comparison-title">
        <p className="eyebrow">01 / 자원 분포</p><h2 id="resource-comparison-title">같은 수집 기준으로 세 권역 비교</h2>
        <p>권역의 중심점과 반경은 기획자가 설정한 검토 범위입니다. 법정 경계나 실제 방문권이 아니며 시설 수가 많다고 성장성이 높다는 뜻은 아닙니다.</p>
        <div className="public-data-table-wrap"><table>
          <thead><tr><th>기획 권역</th><th>반경</th>{categories.map((entry) => <th key={entry.value}>{entry.label}</th>)}<th>전체</th><th>여건 점수</th></tr></thead>
          <tbody>{REGIONS.map((region) => {
            const places = snapshot.places.filter((place) => place.regionId === region.id);
            return <tr key={region.id} className={selectedRegionId === region.id ? 'selected-row' : ''}>
              <th><button type="button" onClick={() => setSelectedRegionId(region.id)}>{region.name}</button></th>
              <td>{(region.radiusMeters / 1000).toFixed(1)}km</td>
              {categories.map((entry) => <td key={entry.value}>{places.filter((place) => place.category === entry.value).length}개</td>)}
              <td>{places.length}개</td><td>독립 관측값 필요</td>
            </tr>;
          })}</tbody>
        </table></div>
        <p className="public-data-note">관광·문화·기타에는 관광지·문화시설·레포츠·쇼핑 등 숙박·음식·행사 외 분류가 포함됩니다. 분류는 API contenttypeid를 기준으로 집계했습니다.</p>
      </section>
      <section className="public-data-section" aria-labelledby="resource-map-title">
        <p className="eyebrow">02 / 실제 관광자원 탐색</p><h2 id="resource-map-title">{selectedRegion.name} 자원 지도</h2>
        <div className="public-data-filters">
          <label>관광권역 <select value={selectedRegionId} onChange={(event) => setSelectedRegionId(event.target.value as RegionId)}>{REGIONS.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label>
          <label>자원 유형 <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">전체</option>{categories.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
          <strong>{visiblePlaces.length}개 자원</strong>
        </div>
        <MapCanvas snapshot={snapshot} places={visiblePlaces} selectedRegionId={selectedRegionId} onSelectRegion={setSelectedRegionId} />
        <details><summary>선택 자원의 주소·원천 ID 확인 ({visiblePlaces.length}개)</summary>
          <ul className="public-data-place-list">{visiblePlaces.map((place) => <li key={place.id}><strong>{place.name}</strong><span>{place.address ?? '주소 정보 없음'}</span><small>TourAPI contentid {place.id} · {categories.find((entry) => entry.value === place.category)?.label ?? place.category}</small></li>)}</ul>
        </details>
      </section>
      <section className="public-data-section" aria-labelledby="next-action-title">
        <p className="eyebrow">03 / 관측을 실행 질문으로</p><h2 id="next-action-title">{selectedRegion.name}에서 다음으로 확인할 것</h2>
        <div className="public-data-next-grid">
          <article><h3>체류</h3><p>숙박시설 위치를 바탕으로 관광지와 숙박시설 간 이동 연결을 현장에서 확인합니다. 숙박 가동률과 실제 체류시간은 별도 수집이 필요합니다.</p></article>
          <article><h3>지역소비</h3><p>관광자원과 음식점의 공간적 연결을 살펴봅니다. 매출액·지역업체 여부·누수 효과는 이 자료로 판단할 수 없습니다.</p></article>
          <article><h3>관광약자 접근성</h3><p>보행 경사·턱·장애인 화장실·대중교통 연결을 조사합니다. 좌표나 시설 등록 사실을 접근성 충족으로 해석하지 않습니다.</p></article>
        </div>
        <p className="public-data-note">아래는 별도의 합성 자료 기반 업무 흐름 시연입니다. 실제 API 자원을 근거로 점수나 사업 우선순위를 확정하지 않습니다.</p>
        <div className="public-data-links"><Link className="primary-link" href={`/regions/${selectedRegionId}`}>권역 근거 검토 시연</Link><Link className="primary-link" href="/actions">실행과제 관리 시연</Link><Link className="primary-link" href="/field">현장검증 시연</Link></div>
      </section>
      <section className="public-data-section" aria-labelledby="provenance-title">
        <p className="eyebrow">04 / 재현 가능한 근거</p><h2 id="provenance-title">출처와 해석 범위</h2>
        <dl className="public-data-provenance">
          <div><dt>관광자원</dt><dd>한국관광공사 국문 관광정보 서비스 · areaCode2 지역코드 확인 → areaBasedList2 페이지 수집 → 유효 좌표 정규화 → 고정 반경 권역 집계</dd></div>
          <div><dt>방문자</dt><dd>한국관광공사 관광빅데이터 정보서비스 · locgoRegnVisitrDDList · {capture.sourceDate} 안동시 {capture.visitorRecordCount}개 구분 자료 중 외지인(touDivCd=2)만 표시</dd></div>
          <div><dt>수집 방식</dt><dd>서버 전용 인증키로 응답을 검증한 뒤 공개 필드만 저장합니다. 화면 요청마다 API를 호출하지 않으며 이번 수집 시점의 자료를 표시합니다.</dd></div>
          <div><dt>점수와 논문</dt><dd>실제 권역 점수는 산출 대기입니다. <Link href="/evaluation">평가방법 실험실</Link>에서 논문에 근거한 정규화·AHP·결측 처리·민감도를 합성 자료로 시험합니다. 임시 가중치는 실증 검증되지 않았습니다.</dd></div>
        </dl>
        <ul>{snapshot.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
        <p><a href="https://api.visitkorea.or.kr/">한국관광 콘텐츠랩</a> · <a href="https://www.data.go.kr/">공공데이터포털</a></p>
      </section>
    </main>
  );
}

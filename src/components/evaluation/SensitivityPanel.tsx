import React from 'react';

import { REGIONS } from '../../lib/domain';
import { createDemoEvaluation, type EvaluationBundle } from '../../lib/evaluation/catalog';
import { analyzeSensitivity } from '../../lib/evaluation/sensitivity';

import { formatEvaluationNumber } from './EvaluationTrace';

function scoreRange(lower: number | null, upper: number | null) {
  return lower === null || upper === null ? '계산 조건 확인 필요' : `${lower.toFixed(1)} ~ ${upper.toFixed(1)}점`;
}

export function SensitivityPanel({ bundle }: { bundle: EvaluationBundle }) {
  const selectedIndex = REGIONS.findIndex((region) => region.id === bundle.input.regionId);
  if (selectedIndex < 0) return null;

  let analysis;
  try {
    const inputs = REGIONS.map((region) => region.id === bundle.input.regionId ? bundle.input : createDemoEvaluation(region.id).input);
    analysis = analyzeSensitivity(bundle.model, inputs);
  } catch (error) {
    return <section className="evaluation-trace" aria-label="가중치 민감도"><h2>가중치 민감도</h2><p role="alert">민감도 계산 조건을 확인해 주세요: {error instanceof Error ? error.message : '비교 조건을 확인해 주세요.'}</p></section>;
  }

  return (
    <section className="evaluation-trace" aria-label="가중치 민감도">
      <p className="eyebrow">가중치 변경에 따른 결과 확인</p>
      <h2>가중치 민감도</h2>
      <p>현재 입력을 유지하고 영역 가중치만 바꿉니다. 현재 가중치, 동등 가중치, 영역별 상대 ±20% 변경 후 합계 1 재정규화의 {analysis.scenarios.length}개 시나리오를 계산합니다. ±20%는 서비스가 제공하는 비교 조건입니다. 현재 가중치가 동등하면 두 기준 시나리오는 같습니다.</p>
      <p className="evaluation-notice">아래 범위는 선택한 가중치 시나리오의 최솟값·최댓값입니다. 결측에 따른 계산상 범위와 함께 확인해 가중치 변화에 따른 점수 흐름을 비교할 수 있습니다.</p>
      <p>선택 권역은 현재 수정한 입력을 기준으로 계산하며, 다른 권역은 저장된 입력을 사용합니다. 결측 또는 필수조건 상태는 비교 결과와 함께 표시됩니다.</p>
      <div className="evaluation-trace-scroll" tabIndex={0} aria-label="민감도 요약표 가로 스크롤">
        <table>
          <caption>권역별 가중치 시나리오 범위</caption>
          <thead><tr><th scope="col">권역</th><th scope="col">여건 점수 범위</th><th scope="col">여건 점수 순위 범위</th></tr></thead>
      <tbody>{analysis.summaries.map((summary) => <tr key={summary.regionId}><th scope="row">{REGIONS.find((region) => region.id === summary.regionId)?.name ?? summary.regionId}{summary.regionId === bundle.input.regionId && <small>현재 편집 중인 권역</small>}</th><td>{scoreRange(summary.minScore, summary.maxScore)}</td><td>{summary.minRank === null || summary.maxRank === null ? '계산 조건 확인 필요' : `${summary.minRank} ~ ${summary.maxRank}위`}</td></tr>)}</tbody>
        </table>
      </div>
      <details>
        <summary>시나리오별 가중치와 현재 권역 점수</summary>
        <div className="evaluation-trace-scroll" tabIndex={0} aria-label="가중치 시나리오 표 가로 스크롤">
          <table>
            <caption>현재 권역의 {analysis.scenarios.length}개 가중치 시나리오</caption>
            <thead><tr><th scope="col">시나리오</th>{bundle.model.domains.map((domain) => <th key={domain.id} scope="col">{domain.label}</th>)}<th scope="col">{REGIONS[selectedIndex].name} 점수</th></tr></thead>
            <tbody>{analysis.scenarios.map((scenario) => <tr key={scenario.id}><th scope="row">{scenario.label}</th>{scenario.weights.map((weight, index) => <td key={bundle.model.domains[index].id}>{(weight * 100).toFixed(1)}%</td>)}<td>{formatEvaluationNumber(scenario.results[selectedIndex].totalScore, '점')}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

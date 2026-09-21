'use client';

import Link from 'next/link';
import React, { useMemo, useState } from 'react';

import { REGIONS, type RegionId } from '../../lib/domain';
import { calculateAhp } from '../../lib/evaluation/ahp';
import { createDemoEvaluation, type EvaluationBundle } from '../../lib/evaluation/catalog';
import { evaluateRegion } from '../../lib/evaluation/engine';

import { EvaluationTrace } from './EvaluationTrace';
import { SensitivityPanel } from './SensitivityPanel';

const COMPARISON_CHOICES = [1 / 9, 1 / 8, 1 / 7, 1 / 6, 1 / 5, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function equalMatrix(size: number) {
  return Array.from({ length: size }, () => Array<number>(size).fill(1));
}

function observationValues(bundle: EvaluationBundle) {
  return Object.fromEntries(bundle.input.observations.map((item) => [item.indicatorId, item.value === null ? '' : String(item.value)]));
}

export function EvaluationLab() {
  const [regionId, setRegionId] = useState<RegionId>('old-town-wolyeonggyo');
  const baseline = useMemo(() => createDemoEvaluation(regionId), [regionId]);
  const [values, setValues] = useState<Record<string, string>>(() => observationValues(createDemoEvaluation('old-town-wolyeonggyo')));
  const [matrix, setMatrix] = useState<number[][]>(() => equalMatrix(5));
  const calculation = useMemo(() => {
    try {
      const ahp = calculateAhp(matrix);
      const model = {
        ...baseline.model,
        version: `${baseline.model.version}-ahp-lab`,
        weightMethod: 'AHP 주고유벡터 · 시연용 비교행렬 · 전문가 조사 전',
        domains: baseline.model.domains.map((domain, index) => ({ ...domain, weight: ahp.weights[index] })),
      };
      const input = {
        ...baseline.input,
        dataVersion: `${baseline.input.dataVersion}-lab-input`,
        observations: baseline.input.observations.map((observation) => ({
          ...observation,
          value: values[observation.indicatorId]?.trim() ? Number(values[observation.indicatorId]) : null,
          source: '평가방법 실험실의 가상 입력 · 실측/API 응답 아님',
        })),
      };
      const evaluated = evaluateRegion(model, input);
      const result = ahp.consistent ? evaluated : { ...evaluated, totalScore: null, issues: ['AHP 비교행렬의 일관성 조건을 충족하지 않아 총점을 보류합니다.', ...evaluated.issues] };
      return { bundle: { model, input, result }, ahp, error: null };
    } catch (error) {
      return { bundle: null, ahp: null, error: error instanceof Error ? error.message : '계산 조건을 확인해 주세요.' };
    }
  }, [baseline, matrix, values]);

  function changeRegion(nextId: RegionId) {
    const next = createDemoEvaluation(nextId);
    setRegionId(nextId);
    setValues(observationValues(next));
    setMatrix(equalMatrix(next.model.domains.length));
  }

  function updateComparison(row: number, column: number, value: number) {
    setMatrix((current) => current.map((items, currentRow) => items.map((item, currentColumn) => (
      currentRow === row && currentColumn === column ? value
        : currentRow === column && currentColumn === row ? 1 / value : item
    ))));
  }

  return (
    <main className="screen-page evaluation-lab">
      <header className="screen-topline"><Link className="back-link" href="/compare">← 후보 권역 비교</Link><span className="status-chip status-chip-demo">시연 데이터 · 실제 지역평가 아님</span></header>
      <h1>평가방법 실험실</h1>
      <p>문헌을 참고한 정규화·AHP·가중합이 입력과 결측에 따라 어떻게 달라지는지 확인합니다. 화면의 입력은 가상 실험이며 저장되지 않습니다. 실제 지역의 성장 가능성이나 투자효과를 예측하지 않습니다.</p>

      <div className="evaluation-lab-layout">
        <section className="evaluation-lab-panel" aria-labelledby="lab-input-title">
          <h2 id="lab-input-title">1. 독립 지표값 입력</h2>
          <label>시연 권역<select value={regionId} onChange={(event) => changeRegion(event.target.value as RegionId)}>{REGIONS.map((region) => <option value={region.id} key={region.id}>{region.name}</option>)}</select></label>
          <p className="evaluation-subtext">모든 지표는 시연용 충족률(0~100%)입니다. 빈칸은 결측으로 처리합니다. 분모·기간·공간은 아래 가상 조사 시나리오에 고정됩니다.</p>
          {baseline.model.domains.flatMap((domain) => domain.indicators.map((indicator) => <label key={indicator.id}>
            {indicator.label} (%)
            <input type="number" min={0} max={100} step="any" value={values[indicator.id] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [indicator.id]: event.target.value }))} />
            <span className="evaluation-subtext">{domain.label} · {indicator.denominator}</span>
          </label>))}
          <button type="button" onClick={() => changeRegion(regionId)}>현재 권역의 시연 입력으로 초기화</button>
        </section>

        <section className="evaluation-lab-panel" aria-labelledby="lab-ahp-title">
          <h2 id="lab-ahp-title">2. AHP 가중치 실험</h2>
          <p><strong>시연용 비교행렬 · 전문가 조사 전</strong></p>
          <p className="evaluation-subtext">1은 두 영역의 중요도가 같다는 뜻입니다. 2~9는 앞 영역을 더 중요하게, 1/2~1/9는 뒤 영역을 더 중요하게 봅니다. 역방향 값은 자동으로 역수가 됩니다.</p>
          <fieldset><legend>영역 간 쌍대비교</legend>{baseline.model.domains.flatMap((domain, row) => baseline.model.domains.slice(row + 1).map((other, offset) => {
            const column = row + offset + 1;
            return <label key={`${domain.id}-${other.id}`}>{domain.label} / {other.label}<select value={matrix[row][column]} onChange={(event) => updateComparison(row, column, Number(event.target.value))}>{COMPARISON_CHOICES.map((choice) => <option key={choice} value={choice}>{choice < 1 ? `1/${Math.round(1 / choice)} · 뒤 영역 우세` : choice === 1 ? '1 · 같은 중요도' : `${choice} · 앞 영역 우세`}</option>)}</select></label>;
          }))}</fieldset>
          {calculation.ahp && <div className="evaluation-ahp-output"><p>최대 고유값 λmax: {calculation.ahp.lambdaMax.toFixed(4)} · CI: {calculation.ahp.ci.toFixed(4)}</p><p>일관성 비율 CR: {calculation.ahp.cr === null ? '산출 대상 아님' : calculation.ahp.cr.toFixed(4)} · {calculation.ahp.consistent ? '일관성 기준 통과' : '일관성 기준 미충족'}</p><small>CR 기준 충족은 판단 간 일관성 점검입니다. 가중치의 정답성이나 모형 타당성을 보증하지 않습니다.</small></div>}
        </section>
      </div>

      {calculation.error && <p className="evaluation-alert" role="alert">계산할 수 없습니다: {calculation.error}</p>}
      {calculation.ahp && !calculation.ahp.consistent && <p className="evaluation-alert" role="alert">AHP 판단의 일관성 기준을 충족하지 않았습니다. 쌍대비교를 검토할 때까지 총점 산출을 보류합니다.</p>}
      {calculation.bundle && calculation.ahp?.consistent && <><EvaluationTrace bundle={calculation.bundle} /><SensitivityPanel bundle={calculation.bundle} /></>}
      {calculation.ahp && !calculation.ahp.consistent && <section className="evaluation-trace" aria-label="평가 계산 결과"><h2>산출 보류</h2><p>일관성 조건을 충족할 때까지 총점, 기여분, 계산상 범위와 민감도 결과를 표시하지 않습니다.</p></section>}
    </main>
  );
}

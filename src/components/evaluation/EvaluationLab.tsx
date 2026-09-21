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
        weightMethod: 'AHP 주고유벡터 · 사용자 설정 비교행렬',
        domains: baseline.model.domains.map((domain, index) => ({ ...domain, weight: ahp.weights[index] })),
      };
      const input = {
        ...baseline.input,
        dataVersion: `${baseline.input.dataVersion}-lab-input`,
        observations: baseline.input.observations.map((observation) => ({
          ...observation,
          value: values[observation.indicatorId]?.trim() ? Number(values[observation.indicatorId]) : null,
          source: '평가방법 실험실 입력',
        })),
      };
      const evaluated = evaluateRegion(model, input);
      const result = ahp.consistent ? evaluated : { ...evaluated, totalScore: null, issues: ['AHP 비교행렬의 일관성 조건을 확인해 주세요.', ...evaluated.issues] };
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
      <header className="screen-topline"><Link className="back-link" href="/compare">← 후보 권역 비교</Link><span className="status-chip">계산 근거 확인</span></header>
      <h1>평가방법 실험실</h1>
      <p>문헌을 참고한 정규화·AHP·가중합이 입력과 결측에 따라 어떻게 달라지는지 확인하고, 원자료·출처·가중치·기여분을 추적합니다.</p>

      <div className="evaluation-lab-layout">
        <section className="evaluation-lab-panel" aria-labelledby="lab-input-title">
          <h2 id="lab-input-title">1. 독립 지표값 입력</h2>
          <label>평가 권역<select value={regionId} onChange={(event) => changeRegion(event.target.value as RegionId)}>{REGIONS.map((region) => <option value={region.id} key={region.id}>{region.name}</option>)}</select></label>
          <p className="evaluation-subtext">지표는 0~100% 충족률로 입력합니다. 빈칸은 결측으로 처리하며 분모·기간·공간을 함께 기록합니다.</p>
          {baseline.model.domains.flatMap((domain) => domain.indicators.map((indicator) => <label key={indicator.id}>
            {indicator.label} (%)
            <input type="number" min={0} max={100} step="any" value={values[indicator.id] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [indicator.id]: event.target.value }))} />
            <span className="evaluation-subtext">{domain.label} · {indicator.denominator}</span>
          </label>))}
          <button type="button" onClick={() => changeRegion(regionId)}>현재 권역 입력으로 초기화</button>
        </section>

        <section className="evaluation-lab-panel" aria-labelledby="lab-ahp-title">
          <h2 id="lab-ahp-title">2. AHP 가중치 실험</h2>
          <p><strong>사용자 설정 비교행렬</strong></p>
          <p className="evaluation-subtext">1은 두 영역의 중요도가 같다는 뜻입니다. 2~9는 앞 영역을 더 중요하게, 1/2~1/9는 뒤 영역을 더 중요하게 봅니다. 역방향 값은 자동으로 역수가 됩니다.</p>
          <fieldset><legend>영역 간 쌍대비교</legend>{baseline.model.domains.flatMap((domain, row) => baseline.model.domains.slice(row + 1).map((other, offset) => {
            const column = row + offset + 1;
            return <label key={`${domain.id}-${other.id}`}>{domain.label} / {other.label}<select value={matrix[row][column]} onChange={(event) => updateComparison(row, column, Number(event.target.value))}>{COMPARISON_CHOICES.map((choice) => <option key={choice} value={choice}>{choice < 1 ? `1/${Math.round(1 / choice)} · 뒤 영역 우세` : choice === 1 ? '1 · 같은 중요도' : `${choice} · 앞 영역 우세`}</option>)}</select></label>;
          }))}</fieldset>
          {calculation.ahp && <div className="evaluation-ahp-output"><p>최대 고유값 λmax: {calculation.ahp.lambdaMax.toFixed(4)} · CI: {calculation.ahp.ci.toFixed(4)}</p><p>일관성 비율 CR: {calculation.ahp.cr === null ? '산출 대상 아님' : calculation.ahp.cr.toFixed(4)} · {calculation.ahp.consistent ? '일관성 기준 통과' : '일관성 기준 미충족'}</p><small>CR은 쌍대비교 입력의 일관성을 점검하고 가중치 산출 과정을 안내합니다.</small></div>}
        </section>
      </div>

      {calculation.error && <p className="evaluation-alert" role="alert">계산할 수 없습니다: {calculation.error}</p>}
      {calculation.ahp && !calculation.ahp.consistent && <p className="evaluation-alert" role="alert">AHP 비교행렬의 일관성 기준을 확인해 주세요. 쌍대비교를 조정하면 총점과 민감도를 계산할 수 있습니다.</p>}
      {calculation.bundle && calculation.ahp?.consistent && <><EvaluationTrace bundle={calculation.bundle} /><SensitivityPanel bundle={calculation.bundle} /></>}
      {calculation.ahp && !calculation.ahp.consistent && <section className="evaluation-trace" aria-label="평가 계산 결과"><h2>계산 조건 확인 필요</h2><p>일관성 조건을 확인하면 총점, 기여분, 계산상 범위와 민감도 결과를 표시합니다.</p></section>}
    </main>
  );
}

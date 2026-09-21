import React, { useId } from 'react';

import { RESEARCH_REFERENCES, type EvaluationBundle } from '../../lib/evaluation/catalog';

import '../../styles/evaluation.css';

export function formatEvaluationNumber(value: number | null, suffix = '') {
  return value === null ? '계산 조건 확인 필요' : `${value.toFixed(1)}${suffix}`;
}

export function evaluationGateLabel(status: EvaluationBundle['result']['gateStatus']) {
  return { blocked: '필수조건 미충족 · 확인 항목', 'field-required': '필수조건 현장확인 필요', reviewable: '필수조건 확인 · 별도 검토 항목' }[status];
}

export function EvaluationTrace({ bundle }: { bundle: EvaluationBundle }) {
  const titleId = useId();
  const { model, input, result } = bundle;
  const references = new Set(model.domains.flatMap((domain) => domain.indicators.flatMap((indicator) => indicator.referenceIds)));

  return (
    <section className="evaluation-trace" aria-labelledby={titleId}>
      <p className="eyebrow">문헌을 참고한 계산 절차</p>
      <h2 id={titleId}>원자료에서 총점까지 계산 근거를 확인합니다</h2>
      <p className="evaluation-notice">문헌은 지표 개발·AHP·종합지수의 방법론 근거입니다. 아래 지표, 기준값, 가중치와 필수조건의 출처와 계산 기여분을 함께 확인할 수 있습니다.</p>

      <section aria-label="평가 계산 결과">
        <dl className="evaluation-summary">
          <div><dt>계산된 여건 총점</dt><dd>{formatEvaluationNumber(result.totalScore, '점')}</dd></div>
          <div><dt>가중 자료 확보율</dt><dd>{formatEvaluationNumber(result.coveragePercent, '%')}</dd></div>
          <div><dt>결측에 따른 계산상 범위</dt><dd>{result.range.lower.toFixed(1)} ~ {result.range.upper.toFixed(1)}점</dd></div>
        </dl>
        <p>결측은 0점으로 대체하지 않으며, 누락 지표의 가중치를 다른 지표에 재배분하지 않습니다. 계산상 범위는 결측 지표를 가능한 최솟값·최댓값에 놓은 경계로, 자료 확보율과 함께 입력 상태를 보여줍니다.</p>
        {result.issues.length > 0 && <ul>{result.issues.map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul>}
      </section>

      <p><strong>계산식</strong> 이익 방향: 100 × (원값 − L) / (U − L), 비용 방향: 100 × (U − 원값) / (U − L). 정규화 점수는 0~100 범위로 맞춥니다. 전역 가중치 = 영역 가중치 × 영역 내 가중치, 총점 기여분 = 정규화 점수 × 전역 가중치입니다.</p>
      <p><strong>가중치 방식</strong> {model.weightMethod}</p>
      <div className="evaluation-trace-scroll" tabIndex={0} aria-label="계산 추적표 가로 스크롤">
        <table>
          <caption>지표별 계산 추적표</caption>
          <thead><tr><th scope="col">영역 / 지표</th><th scope="col">원값 / 단위</th><th scope="col">정규화 기준</th><th scope="col">정규화 점수</th><th scope="col">영역 / 내부 / 전역 가중치</th><th scope="col">총점 기여분</th><th scope="col">출처와 해석 범위</th></tr></thead>
          <tbody>{result.domains.flatMap((domain) => domain.indicators.map((indicator) => {
            const definition = model.domains.find((item) => item.id === domain.id)?.indicators.find((item) => item.id === indicator.id);
            return <tr key={indicator.id}>
              <th scope="row">{domain.label}<small>{indicator.label}</small></th>
              <td>{indicator.value === null ? '정보 없음' : `${indicator.value} ${indicator.unit}`}<small>{indicator.kind === 'example' ? '입력 자료' : indicator.kind === 'proxy' ? '대리 지표' : indicator.kind === 'observed' ? '관측 자료' : '출처 확인 필요'}</small></td>
              <td>L={indicator.lower}, U={indicator.upper}<small>{indicator.direction === 'benefit' ? '클수록 좋은 방향' : '작을수록 좋은 방향'}</small><small>{indicator.benchmarkRationale}</small></td>
              <td>{formatEvaluationNumber(indicator.normalizedScore, '점')}<small>{indicator.unavailableReason}</small></td>
              <td>{(domain.weight * 100).toFixed(1)}% / {definition ? `${(definition.weight * 100).toFixed(1)}%` : '확인 필요'} / {(indicator.weight * 100).toFixed(1)}%</td>
              <td>{formatEvaluationNumber(indicator.contribution, '점')}</td>
              <td>{indicator.source || '출처 미등록'}<small>기간: {indicator.period ? `${indicator.period.start} ~ ${indicator.period.end}` : '미등록'}</small><small>공간: {indicator.scope || '미등록'}</small><small>분모: {indicator.denominator || '미등록'}</small><small>문헌: {indicator.referenceIds.map((id) => {
                const reference = RESEARCH_REFERENCES.find((item) => item.id === id);
                return reference ? <React.Fragment key={id}><a href={reference.url}>{reference.title}</a>{' '}</React.Fragment> : <span key={id}>{id} </span>;
              })}</small></td>
            </tr>;
          }))}</tbody>
          <tfoot><tr><th scope="row" colSpan={5}>가중 기여분 합계</th><td colSpan={2}>{formatEvaluationNumber(result.totalScore, '점')}</td></tr></tfoot>
        </table>
      </div>

      <h3>총점과 별도로 확인하는 필수조건</h3>
      <p><strong>{evaluationGateLabel(result.gateStatus)}</strong></p>
      <ul>{result.gates.map((gate) => <li key={gate.id}><strong>{gate.label}: {gate.status === 'pass' ? '충족' : gate.status === 'fail' ? '미충족' : '확인 필요'}</strong> — {gate.source}</li>)}</ul>
      <p>필수조건은 총점과 별도로 표시해 권역별 검토 항목을 구분합니다. 현장검증 업무의 진행 상태도 이용조건과 함께 확인할 수 있습니다.</p>

      <dl className="evaluation-metadata">
        <div><dt>모형 버전</dt><dd>{result.modelVersion}</dd></div>
        <div><dt>자료 버전</dt><dd>{result.dataVersion}</dd></div>
        <div><dt>평가 공간</dt><dd>{result.regionId}</dd></div>
        <div><dt>자료 기간</dt><dd>{input.period.start} ~ {input.period.end}</dd></div>
        <div><dt>모형 상태</dt><dd>평가 계산 모형</dd></div>
      </dl>

      <details className="evaluation-reference-list"><summary>참고 문헌과 적용 범위</summary><ul>{RESEARCH_REFERENCES.filter((reference) => references.has(reference.id) || ['R7', 'R8'].includes(reference.id)).map((reference) => <li key={reference.id}><a href={reference.url}>{reference.title}</a> — {reference.application}</li>)}</ul></details>
    </section>
  );
}

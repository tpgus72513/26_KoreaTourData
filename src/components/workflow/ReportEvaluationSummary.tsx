import React from 'react';
import { REGIONS } from '../../lib/domain';
import type { EvaluationBundle } from '../../lib/evaluation/catalog';
import { evaluationGateLabel, formatEvaluationNumber } from '../evaluation/EvaluationTrace';

export function ReportEvaluationSummary({ evaluations }: { evaluations: EvaluationBundle[] }) {
  if (evaluations.length === 0) return null;
  return <section className="report-evaluations">
    <h2>권역별 점수 계산 근거</h2>
    <p>합성 자료의 계산 시연입니다. 자료 확보율은 정확도가 아니며 결측 범위는 신뢰구간이 아닙니다. 필수조건과 사업 검토는 점수와 별도로 판단합니다.</p>
    <div className="evaluation-trace-scroll">
      <table>
        <caption>권역별 계산 결과와 근거 버전</caption>
        <thead><tr><th scope="col">권역</th><th scope="col">계산 총점</th><th scope="col">확보율 / 결측 범위</th><th scope="col">필수조건 / 버전</th></tr></thead>
        <tbody>{evaluations.map(({ model, input, result }) => <tr key={result.regionId}>
          <th scope="row">{REGIONS.find((region) => region.id === result.regionId)?.name ?? result.regionId}<small><a href={`/regions/${result.regionId}`}>지표별 원자료와 계산식</a></small></th>
          <td>{formatEvaluationNumber(result.totalScore, '점')}</td>
          <td><span>{formatEvaluationNumber(result.coveragePercent, '%')}</span><small>{result.range.lower.toFixed(1)} ~ {result.range.upper.toFixed(1)}점</small></td>
          <td>{evaluationGateLabel(result.gateStatus)}<small>{result.modelVersion}</small><small>{result.dataVersion}</small><small>{model.weightMethod}</small><small>평가기간 {input.period.start} ~ {input.period.end}</small></td>
        </tr>)}</tbody>
      </table>
    </div>
    <p>지표 정규화 → 영역 안 가중합 → 영역 가중합으로 계산합니다. 결측값의 가중치를 재배분하지 않습니다. 해당 지표의 원자료·기준값·문헌은 권역별 상세 근거에서 확인할 수 있습니다.</p>
  </section>;
}

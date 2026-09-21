export interface Period { start: string; end: string }

export interface IndicatorDefinition {
  id: string;
  label: string;
  unit: string;
  weight: number;
  lower: number;
  upper: number;
  direction: 'benefit' | 'cost';
  benchmarkRationale: string;
  referenceIds: string[];
  denominator: string;
}

export interface DomainDefinition {
  id: string;
  label: string;
  weight: number;
  indicators: IndicatorDefinition[];
}

export interface EvaluationModel {
  version: string;
  status: 'illustrative' | 'provisional';
  weightMethod: string;
  domains: DomainDefinition[];
}

export interface Observation {
  indicatorId: string;
  value: number | null;
  unit: string;
  source: string;
  period: Period;
  scope: string;
  denominator: string;
  kind: 'observed' | 'proxy' | 'example';
}

export interface GateObservation {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'unknown';
  source: string;
}

export interface EvaluationInput {
  regionId: string;
  dataVersion: string;
  period: Period;
  observations: Observation[];
  gates: GateObservation[];
}

export interface IndicatorResult {
  id: string;
  label: string;
  unit: string;
  /** Global weight: domain weight multiplied by the within-domain weight. */
  weight: number;
  value: number | null;
  normalizedScore: number | null;
  contribution: number | null;
  source: string;
  period: Period | null;
  scope: string;
  denominator: string;
  kind: Observation['kind'] | null;
  lower: number;
  upper: number;
  direction: IndicatorDefinition['direction'];
  benchmarkRationale: string;
  referenceIds: string[];
  unavailableReason: string | null;
}

export interface DomainResult {
  id: string;
  label: string;
  weight: number;
  score: number | null;
  contribution: number | null;
  indicators: IndicatorResult[];
}

export interface EvaluationResult {
  modelVersion: string;
  dataVersion: string;
  regionId: string;
  modelStatus: EvaluationModel['status'];
  totalScore: number | null;
  /** Weight coverage, not confidence or a statistical accuracy measure. */
  coveragePercent: number;
  /** Missing-data bounds, not a confidence interval. */
  range: { lower: number; upper: number };
  domains: DomainResult[];
  missingIndicatorIds: string[];
  gateStatus: 'blocked' | 'field-required' | 'reviewable';
  gates: GateObservation[];
  issues: string[];
}

const WEIGHT_TOLERANCE = 1e-9;
const textPresent = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const clean = (value: number): number => Number(value.toFixed(12));

function validPeriod(value: unknown): value is Period {
  if (!value || typeof value !== 'object') return false;
  const { start, end } = value as Period;
  const validDate = (date: unknown): date is string => {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  };
  return validDate(start) && validDate(end) && start <= end;
}

function validateIndicator(definition: IndicatorDefinition): void {
  if (!definition || !textPresent(definition.id) || !textPresent(definition.label)
    || !textPresent(definition.unit) || !textPresent(definition.denominator)
    || !textPresent(definition.benchmarkRationale)
    || !Array.isArray(definition.referenceIds) || definition.referenceIds.length === 0
    || !definition.referenceIds.every(textPresent)
    || !Number.isFinite(definition.lower) || !Number.isFinite(definition.upper)
    || definition.upper <= definition.lower || !Number.isFinite(definition.upper - definition.lower)
    || !['benefit', 'cost'].includes(definition.direction)
    || !Number.isFinite(definition.weight) || definition.weight <= 0) {
    throw new Error('지표 정의에 유효한 기준 범위·가중치·근거·분모가 필요합니다.');
  }
}

function validateWeights(items: Array<{ weight: number }>): void {
  if (items.length === 0 || items.some((item) => !item || !Number.isFinite(item.weight) || item.weight <= 0)
    || Math.abs(items.reduce((sum, item) => sum + item.weight, 0) - 1) > WEIGHT_TOLERANCE) {
    throw new Error('모든 가중치는 양수이고 같은 수준에서 합계가 1이어야 합니다.');
  }
}

function validateModel(model: EvaluationModel): Set<string> {
  if (!model || !textPresent(model.version) || !textPresent(model.weightMethod)
    || !['illustrative', 'provisional'].includes(model.status) || !Array.isArray(model.domains)) {
    throw new Error('유효한 평가모형 정보가 필요합니다.');
  }
  validateWeights(model.domains);
  const domainIds = new Set<string>();
  const indicatorIds = new Set<string>();
  for (const domain of model.domains) {
    if (!textPresent(domain.id) || !textPresent(domain.label) || domainIds.has(domain.id) || !Array.isArray(domain.indicators)) {
      throw new Error('평가영역은 중복 없는 ID·이름·지표 목록을 가져야 합니다.');
    }
    domainIds.add(domain.id);
    validateWeights(domain.indicators);
    for (const definition of domain.indicators) {
      validateIndicator(definition);
      if (indicatorIds.has(definition.id)) throw new Error(`중복 지표 ID: ${definition.id}`);
      indicatorIds.add(definition.id);
    }
  }
  return indicatorIds;
}

/** R7/R8 motivate transparent normalization and aggregation; these fixed bounds are a project choice. */
export function normalizeIndicator(value: number, definition: IndicatorDefinition): number {
  validateIndicator(definition);
  if (!Number.isFinite(value)) throw new Error('정규화할 값은 유한한 숫자여야 합니다.');
  const clipped = Math.max(definition.lower, Math.min(definition.upper, value));
  const benefit = (clipped - definition.lower) / (definition.upper - definition.lower);
  return clean(100 * (definition.direction === 'benefit' ? benefit : 1 - benefit));
}

function unavailableReason(observation: Observation | undefined, definition: IndicatorDefinition, model: EvaluationModel, input: EvaluationInput): string | null {
  if (!observation || observation.value === null) return '관측값이 등록되지 않았습니다.';
  if (!Number.isFinite(observation.value)) return '관측값은 유한한 숫자여야 합니다.';
  if (!textPresent(observation.source)) return '관측 출처가 등록되지 않았습니다.';
  if (observation.unit !== definition.unit) return '관측 단위가 지표 정의와 다릅니다.';
  if (observation.scope !== input.regionId) return '관측의 공간 범위가 평가 권역과 다릅니다.';
  if (observation.denominator !== definition.denominator) return '관측 분모가 지표 정의와 다릅니다.';
  if (!validPeriod(observation.period) || observation.period.start !== input.period.start || observation.period.end !== input.period.end) {
    return '관측 기간이 유효하지 않거나 평가 기간과 다릅니다.';
  }
  if (!['observed', 'proxy', 'example'].includes(observation.kind)) return '관측 종류가 유효하지 않습니다.';
  if (observation.kind === 'example' && model.status !== 'illustrative') return '예시 관측값은 시연 모형에서만 사용할 수 있습니다.';
  return null;
}

/** Missing weights remain unknown. No redistribution, causal claim, or statistical confidence is implied. */
export function evaluateRegion(model: EvaluationModel, input: EvaluationInput): EvaluationResult {
  const indicatorIds = validateModel(model);
  if (!input || !textPresent(input.regionId) || !textPresent(input.dataVersion) || !validPeriod(input.period)
    || !Array.isArray(input.observations) || !Array.isArray(input.gates)) {
    throw new Error('평가 권역·자료 버전·유효한 평가 기간과 관측 목록이 필요합니다.');
  }
  const observations = new Map<string, Observation>();
  for (const observation of input.observations) {
    if (!observation || !indicatorIds.has(observation.indicatorId)) throw new Error('정의되지 않은 지표 관측값입니다.');
    if (observations.has(observation.indicatorId)) throw new Error(`중복 관측값: ${observation.indicatorId}`);
    observations.set(observation.indicatorId, observation);
  }
  const issues: string[] = [];
  const missingIndicatorIds: string[] = [];
  let knownWeight = 0;
  let knownContribution = 0;
  const domains = model.domains.map((domain): DomainResult => {
    let domainScore = 0;
    let complete = true;
    const indicators = domain.indicators.map((definition): IndicatorResult => {
      const observation = observations.get(definition.id);
      const reason = unavailableReason(observation, definition, model, input);
      const weight = domain.weight * definition.weight;
      const normalizedScore = reason ? null : normalizeIndicator(observation!.value!, definition);
      if (normalizedScore === null) {
        complete = false;
        missingIndicatorIds.push(definition.id);
        issues.push(`${definition.label}: ${reason}`);
      } else {
        knownWeight += weight;
        knownContribution += normalizedScore * weight;
        domainScore += normalizedScore * definition.weight;
      }
      return {
        ...definition, referenceIds: [...definition.referenceIds], weight: clean(weight),
        value: observation && Number.isFinite(observation.value) ? observation.value : null,
        normalizedScore, contribution: normalizedScore === null ? null : clean(normalizedScore * weight),
        source: typeof observation?.source === 'string' ? observation.source : '',
        period: validPeriod(observation?.period) ? { ...observation.period } : null,
        scope: typeof observation?.scope === 'string' ? observation.scope : '',
        denominator: typeof observation?.denominator === 'string' ? observation.denominator : definition.denominator,
        kind: observation && ['observed', 'proxy', 'example'].includes(observation.kind) ? observation.kind : null,
        unavailableReason: reason,
      };
    });
    return { id: domain.id, label: domain.label, weight: domain.weight, indicators,
      score: complete ? clean(domainScore) : null,
      contribution: complete ? clean(domainScore * domain.weight) : null };
  });

  const gateIds = new Set<string>();
  const gates = input.gates.map((gate): GateObservation => {
    if (!gate || !textPresent(gate.id) || !textPresent(gate.label) || gateIds.has(gate.id)
      || !['pass', 'fail', 'unknown'].includes(gate.status) || typeof gate.source !== 'string') {
      throw new Error('필수조건은 중복 없는 ID와 유효한 상태·출처 형식을 가져야 합니다.');
    }
    gateIds.add(gate.id);
    if (gate.status !== 'unknown' && !textPresent(gate.source)) {
      issues.push(`${gate.label}: 판정 근거가 없어 현장 확인이 필요합니다.`);
      return { ...gate, status: 'unknown' };
    }
    return { ...gate };
  });
  const complete = missingIndicatorIds.length === 0;
  const bounded = (value: number) => clean(Math.max(0, Math.min(100, value)));
  const lower = bounded(knownContribution);
  return {
    modelVersion: model.version, dataVersion: input.dataVersion, regionId: input.regionId, modelStatus: model.status,
    totalScore: complete ? lower : null,
    coveragePercent: bounded(knownWeight * 100),
    range: { lower, upper: complete ? lower : bounded(knownContribution + 100 * (1 - knownWeight)) },
    domains, missingIndicatorIds, gates, issues,
    gateStatus: gates.some((gate) => gate.status === 'fail') ? 'blocked'
      : complete && gates.length > 0 && gates.every((gate) => gate.status === 'pass') ? 'reviewable' : 'field-required',
  };
}

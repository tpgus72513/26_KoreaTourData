const SUCCESS_RESULT_CODE = '0000';

export const KTO_BASE_URL = 'https://apis.data.go.kr/B551011';

export class TourismApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TourismApiError';
  }
}

type TourismRequestOptions = {
  endpoint: string;
  fetchImpl: typeof fetch;
  params: Record<string, string | number | undefined>;
  serviceKey: string;
};

export async function requestTourismJson({
  endpoint,
  fetchImpl,
  params,
  serviceKey,
}: TourismRequestOptions): Promise<unknown> {
  if (!serviceKey.trim()) {
    throw new TourismApiError('Tourism API service key is required');
  }

  const url = new URL(`${KTO_BASE_URL}/${endpoint}`);
  url.search = new URLSearchParams({
    serviceKey,
    MobileOS: 'ETC',
    MobileApp: 'WithLocal',
    _type: 'json',
    ...Object.fromEntries(
      Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    ),
  }).toString();

  let response: Response;
  try {
    response = await fetchImpl(url.toString());
  } catch {
    throw new TourismApiError('Tourism API request failed');
  }

  if (!response.ok) {
    throw new TourismApiError(`Tourism API request failed (HTTP ${response.status})`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TourismApiError('Tourism API returned invalid JSON');
  }

  assertProviderSuccess(payload);
  return payload;
}

export function responseItems(payload: unknown): unknown[] {
  const item = getPath(payload, ['response', 'body', 'items', 'item']);
  if (item === undefined || item === null) {
    return [];
  }

  return Array.isArray(item) ? item : [item];
}

export function responseTotalCount(payload: unknown): number {
  const totalCount = getPath(payload, ['response', 'body', 'totalCount']);
  const parsed = toFiniteNumber(totalCount);
  return parsed !== undefined && parsed >= 0 ? Math.floor(parsed) : 0;
}

export function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized === '' ? undefined : normalized;
}

function assertProviderSuccess(payload: unknown): void {
  const resultCode = toNonEmptyString(getPath(payload, ['response', 'header', 'resultCode']));
  if (resultCode === SUCCESS_RESULT_CODE) {
    return;
  }

  const resultMessage = toNonEmptyString(
    getPath(payload, ['response', 'header', 'resultMsg']),
  );
  const description = resultMessage ?? 'unknown provider error';
  throw new TourismApiError(`Tourism API error ${resultCode ?? 'unknown'}: ${description}`);
}

function getPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

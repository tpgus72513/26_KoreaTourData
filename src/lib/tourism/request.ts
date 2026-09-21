const SUCCESS_RESULT_CODE = '0000';
const REQUEST_TIMEOUT_MS = 10_000;

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
  signal?: AbortSignal;
};

export async function requestTourismJson({
  endpoint,
  fetchImpl,
  params,
  serviceKey,
  signal,
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

  return withTourismDeadline(async (requestSignal) => {
    let response: Response;
    try {
      response = await fetchImpl(url.toString(), { signal: requestSignal });
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
  }, REQUEST_TIMEOUT_MS, signal);
}

/** Includes response-body consumption and aborts sibling work when the caller fails. */
export async function withTourismDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parentSignal?.aborted) {
    throw new TourismApiError('Tourism API request aborted');
  }
  parentSignal?.addEventListener('abort', abort, { once: true });
  const interrupted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener('abort', () => reject(new TourismApiError('Tourism API deadline exceeded or request aborted')), { once: true });
  });
  const timer = setTimeout(abort, timeoutMs);
  try {
    return await Promise.race([operation(controller.signal), interrupted]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', abort);
    controller.abort();
  }
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
  if (parsed === undefined || !Number.isSafeInteger(parsed) || parsed < 0) {
    throw new TourismApiError('Tourism API returned invalid totalCount');
  }
  return parsed;
}

export function validateResponsePage(payload: unknown, pageNo: number, pageSize: number, totalCount: number): unknown[] {
  if (responseTotalCount(payload) !== totalCount) {
    throw new TourismApiError('Tourism API totalCount changed during pagination');
  }
  const items = responseItems(payload);
  const expectedCount = Math.min(pageSize, Math.max(0, totalCount - (pageNo - 1) * pageSize));
  if (items.length !== expectedCount) {
    throw new TourismApiError('Tourism API returned an incomplete or inconsistent page');
  }
  return items;
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

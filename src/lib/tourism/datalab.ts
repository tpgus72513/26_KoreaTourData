import {
  requestTourismJson,
  responseItems,
  responseTotalCount,
  toFiniteNumber,
  toNonEmptyString,
  TourismApiError,
  validateResponsePage,
} from './request';

const DATA_LAB_ENDPOINT = 'DataLabService/locgoRegnVisitrDDList';
const ROWS_PER_PAGE = 1000;
const MAX_PAGES_PER_REQUEST = 10;
const MAX_DAYS_PER_REQUEST = 7;
const MAX_DATE_WINDOWS = 5;

export type VisitorRecord = {
  baseYmd: string;
  signguCode: string;
  signguNm: string;
  visitorType: string;
  count: number;
};

export type FetchAndongVisitorsOptions = {
  serviceKey: string;
  startYmd: string;
  endYmd: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

export function normalizeVisitorItems(payload: unknown): VisitorRecord[] {
  return responseItems(payload).flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const baseYmd = toNonEmptyString(record.baseYmd);
    const signguCode = toNonEmptyString(record.signguCode);
    const signguNm = toNonEmptyString(record.signguNm);
    const visitorType = toNonEmptyString(record.touDivCd);
    const count = toFiniteNumber(record.touNum);

    if (
      baseYmd === undefined ||
      signguCode === undefined ||
      signguNm === undefined ||
      visitorType === undefined ||
      count === undefined ||
      count < 0
    ) {
      return [];
    }

    return [{ baseYmd, signguCode, signguNm, visitorType, count }];
  });
}

export async function fetchAndongVisitors({
  serviceKey,
  startYmd,
  endYmd,
  fetchImpl = fetch,
  signal,
}: FetchAndongVisitorsOptions): Promise<VisitorRecord[]> {
  const windows = splitDateWindows(startYmd, endYmd);
  const records: VisitorRecord[] = [];
  const identities = new Set<string>();

  for (const window of windows) {
    const firstPage = await fetchVisitorPage({
      serviceKey,
      startYmd: window.startYmd,
      endYmd: window.endYmd,
      pageNo: 1,
      fetchImpl,
      signal,
    });
    const totalCount = responseTotalCount(firstPage);
    const totalPages = pageCount(totalCount);
    const appendPage = (payload: unknown, pageNo: number) => {
      const rawItems = validateResponsePage(payload, pageNo, ROWS_PER_PAGE, totalCount);
      const normalized = normalizeVisitorItems(payload);
      if (normalized.length !== rawItems.length) {
        throw new TourismApiError('Tourism API returned invalid visitor records');
      }
      for (const record of normalized) {
        parseYmd(record.baseYmd);
        if (record.baseYmd < window.startYmd || record.baseYmd > window.endYmd) {
          throw new TourismApiError('Tourism API returned visitors outside the requested date window');
        }
        const identity = `${record.baseYmd}:${record.signguCode}:${record.visitorType}`;
        if (identities.has(identity)) {
          throw new TourismApiError('Tourism API returned duplicate visitor records');
        }
        identities.add(identity);
        records.push(record);
      }
    };
    appendPage(firstPage, 1);

    for (let pageNo = 2; pageNo <= totalPages; pageNo += 1) {
      const page = await fetchVisitorPage({
        serviceKey,
        startYmd: window.startYmd,
        endYmd: window.endYmd,
        pageNo,
        fetchImpl,
        signal,
      });
      appendPage(page, pageNo);
    }
  }

  return records.filter((record) => record.signguNm === '안동시');
}

async function fetchVisitorPage({
  serviceKey,
  startYmd,
  endYmd,
  pageNo,
  fetchImpl,
  signal,
}: {
  serviceKey: string;
  startYmd: string;
  endYmd: string;
  pageNo: number;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
}): Promise<unknown> {
  return requestTourismJson({
    endpoint: DATA_LAB_ENDPOINT,
    serviceKey,
    fetchImpl,
    signal,
    params: { startYmd, endYmd, numOfRows: ROWS_PER_PAGE, pageNo },
  });
}

function pageCount(totalCount: number): number {
  const pages = Math.max(1, Math.ceil(totalCount / ROWS_PER_PAGE));
  if (pages > MAX_PAGES_PER_REQUEST) {
    throw new TourismApiError('Tourism API pagination limit exceeded');
  }
  return pages;
}

function splitDateWindows(startYmd: string, endYmd: string): Array<{ startYmd: string; endYmd: string }> {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (start > end) {
    throw new TourismApiError('startYmd must not be after endYmd');
  }

  const windows: Array<{ startYmd: string; endYmd: string }> = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, MAX_DAYS_PER_REQUEST)) {
    const windowEnd = new Date(Math.min(addDays(cursor, MAX_DAYS_PER_REQUEST - 1).getTime(), end.getTime()));
    windows.push({ startYmd: formatYmd(cursor), endYmd: formatYmd(windowEnd) });
  }
  if (windows.length > MAX_DATE_WINDOWS) {
    throw new TourismApiError('Tourism API date-window limit exceeded');
  }
  return windows;
}

function parseYmd(value: string): Date {
  if (!/^\d{8}$/.test(value)) {
    throw new TourismApiError('Dates must use YYYYMMDD format');
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (formatYmd(date) !== value) {
    throw new TourismApiError('Dates must be valid calendar dates');
  }
  return date;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

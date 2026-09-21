import type { TourismPlace, TourismPlaceCategory } from '../domain';

import {
  requestTourismJson,
  responseItems,
  responseTotalCount,
  toFiniteNumber,
  toNonEmptyString,
  TourismApiError,
  validateResponsePage,
} from './request';

const AREA_CODE_ENDPOINT = 'KorService2/areaCode2';
const AREA_BASED_LIST_ENDPOINT = 'KorService2/areaBasedList2';
const ROWS_PER_PAGE = 100;
const MAX_PAGES_PER_REQUEST = 20;
const SOURCE = 'KTO KorService2/areaBasedList2';

export type FetchAndongPlacesOptions = {
  serviceKey: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

export function normalizePlaceItems(payload: unknown): TourismPlace[] {
  return responseItems(payload).flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const id = toNonEmptyString(record.contentid);
    const name = toNonEmptyString(record.title);
    const longitude = toFiniteNumber(record.mapx);
    const latitude = toFiniteNumber(record.mapy);

    if (
      id === undefined ||
      name === undefined ||
      longitude === undefined ||
      latitude === undefined ||
      !isCoordinatePair(latitude, longitude)
    ) {
      return [];
    }

    return [
      {
        id,
        name,
        category: categoryFromContentType(record.contenttypeid),
        latitude,
        longitude,
        regionId: null,
        evidenceStatus: 'verified',
        source: SOURCE,
        address: toNonEmptyString(record.addr1) ?? null,
      },
    ];
  });
}

export async function fetchAndongPlaces({
  serviceKey,
  fetchImpl = fetch,
  signal,
}: FetchAndongPlacesOptions): Promise<TourismPlace[]> {
  const provinceCode = await findSingleAreaCode({
    serviceKey,
    fetchImpl,
    signal,
    expectedName: '경상북도',
  });
  const andongCode = await findSingleAreaCode({
    serviceKey,
    fetchImpl,
    signal,
    areaCode: provinceCode,
    expectedName: '안동시',
  });

  const firstPage = await fetchPlacesPage({
    serviceKey,
    fetchImpl,
    signal,
    areaCode: provinceCode,
    sigunguCode: andongCode,
    pageNo: 1,
  });
  const totalCount = responseTotalCount(firstPage);
  const pages = pageCount(totalCount);
  const places: TourismPlace[] = [];
  const identities = new Set<string>();
  const appendPage = (payload: unknown, pageNo: number) => {
    const rawItems = validateResponsePage(payload, pageNo, ROWS_PER_PAGE, totalCount);
    for (const item of rawItems) {
      const record = typeof item === 'object' && item !== null && !Array.isArray(item)
        ? item as Record<string, unknown> : undefined;
      const id = toNonEmptyString(record?.contentid);
      if (id === undefined || toNonEmptyString(record?.title) === undefined) {
        throw new TourismApiError('Tourism API returned invalid content identity');
      }
      if (identities.has(id)) {
        throw new TourismApiError('Tourism API returned duplicate content IDs');
      }
      identities.add(id);
    }
    places.push(...normalizePlaceItems(payload));
  };
  appendPage(firstPage, 1);

  for (let pageNo = 2; pageNo <= pages; pageNo += 1) {
    const page = await fetchPlacesPage({
      serviceKey,
      fetchImpl,
      signal,
      areaCode: provinceCode,
      sigunguCode: andongCode,
      pageNo,
    });
    appendPage(page, pageNo);
  }

  return places;
}

async function findSingleAreaCode({
  serviceKey,
  fetchImpl,
  expectedName,
  areaCode,
  signal,
}: {
  serviceKey: string;
  fetchImpl: typeof fetch;
  expectedName: string;
  areaCode?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const payload = await requestTourismJson({
    endpoint: AREA_CODE_ENDPOINT,
    serviceKey,
    fetchImpl,
    signal,
    params: { areaCode, numOfRows: ROWS_PER_PAGE, pageNo: 1 },
  });
  const totalCount = responseTotalCount(payload);
  if (totalCount > ROWS_PER_PAGE) {
    throw new TourismApiError('Tourism API area-code pagination limit exceeded');
  }
  validateResponsePage(payload, 1, ROWS_PER_PAGE, totalCount);
  const matchingCodes = responseItems(payload).flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const name = toNonEmptyString(record.name);
    const code = toNonEmptyString(record.code);
    return name === expectedName && code !== undefined ? [code] : [];
  });

  if (matchingCodes.length === 0) {
    throw new TourismApiError(`Tourism API did not return a code for ${expectedName}`);
  }
  if (matchingCodes.length > 1) {
    throw new TourismApiError(`Tourism API returned ambiguous codes for ${expectedName}`);
  }
  return matchingCodes[0];
}

async function fetchPlacesPage({
  serviceKey,
  fetchImpl,
  areaCode,
  sigunguCode,
  pageNo,
  signal,
}: {
  serviceKey: string;
  fetchImpl: typeof fetch;
  areaCode: string;
  sigunguCode: string;
  pageNo: number;
  signal?: AbortSignal;
}): Promise<unknown> {
  return requestTourismJson({
    endpoint: AREA_BASED_LIST_ENDPOINT,
    serviceKey,
    fetchImpl,
    signal,
    params: { areaCode, sigunguCode, numOfRows: ROWS_PER_PAGE, pageNo },
  });
}

function pageCount(totalCount: number): number {
  const pages = Math.max(1, Math.ceil(totalCount / ROWS_PER_PAGE));
  if (pages > MAX_PAGES_PER_REQUEST) {
    throw new TourismApiError('Tourism API pagination limit exceeded');
  }
  return pages;
}

function categoryFromContentType(contentType: unknown): TourismPlaceCategory {
  switch (toNonEmptyString(contentType)) {
    case '32':
      return 'accommodation';
    case '39':
      return 'food';
    case '15':
      return 'event';
    default:
      return 'attraction';
  }
}

function isCoordinatePair(latitude: number, longitude: number): boolean {
  // The provider uses (0, 0) when a course/resource has no usable location.
  return !(latitude === 0 && longitude === 0) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

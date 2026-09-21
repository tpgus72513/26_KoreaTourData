import { describe, expect, it, vi } from 'vitest';

import {
  fetchAndongVisitors,
  normalizeVisitorItems,
} from './datalab';

const visitorPayload = (item: unknown, totalCount = 1) => ({
  response: {
    header: { resultCode: '0000', resultMsg: 'NORMAL_SERVICE' },
    body: { totalCount, items: { item } },
  },
});

describe('normalizeVisitorItems', () => {
  it('returns an empty list when items are missing', () => {
    expect(
      normalizeVisitorItems({
        response: { header: { resultCode: '0000' }, body: {} },
      }),
    ).toEqual([]);
  });

  it('normalizes a single item and preserves a literal zero count', () => {
    expect(
      normalizeVisitorItems(
        visitorPayload({
          signguCode: '47170',
          signguNm: '안동시',
          baseYmd: '20260901',
          touDivCd: '2',
          touNum: '0',
        }),
      ),
    ).toEqual([
      {
        baseYmd: '20260901',
        signguCode: '47170',
        signguNm: '안동시',
        visitorType: '2',
        count: 0,
      },
    ]);
  });

  it('normalizes an array while rejecting rows without a visitor count', () => {
    expect(
      normalizeVisitorItems(
        visitorPayload([
          {
            signguCode: '47170',
            signguNm: '안동시',
            baseYmd: '20260901',
            touDivCd: '1',
            touNum: '4.5',
          },
          {
            signguCode: '47170',
            signguNm: '안동시',
            baseYmd: '20260901',
            touDivCd: '2',
          },
        ]),
      ),
    ).toEqual([
      {
        baseYmd: '20260901',
        signguCode: '47170',
        signguNm: '안동시',
        visitorType: '1',
        count: 4.5,
      },
    ]);
  });
});

describe('fetchAndongVisitors', () => {
  it('requests DataLab without a municipality filter and keeps only Andong rows', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          visitorPayload([
            {
              signguCode: '47170',
              signguNm: '안동시',
              baseYmd: '20260901',
              touDivCd: '2',
              touNum: '7',
            },
            {
              signguCode: '11110',
              signguNm: '종로구',
              baseYmd: '20260901',
              touDivCd: '2',
              touNum: '9',
            },
          ]),
        ),
        { status: 200 },
      ),
    );

    await expect(
      fetchAndongVisitors({
        serviceKey: 'test-key',
        startYmd: '20260901',
        endYmd: '20260907',
        fetchImpl,
      }),
    ).resolves.toMatchObject([{ signguNm: '안동시', count: 7 }]);

    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.protocol).toBe('https:');
    expect(url.pathname).toContain('locgoRegnVisitrDDList');
    expect(url.searchParams.get('startYmd')).toBe('20260901');
    expect(url.searchParams.get('endYmd')).toBe('20260907');
    expect(url.searchParams.get('MobileOS')).toBe('ETC');
    expect(url.searchParams.get('MobileApp')).toBe('WithLocal');
    expect(url.searchParams.get('sigunguCode')).toBeNull();
  });

  it('rejects provider errors without issuing later pages', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            header: { resultCode: '30', resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR' },
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      fetchAndongVisitors({
        serviceKey: 'test-key',
        startYmd: '20260901',
        endYmd: '20260901',
        fetchImpl,
      }),
    ).rejects.toThrow('SERVICE_KEY_IS_NOT_REGISTERED_ERROR');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails fast when a response would exceed the bounded page limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(visitorPayload([], 100_000)), { status: 200 }),
    );

    await expect(
      fetchAndongVisitors({
        serviceKey: 'test-key',
        startYmd: '20260901',
        endYmd: '20260901',
        fetchImpl,
      }),
    ).rejects.toThrow('pagination limit');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects an unbounded date range before requesting the provider', async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchAndongVisitors({
        serviceKey: 'test-key',
        startYmd: '20260901',
        endYmd: '20261006',
        fetchImpl,
      }),
    ).rejects.toThrow('date-window limit');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

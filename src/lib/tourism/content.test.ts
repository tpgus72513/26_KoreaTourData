import { describe, expect, it, vi } from 'vitest';

import { fetchAndongPlaces, normalizePlaceItems } from './content';

const contentPayload = (item: unknown, totalCount = Array.isArray(item) ? item.length : 1) => ({
  response: {
    header: { resultCode: '0000', resultMsg: 'NORMAL_SERVICE' },
    body: { totalCount, items: { item } },
  },
});

describe('normalizePlaceItems', () => {
  it('excludes the zero-coordinate sentinel instead of treating it as a located Andong resource', () => {
    expect(normalizePlaceItems(contentPayload({ contentid: '2826888', title: '좌표 미제공 여행 코스', mapx: '0', mapy: '0' }))).toEqual([]);
  });
  it('returns an empty list for missing items or items without coordinates', () => {
    expect(normalizePlaceItems({ response: { body: {} } })).toEqual([]);
    expect(
      normalizePlaceItems(
        contentPayload({
          contentid: '1',
          title: '좌표 없는 장소',
          mapx: '',
          mapy: '36.5',
        }),
      ),
    ).toEqual([]);
  });

  it('normalizes a single place with the API category and source fields', () => {
    expect(
      normalizePlaceItems(
        contentPayload({
          contentid: '126508',
          contenttypeid: '12',
          title: '월영교',
          addr1: '경상북도 안동시 상아동',
          mapx: '128.7742',
          mapy: '36.5682',
        }),
      ),
    ).toEqual([
      {
        id: '126508',
        name: '월영교',
        category: 'attraction',
        latitude: 36.5682,
        longitude: 128.7742,
        regionId: null,
        evidenceStatus: 'verified',
        source: 'KTO KorService2/areaBasedList2',
        address: '경상북도 안동시 상아동',
      },
    ]);
  });
});

describe('fetchAndongPlaces', () => {
  const place = { contentid: 'one', title: '월영교', mapx: '128.7742', mapy: '36.5682' };
  const placeFetch = (...payloads: unknown[]) => {
    const responses = [contentPayload({ code: '35', name: '경상북도' }), contentPayload({ code: '11', name: '안동시' }), ...payloads];
    return vi.fn(async () => new Response(JSON.stringify(responses.shift())));
  };

  it('rejects duplicate content IDs', async () => {
    await expect(fetchAndongPlaces({ serviceKey: 'test', fetchImpl: placeFetch(contentPayload([place, place])) }))
      .rejects.toThrow(/duplicate/i);
  });

  it('rejects an incomplete content page', async () => {
    await expect(fetchAndongPlaces({ serviceKey: 'test', fetchImpl: placeFetch(contentPayload(place, 2)) }))
      .rejects.toThrow(/page/i);
  });

  it('checks raw pagination before filtering coordinate-less places', async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({ ...place, contentid: String(index) }));
    first[0].mapx = '';
    await expect(fetchAndongPlaces({ serviceKey: 'test', fetchImpl: placeFetch(contentPayload(first, 101), contentPayload(place, 101)) }))
      .resolves.toHaveLength(100);
  });

  it('rejects changing totals on later pages', async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({ ...place, contentid: String(index) }));
    await expect(fetchAndongPlaces({ serviceKey: 'test', fetchImpl: placeFetch(contentPayload(first, 101), contentPayload(place, 102)) }))
      .rejects.toThrow(/totalCount/i);
  });

  it('discovers Gyeongbuk and Andong codes before fetching valid coordinate places', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(contentPayload({ code: '35', name: '경상북도' })),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(contentPayload({ code: '47170', name: '안동시' })),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            contentPayload([
              {
                contentid: '126508',
                contenttypeid: '12',
                title: '월영교',
                addr1: '경상북도 안동시 상아동',
                mapx: '128.7742',
                mapy: '36.5682',
              },
              {
                contentid: 'no-coordinates',
                title: '좌표 누락',
                mapx: '',
                mapy: '',
              },
            ]),
          ),
          { status: 200 },
        ),
      );

    await expect(
      fetchAndongPlaces({ serviceKey: 'test-key', fetchImpl }),
    ).resolves.toHaveLength(1);

    const provinceUrl = new URL(fetchImpl.mock.calls[0][0]);
    const cityUrl = new URL(fetchImpl.mock.calls[1][0]);
    const placesUrl = new URL(fetchImpl.mock.calls[2][0]);
    expect(provinceUrl.pathname).toContain('areaCode2');
    expect(cityUrl.searchParams.get('areaCode')).toBe('35');
    expect(placesUrl.pathname).toContain('areaBasedList2');
    expect(placesUrl.searchParams.get('areaCode')).toBe('35');
    expect(placesUrl.searchParams.get('sigunguCode')).toBe('47170');
    expect(placesUrl.searchParams.get('MobileOS')).toBe('ETC');
    expect(placesUrl.searchParams.get('MobileApp')).toBe('WithLocal');
  });

  it('rejects ambiguous Andong codes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(contentPayload({ code: '35', name: '경상북도' })),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            contentPayload([
              { code: '47170', name: '안동시' },
              { code: '99999', name: '안동시' },
            ]),
          ),
          { status: 200 },
        ),
      );

    await expect(
      fetchAndongPlaces({ serviceKey: 'test-key', fetchImpl }),
    ).rejects.toThrow('ambiguous');
  });

  it('rejects provider errors explicitly', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: { header: { resultCode: '22', resultMsg: 'APPLICATION_ERROR' } },
        }),
        { status: 200 },
      ),
    );

    await expect(
      fetchAndongPlaces({ serviceKey: 'test-key', fetchImpl }),
    ).rejects.toThrow('APPLICATION_ERROR');
  });

  it('fails fast rather than exceeding the bounded content page limit', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(contentPayload({ code: '35', name: '경상북도' })),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(contentPayload({ code: '47170', name: '안동시' })),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(contentPayload([], 100_000)), { status: 200 }),
      );

    await expect(
      fetchAndongPlaces({ serviceKey: 'test-key', fetchImpl }),
    ).rejects.toThrow('pagination limit');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

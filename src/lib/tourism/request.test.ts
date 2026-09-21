import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestTourismJson } from './request';

afterEach(() => vi.useRealTimers());

describe('requestTourismJson deadline', () => {
  it.each(['headers', 'body'])('times out stalled %s before the route deadline', async (stage) => {
    vi.useFakeTimers();
    let caught: unknown;
    let signal: AbortSignal | null | undefined;
    const fetchImpl: typeof fetch = async (_url, init) => {
      signal = init?.signal;
      if (stage === 'headers') return new Promise(() => undefined);
      return { ok: true, json: () => new Promise(() => undefined) } as Response;
    };
    const running = requestTourismJson({ endpoint: 'test', serviceKey: 'test', params: {}, fetchImpl })
      .catch((error: unknown) => { caught = error; });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(caught).toBeInstanceOf(Error);
    expect(signal?.aborted).toBe(true);
    await running;
  });
});

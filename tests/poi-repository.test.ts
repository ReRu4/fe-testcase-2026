import { describe, expect, it, vi } from 'vitest';
import { isAbortError, PoiRepository } from '../src/data/poi-repository';

const API_URL = 'https://ru.wikipedia.org/w/api.php';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

function payload(pageid: number): unknown {
  return {
    query: {
      pages: [
        {
          pageid,
          title: `Точка ${pageid}`,
          coordinates: [{ lat: 55.75, lon: 37.62, type: 'landmark' }],
        },
      ],
    },
  };
}

function repository(fetcher: Fetcher, options: { capacity?: number; retryCount?: number } = {}) {
  return new PoiRepository(API_URL, {
    fetcher: fetcher as typeof fetch,
    retryDelayMs: 0,
    ...options,
  });
}

describe('PoiRepository', () => {
  it('объединяет одинаковый активный запрос и затем читает ячейку из кэша', async () => {
    let resolveRequest: ((value: Response) => void) | undefined;
    const fetcher = vi.fn<Fetcher>(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const points = repository(fetcher);

    const first = points.loadAround([37.62, 55.75]);
    const second = points.loadAround([37.621, 55.751]);
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveRequest?.(response(payload(1)));
    await expect(first).resolves.toMatchObject({ fromCache: false });
    await expect(second).resolves.toMatchObject({ fromCache: false });

    const cached = await points.loadAround([37.619, 55.749]);
    expect(cached.fromCache).toBe(true);
    expect(cached.points).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('накапливает точки соседних ячеек и дедуплицирует их по ID', async () => {
    const fetcher = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(response(payload(1)))
      .mockResolvedValueOnce(
        response({
          query: {
            pages: [
              ...(payload(1) as { query: { pages: unknown[] } }).query.pages,
              ...(payload(2) as { query: { pages: unknown[] } }).query.pages,
            ],
          },
        }),
      );
    const points = repository(fetcher);

    await points.loadAround([37.62, 55.75]);
    const result = await points.loadAround([38.62, 56.75]);

    expect(result.points.map((point) => point.id)).toEqual([
      'https://ru.wikipedia.org/w/api.php#1',
      'https://ru.wikipedia.org/w/api.php#2',
    ]);
  });

  it('вытесняет давно не использованную ячейку по LRU', async () => {
    let requestNumber = 0;
    const fetcher = vi.fn<Fetcher>(async () => response(payload(++requestNumber)));
    const points = repository(fetcher, { capacity: 2 });

    await points.loadAround([0, 0]);
    await points.loadAround([1, 1]);
    await points.loadAround([0, 0]);
    await points.loadAround([2, 2]);
    await points.loadAround([1, 1]);

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(points.getCachedPoints()).toHaveLength(2);
  });

  it('отменяет запрос предыдущей ячейки при новом перемещении', async () => {
    let requestNumber = 0;
    const fetcher = vi.fn<Fetcher>((_input, init) => {
      requestNumber += 1;
      if (requestNumber === 2) return Promise.resolve(response(payload(2)));

      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError')));
      });
    });
    const points = repository(fetcher);
    const firstOutcome = points.loadAround([0, 0]).catch((error: unknown) => error);

    const second = await points.loadAround([1, 1]);
    const firstError = await firstOutcome;

    expect(isAbortError(firstError)).toBe(true);
    expect(second.points).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('повторяет временную ошибку один раз, но не повторяет HTTP 400', async () => {
    const transientFetcher = vi
      .fn<Fetcher>()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response(payload(1)));
    const transientPoints = repository(transientFetcher);

    await expect(transientPoints.loadAround([0, 0])).resolves.toMatchObject({
      fromCache: false,
    });
    expect(transientFetcher).toHaveBeenCalledTimes(2);

    const invalidFetcher = vi.fn<Fetcher>().mockResolvedValue(response({}, 400));
    const invalidPoints = repository(invalidFetcher);

    await expect(invalidPoints.loadAround([0, 0])).rejects.toThrow(
      'Wikipedia API вернул HTTP 400',
    );
    expect(invalidFetcher).toHaveBeenCalledTimes(1);
  });

  it('не продолжает retry после явной отмены', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<Fetcher>().mockResolvedValue(response({}, 503));
    const points = new PoiRepository(API_URL, {
      fetcher: fetcher as typeof fetch,
      retryDelayMs: 10_000,
    });
    const outcome = points.loadAround([0, 0]).catch((error: unknown) => error);

    await Promise.resolve();
    await Promise.resolve();
    points.abort();
    const error = await outcome;
    await vi.advanceTimersByTimeAsync(10_000);

    expect(isAbortError(error)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

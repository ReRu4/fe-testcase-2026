import type { Coordinates, Poi } from '../types';
import { buildWikipediaUrl, parseWikipediaResponse } from './wikipedia';

const CELL_SIZE_DEGREES = 0.06;
const DEFAULT_CACHE_CAPACITY = 24;
const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_RETRY_DELAY_MS = 300;
const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export interface PoiLoadResult {
  readonly points: readonly Poi[];
  readonly fromCache: boolean;
}

export interface PoiRepositoryOptions {
  readonly fetcher?: typeof fetch;
  readonly capacity?: number;
  readonly retryCount?: number;
  readonly retryDelayMs?: number;
}

interface InFlightRequest {
  readonly controller: AbortController;
  readonly promise: Promise<readonly Poi[]>;
}

class WikipediaHttpError extends Error {
  public constructor(public readonly status: number) {
    super(`Wikipedia API вернул HTTP ${status}`);
    this.name = 'WikipediaHttpError';
  }
}

function cellFor(center: Coordinates): { key: string; center: Coordinates } {
  const [longitude, latitude] = center;
  const cellLongitude = Math.round(longitude / CELL_SIZE_DEGREES) * CELL_SIZE_DEGREES;
  const cellLatitude = Math.round(latitude / CELL_SIZE_DEGREES) * CELL_SIZE_DEGREES;

  return {
    key: `${cellLongitude.toFixed(2)}:${cellLatitude.toFixed(2)}`,
    center: [cellLongitude, cellLatitude],
  };
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : fallback;
}

function createAbortError(): DOMException {
  return new DOMException('Операция отменена', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error || (typeof error === 'object' && error !== null)) &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

function isRetryable(error: unknown): boolean {
  return (
    (error instanceof WikipediaHttpError && RETRYABLE_HTTP_STATUSES.has(error.status)) ||
    error instanceof TypeError
  );
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', onAbort);
      reject(createAbortError());
    };
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export class PoiRepository {
  private readonly cache = new Map<string, readonly Poi[]>();
  private readonly inFlight = new Map<string, InFlightRequest>();
  private readonly fetcher: typeof fetch;
  private readonly capacity: number;
  private readonly retryCount: number;
  private readonly retryDelayMs: number;
  private activeRequest: { key: string; controller: AbortController } | null = null;

  public constructor(
    private readonly apiBaseUrl: string,
    options: PoiRepositoryOptions = {},
  ) {
    this.fetcher = options.fetcher ?? fetch;
    this.capacity = positiveInteger(options.capacity, DEFAULT_CACHE_CAPACITY);
    this.retryCount = nonNegativeInteger(options.retryCount, DEFAULT_RETRY_COUNT);
    this.retryDelayMs = nonNegativeInteger(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS);
  }

  public async loadAround(center: Coordinates): Promise<PoiLoadResult> {
    const cell = cellFor(center);
    const cached = this.cache.get(cell.key);

    if (cached) {
      this.touch(cell.key, cached);
      return { points: this.getCachedPoints(), fromCache: true };
    }

    const running = this.inFlight.get(cell.key);
    if (running && !running.controller.signal.aborted) {
      await running.promise;
      return { points: this.getCachedPoints(), fromCache: false };
    }
    if (running) this.inFlight.delete(cell.key);

    if (this.activeRequest && this.activeRequest.key !== cell.key) {
      this.activeRequest.controller.abort();
    }

    const controller = new AbortController();
    this.activeRequest = { key: cell.key, controller };
    const request = this.fetchCell(cell.center, controller.signal).then((points) => {
      if (controller.signal.aborted) throw createAbortError();
      this.touch(cell.key, points);
      this.prune();
      return points;
    });
    this.inFlight.set(cell.key, { controller, promise: request });

    try {
      await request;
      return { points: this.getCachedPoints(), fromCache: false };
    } finally {
      if (this.inFlight.get(cell.key)?.promise === request) this.inFlight.delete(cell.key);
      if (this.activeRequest?.controller === controller) this.activeRequest = null;
    }
  }

  public getCachedPoints(): Poi[] {
    const unique = new Map<string, Poi>();
    for (const points of this.cache.values()) {
      for (const point of points) unique.set(point.id, point);
    }
    return [...unique.values()];
  }

  public abort(): void {
    this.activeRequest?.controller.abort();
    this.activeRequest = null;
  }

  private async fetchCell(center: Coordinates, signal: AbortSignal): Promise<readonly Poi[]> {
    let attempt = 0;

    while (true) {
      if (signal.aborted) throw createAbortError();

      try {
        const response = await this.fetcher(buildWikipediaUrl(this.apiBaseUrl, center), {
          signal,
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) throw new WikipediaHttpError(response.status);

        const payload: unknown = await response.json();
        if (signal.aborted) throw createAbortError();
        return parseWikipediaResponse(payload, this.apiBaseUrl);
      } catch (error) {
        if (isAbortError(error) || signal.aborted) throw createAbortError();
        if (!isRetryable(error) || attempt >= this.retryCount) {
          throw error instanceof Error ? error : new Error('Не удалось загрузить точки');
        }

        attempt += 1;
        await waitForRetry(this.retryDelayMs, signal);
      }
    }
  }

  private touch(key: string, points: readonly Poi[]): void {
    this.cache.delete(key);
    this.cache.set(key, points);
  }

  private prune(): void {
    while (this.cache.size > this.capacity) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest === undefined) return;
      this.cache.delete(oldest);
    }
  }
}

import type { Coordinates, Poi } from '../types';
import { buildWikipediaUrl, parseWikipediaResponse } from './wikipedia';

const CELL_SIZE_DEGREES = 0.06;
const DEFAULT_CACHE_CAPACITY = 24;

export interface PoiLoadResult {
  readonly points: readonly Poi[];
  readonly fromCache: boolean;
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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export class PoiRepository {
  private readonly cache = new Map<string, readonly Poi[]>();
  private readonly inFlight = new Map<string, Promise<readonly Poi[]>>();
  private activeRequest: { key: string; controller: AbortController } | null = null;

  public constructor(
    private readonly apiBaseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly capacity = DEFAULT_CACHE_CAPACITY,
  ) {}

  public async loadAround(center: Coordinates): Promise<PoiLoadResult> {
    const cell = cellFor(center);
    const cached = this.cache.get(cell.key);

    if (cached) {
      this.touch(cell.key, cached);
      return { points: cached, fromCache: true };
    }

    const running = this.inFlight.get(cell.key);
    if (running) return { points: await running, fromCache: false };

    if (this.activeRequest && this.activeRequest.key !== cell.key) {
      this.activeRequest.controller.abort();
    }

    const controller = new AbortController();
    this.activeRequest = { key: cell.key, controller };
    const request = this.fetchCell(cell.center, controller.signal);
    this.inFlight.set(cell.key, request);

    try {
      const points = await request;
      this.touch(cell.key, points);
      this.prune();
      return { points, fromCache: false };
    } finally {
      this.inFlight.delete(cell.key);
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
    try {
      const response = await this.fetcher(buildWikipediaUrl(this.apiBaseUrl, center), {
        signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Wikipedia API вернул HTTP ${response.status}`);
      }

      const payload: unknown = await response.json();
      return parseWikipediaResponse(payload, this.apiBaseUrl);
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw error instanceof Error ? error : new Error('Не удалось загрузить точки');
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


import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import type { PoiLoadResult, PoiRepository } from '../src/data/poi-repository';
import {
  createMapDataController,
  DATA_DEBOUNCE_MS,
  type MapDataControllerDependencies,
} from '../src/map/map-data-controller';
import type { Poi } from '../src/types';

function point(id: string): Poi {
  return {
    id,
    title: `Точка ${id}`,
    coordinates: [37.62, 55.75],
    articleUrl: `https://example.com/${id}`,
    rarity: 'common',
    basePoints: 10,
  };
}

function result(points: readonly Poi[], fromCache = false): PoiLoadResult {
  return { points, fromCache };
}

class FakeMap {
  public zoom = 14;
  public center = { lng: 37.62, lat: 55.75 };
  public readonly listeners = new Map<string, () => void>();
  public readonly getZoom = vi.fn(() => this.zoom);
  public readonly getCenter = vi.fn(() => this.center);
  public readonly getContainer = vi.fn(() => document.createElement('div'));

  public on(type: string, listener: () => void): this {
    this.listeners.set(type, listener);
    return this;
  }

  public off(type: string): this {
    this.listeners.delete(type);
    return this;
  }

  public emit(type: string): void {
    this.listeners.get(type)?.();
  }
}

function createHarness(loadAround: ReturnType<typeof vi.fn>) {
  const map = new FakeMap();
  const repository = {
    loadAround,
    abort: vi.fn(),
  } as unknown as PoiRepository;
  const layer = {
    setPoints: vi.fn(),
    setHeatmapVisible: vi.fn(),
    clearSelection: vi.fn(),
    destroy: vi.fn(),
  };
  const scheduled = new Map<number, () => void>();
  let nextTimer = 1;
  const dependencies: MapDataControllerDependencies = {
    createLayer: vi.fn(() => layer),
    schedule: vi.fn((callback) => {
      const id = nextTimer++;
      scheduled.set(id, callback);
      return id;
    }),
    cancel: vi.fn((id) => scheduled.delete(id)),
  };
  const options = {
    onStatus: vi.fn(),
    onLoaded: vi.fn(),
    onError: vi.fn(),
    onPoiSelect: vi.fn(),
    collectRadiusMeters: 50,
    onPlayerPosition: vi.fn(() => new Set<string>()),
  };

  return { map, repository, layer, scheduled, dependencies, options };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('MapDataController', () => {
  it('загружает центр, объединяет быстрые moveend и останавливается на далёком zoom', async () => {
    const firstPoint = point('first');
    const secondPoint = point('second');
    const loadAround = vi
      .fn()
      .mockResolvedValueOnce(result([firstPoint]))
      .mockResolvedValueOnce(result([firstPoint, secondPoint], true));
    const harness = createHarness(loadAround);
    const controller = createMapDataController(
      harness.map as unknown as MapLibreMap,
      harness.repository,
      harness.options,
      harness.dependencies,
    );
    await flushPromises();

    expect(loadAround).toHaveBeenCalledWith([37.62, 55.75]);
    expect(harness.layer.setPoints).toHaveBeenLastCalledWith(
      [firstPoint],
      expect.objectContaining({ player: [37.62, 55.75], collectRadiusMeters: 50 }),
    );

    harness.map.center = { lng: 38, lat: 56 };
    controller.refresh();
    harness.map.emit('moveend');
    expect(harness.dependencies.schedule).toHaveBeenLastCalledWith(
      expect.any(Function),
      DATA_DEBOUNCE_MS,
    );
    expect(harness.dependencies.cancel).toHaveBeenCalledTimes(1);
    [...harness.scheduled.values()].at(-1)?.();
    await flushPromises();

    expect(loadAround).toHaveBeenLastCalledWith([38, 56]);
    expect(harness.options.onLoaded).toHaveBeenLastCalledWith(
      result([firstPoint, secondPoint], true),
    );

    harness.map.zoom = 10;
    harness.map.emit('moveend');
    [...harness.scheduled.values()].at(-1)?.();
    await flushPromises();

    expect(loadAround).toHaveBeenCalledTimes(2);
    expect(harness.repository.abort).toHaveBeenCalledTimes(1);
    expect(harness.options.onStatus).toHaveBeenLastCalledWith({ type: 'zoom', count: 2 });

    controller.clearSelection();
    controller.setHeatmapVisible(true);
    controller.destroy();
    controller.destroy();
    expect(harness.layer.clearSelection).toHaveBeenCalledTimes(1);
    expect(harness.layer.setHeatmapVisible).toHaveBeenCalledWith(true);
    expect(harness.layer.destroy).toHaveBeenCalledTimes(1);
    expect(harness.map.listeners.size).toBe(0);
  });

  it('оставляет последний успешный GeoJSON при ошибке новой области', async () => {
    const firstPoint = point('first');
    const loadAround = vi
      .fn()
      .mockResolvedValueOnce(result([firstPoint]))
      .mockRejectedValueOnce(new Error('API недоступен'));
    const harness = createHarness(loadAround);
    createMapDataController(
      harness.map as unknown as MapLibreMap,
      harness.repository,
      harness.options,
      harness.dependencies,
    );
    await flushPromises();

    harness.map.emit('moveend');
    [...harness.scheduled.values()].at(-1)?.();
    await flushPromises();

    expect(harness.layer.setPoints.mock.calls.at(-1)?.[0]).toEqual([firstPoint]);
    expect(harness.options.onStatus).toHaveBeenLastCalledWith({
      type: 'error',
      count: 1,
      message: 'API недоступен',
    });
    expect(harness.options.onError).toHaveBeenCalledWith('API недоступен');
  });

  it('сразу загружает явно заданный центр без ожидания debounce', async () => {
    const loadAround = vi
      .fn()
      .mockResolvedValueOnce(result([point('moscow')]))
      .mockResolvedValueOnce(result([point('petersburg')]));
    const harness = createHarness(loadAround);
    const controller = createMapDataController(
      harness.map as unknown as MapLibreMap,
      harness.repository,
      harness.options,
      harness.dependencies,
    );
    await flushPromises();

    controller.refresh([30.3141, 59.9386]);
    await flushPromises();

    expect(loadAround).toHaveBeenLastCalledWith([30.3141, 59.9386]);
    expect(harness.dependencies.schedule).not.toHaveBeenCalled();
  });
});

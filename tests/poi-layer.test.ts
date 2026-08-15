import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import {
  createPoiLayer,
  POI_AVAILABLE_LAYER_ID,
  POI_HEATMAP_LAYER_ID,
  POI_LAYER_ID,
  POI_SELECTION_LAYER_ID,
  POI_SOURCE_ID,
  type PoiLayerScheduler,
} from '../src/map/poi-layer';
import type { Poi } from '../src/types';

function point(id: string, longitude: number): Poi {
  return {
    id,
    title: `Точка ${id}`,
    coordinates: [longitude, 55.75],
    articleUrl: `https://example.com/${id}`,
    rarity: 'rare',
    basePoints: 25,
  };
}

class FakeMap {
  public readonly source = { setData: vi.fn() };
  public readonly canvas = document.createElement('canvas');
  public readonly layers = new Set<string>();
  public readonly handlers = new Map<string, (event: never) => void>();
  public readonly addSource = vi.fn((id: string) => {
    expect(id).toBe(POI_SOURCE_ID);
  });
  public readonly addLayer = vi.fn((layer: { id: string }) => {
    this.layers.add(layer.id);
  });
  public readonly getSource = vi.fn((id: string) =>
    id === POI_SOURCE_ID ? this.source : undefined,
  );
  public readonly getLayer = vi.fn((id: string) =>
    this.layers.has(id) ? { id } : undefined,
  );
  public readonly setFilter = vi.fn();
  public readonly setLayoutProperty = vi.fn();
  public readonly removeLayer = vi.fn((id: string) => this.layers.delete(id));
  public readonly removeSource = vi.fn();
  public readonly getCanvas = vi.fn(() => this.canvas);
  public readonly getContainer = vi.fn(() => document.createElement('div'));
  public readonly queryRenderedFeatures = vi.fn(() => [] as Array<{ properties: unknown }>);

  public on(
    type: string,
    layerIdOrListener: string | ((event: never) => void),
    delegatedListener?: (event: never) => void,
  ): this {
    const key = typeof layerIdOrListener === 'string' ? layerIdOrListener : 'map';
    const listener =
      typeof layerIdOrListener === 'string' ? delegatedListener : layerIdOrListener;
    if (listener) this.handlers.set(`${type}:${key}`, listener);
    return this;
  }

  public off(type: string, layerIdOrListener: string | ((event: never) => void)): this {
    const key = typeof layerIdOrListener === 'string' ? layerIdOrListener : 'map';
    this.handlers.delete(`${type}:${key}`);
    return this;
  }

  public emit(type: string, layerId: string, event: unknown = {}): void {
    this.handlers.get(`${type}:${layerId}`)?.(event as never);
  }

  public emitMap(type: string, event: unknown = {}): void {
    this.handlers.get(`${type}:map`)?.(event as never);
  }
}

describe('PoiLayer', () => {
  it('группирует GeoJSON-обновления в один кадр и обрабатывает выбор точки', () => {
    const map = new FakeMap();
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    const scheduler: PoiLayerScheduler = {
      request: vi.fn((callback) => {
        const id = nextFrame++;
        frames.set(id, callback);
        return id;
      }),
      cancel: vi.fn((id) => frames.delete(id)),
    };
    const onSelect = vi.fn();
    const layer = createPoiLayer(map as unknown as MapLibreMap, onSelect, scheduler);
    const first = point('first', 37.62);
    const second = point('second', 37.63);
    const renderState = {
      player: second.coordinates,
      collectRadiusMeters: 50,
      collectedIds: new Set([first.id]),
    };

    layer.setPoints([first], renderState);
    layer.setPoints([first, second], renderState);
    expect(scheduler.request).toHaveBeenCalledTimes(1);

    frames.get(1)?.(0);
    const collection = map.source.setData.mock.calls[0]?.[0] as {
      features: Array<{ geometry: unknown; properties: { status: string } }>;
    };
    expect(collection.features).toHaveLength(2);
    expect(collection.features[1]?.geometry).toEqual({
      type: 'Point',
      coordinates: [37.63, 55.75],
    });
    expect(collection.features.map((feature) => feature.properties.status)).toEqual([
      'collected',
      'available',
    ]);

    map.emit('mouseenter', POI_LAYER_ID);
    expect(map.canvas.style.cursor).toBe('pointer');
    map.queryRenderedFeatures.mockReturnValueOnce([
      { properties: { poiId: 'second' } },
    ]);
    map.emitMap('click', { point: { x: 120, y: 80 } });
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith(
      [
        [112, 72],
        [128, 88],
      ],
      { layers: [POI_LAYER_ID] },
    );
    expect(onSelect).toHaveBeenLastCalledWith(second);
    expect(map.setFilter).toHaveBeenLastCalledWith(POI_SELECTION_LAYER_ID, [
      '==',
      ['get', 'poiId'],
      'second',
    ]);

    layer.clearSelection();
    expect(onSelect).toHaveBeenLastCalledWith(null);
    map.emit('mouseleave', POI_LAYER_ID);
    expect(map.canvas.style.cursor).toBe('');

    layer.setHeatmapVisible(true);
    layer.setHeatmapVisible(false);
    expect(map.setLayoutProperty.mock.calls).toEqual([
      [POI_HEATMAP_LAYER_ID, 'visibility', 'visible'],
      [POI_HEATMAP_LAYER_ID, 'visibility', 'none'],
    ]);
  });

  it('удаляет обработчики, слои, source и отложенный кадр', () => {
    const map = new FakeMap();
    const scheduler: PoiLayerScheduler = {
      request: vi.fn(() => 7),
      cancel: vi.fn(),
    };
    const layer = createPoiLayer(map as unknown as MapLibreMap, vi.fn(), scheduler);

    layer.setPoints([point('first', 37.62)], {
      player: [37.62, 55.75],
      collectRadiusMeters: 50,
      collectedIds: new Set(),
    });
    layer.destroy();
    layer.destroy();

    expect(scheduler.cancel).toHaveBeenCalledWith(7);
    expect(map.handlers.size).toBe(0);
    expect(map.removeLayer.mock.calls.map(([id]) => id)).toEqual([
      POI_SELECTION_LAYER_ID,
      POI_LAYER_ID,
      POI_AVAILABLE_LAYER_ID,
      POI_HEATMAP_LAYER_ID,
    ]);
    expect(map.removeSource).toHaveBeenCalledWith(POI_SOURCE_ID);
  });

  it('готовит 20 000 объектов одним обновлением source', () => {
    const map = new FakeMap();
    let flush: FrameRequestCallback | undefined;
    const scheduler: PoiLayerScheduler = {
      request: vi.fn((callback) => {
        flush = callback;
        return 1;
      }),
      cancel: vi.fn(),
    };
    const layer = createPoiLayer(map as unknown as MapLibreMap, vi.fn(), scheduler);
    const points = Array.from({ length: 20_000 }, (_, index) =>
      point(`load-${index}`, 37.5 + (index % 500) / 10_000),
    );

    layer.setPoints(points, {
      player: [37.62, 55.75],
      collectRadiusMeters: 50,
      collectedIds: new Set(),
    });
    const startedAt = performance.now();
    flush?.(startedAt);
    const preparationTime = performance.now() - startedAt;

    const collection = map.source.setData.mock.calls[0]?.[0] as {
      features: unknown[];
    };
    expect(collection.features).toHaveLength(20_000);
    expect(map.source.setData).toHaveBeenCalledTimes(1);
    expect(preparationTime).toBeLessThan(1_000);
  });
});

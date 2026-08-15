import type { IControl, Map as MapLibreMap, MapOptions } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { FALLBACK_MAP_STYLE_URL, MAP_STYLE_URL } from '../src/config';
import {
  createMapAdapter,
  type MapAdapterDependencies,
} from '../src/map/map-adapter';

class FakeMap {
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  public readonly addControl = vi.fn(() => this);
  public readonly setStyle = vi.fn(() => this);
  public readonly remove = vi.fn();
  public readonly resize = vi.fn(() => this);
  public readonly setPixelRatio = vi.fn();
  public readonly getPixelRatio = vi.fn(() => 1);
  public readonly jumpTo = vi.fn(() => this);

  public on(type: string, listener: (event: never) => void): this {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener as (event: unknown) => void);
    this.listeners.set(type, listeners);
    return this;
  }

  public off(type: string, listener: (event: never) => void): this {
    this.listeners.get(type)?.delete(listener as (event: unknown) => void);
    return this;
  }

  public emit(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe('MapLibre adapter', () => {
  it('создаёт карту, переключает fallback и полностью очищается', () => {
    const container = document.createElement('div');
    Object.defineProperties(container, {
      offsetWidth: { value: 800 },
      offsetHeight: { value: 420 },
    });
    container.getBoundingClientRect = () =>
      ({ width: 800, height: 420 } as DOMRect);
    const fakeMap = new FakeMap();
    const stopGeometry = vi.fn();
    const createMap = vi.fn<(options: MapOptions) => MapLibreMap>(
      () => fakeMap as unknown as MapLibreMap,
    );
    const dependencies: MapAdapterDependencies = {
      createMap,
      createNavigationControl: () => ({}) as IControl,
      observeGeometry: () => stopGeometry,
    };
    const onReady = vi.fn();
    const onError = vi.fn();

    const adapter = createMapAdapter(
      container,
      { center: [37.6208, 55.7539], onReady, onError },
      dependencies,
    );

    expect(createMap).toHaveBeenCalledWith(
      expect.objectContaining({
        container,
        style: MAP_STYLE_URL,
        center: [37.6208, 55.7539],
      }),
    );

    fakeMap.emit('error', { error: new Error('основной стиль недоступен') });
    expect(fakeMap.setStyle).toHaveBeenCalledWith(FALLBACK_MAP_STYLE_URL);
    expect(onError).not.toHaveBeenCalled();

    fakeMap.emit('error', { error: new Error('запасной стиль недоступен') });
    expect(onError).toHaveBeenCalledWith('запасной стиль недоступен');

    fakeMap.emit('style.load');
    fakeMap.emit('style.load');
    expect(onReady).toHaveBeenCalledTimes(1);

    adapter.moveTo([30.3141, 59.9386]);
    expect(fakeMap.jumpTo).toHaveBeenCalledWith({
      center: [30.3141, 59.9386],
      zoom: 14,
    });

    fakeMap.emit('error', { error: new Error('ошибка тайла') });
    expect(onError).toHaveBeenCalledTimes(1);

    adapter.destroy();
    adapter.destroy();
    expect(stopGeometry).toHaveBeenCalledTimes(1);
    expect(fakeMap.remove).toHaveBeenCalledTimes(1);
  });
});

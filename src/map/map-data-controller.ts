import type { Map as MapLibreMap } from 'maplibre-gl';
import type { PoiLoadResult, PoiRepository } from '../data/poi-repository';
import { isAbortError } from '../data/poi-repository';
import type { Coordinates, Poi } from '../types';
import { createPoiLayer, type PoiLayer } from './poi-layer';

export const MIN_DATA_ZOOM = 11;
export const DATA_DEBOUNCE_MS = 250;

export type MapDataStatus =
  | { readonly type: 'loading'; readonly count: number }
  | { readonly type: 'ready'; readonly count: number; readonly fromCache: boolean }
  | { readonly type: 'zoom'; readonly count: number }
  | { readonly type: 'error'; readonly count: number; readonly message: string };

export interface MapDataController {
  clearSelection(): void;
  setCollectedIds(collectedIds: ReadonlySet<string>): void;
  destroy(): void;
}

export interface MapDataControllerOptions {
  readonly onStatus: (status: MapDataStatus) => void;
  readonly onLoaded: (result: PoiLoadResult) => void;
  readonly onError: (message: string) => void;
  readonly onPoiSelect: (poi: Poi | null) => void;
  readonly collectRadiusMeters: number;
  readonly onPlayerPosition: (
    points: readonly Poi[],
    player: Coordinates,
  ) => ReadonlySet<string>;
}

export interface MapDataControllerDependencies {
  createLayer(map: MapLibreMap, onPoiSelect: (poi: Poi | null) => void): PoiLayer;
  schedule(callback: () => void, delayMs: number): number;
  cancel(handle: number): void;
}

function createDependencies(map: MapLibreMap): MapDataControllerDependencies {
  const view = map.getContainer().ownerDocument.defaultView;

  return {
    createLayer: createPoiLayer,
    schedule: (callback, delayMs) =>
      (view?.setTimeout(callback, delayMs) ??
        globalThis.setTimeout(callback, delayMs)) as unknown as number,
    cancel: (handle) => {
      if (view) view.clearTimeout(handle);
      else globalThis.clearTimeout(handle);
    },
  };
}

function getCenter(map: MapLibreMap): Coordinates {
  const center = map.getCenter();
  return [center.lng, center.lat];
}

function messageFrom(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Не удалось загрузить точки';
}

export function createMapDataController(
  map: MapLibreMap,
  repository: PoiRepository,
  options: MapDataControllerOptions,
  dependencies: MapDataControllerDependencies = createDependencies(map),
): MapDataController {
  const layer = dependencies.createLayer(map, options.onPoiSelect);
  let currentPoints: readonly Poi[] = [];
  let player = getCenter(map);
  let collectedIds: ReadonlySet<string> = new Set<string>();
  let pointCount = 0;
  let requestVersion = 0;
  let debounceId: number | null = null;
  let destroyed = false;

  const renderGameState = () => {
    layer.setPoints(currentPoints, {
      player,
      collectRadiusMeters: options.collectRadiusMeters,
      collectedIds,
    });
  };

  const updatePlayer = (nextPlayer: Coordinates) => {
    player = nextPlayer;
    collectedIds = options.onPlayerPosition(currentPoints, player);
    renderGameState();
  };

  const loadCurrentArea = async () => {
    if (destroyed) return;

    const requestCenter = getCenter(map);
    updatePlayer(requestCenter);

    if (map.getZoom() < MIN_DATA_ZOOM) {
      requestVersion += 1;
      repository.abort();
      options.onStatus({ type: 'zoom', count: pointCount });
      return;
    }

    const version = ++requestVersion;
    options.onStatus({ type: 'loading', count: pointCount });

    try {
      const result = await repository.loadAround(requestCenter);
      if (destroyed || version !== requestVersion) return;

      currentPoints = result.points;
      pointCount = result.points.length;
      updatePlayer(requestCenter);
      options.onStatus({ type: 'ready', count: pointCount, fromCache: result.fromCache });
      options.onLoaded(result);
    } catch (error) {
      if (destroyed || version !== requestVersion || isAbortError(error)) return;

      const message = messageFrom(error);
      options.onStatus({ type: 'error', count: pointCount, message });
      options.onError(message);
    }
  };

  const handleMoveEnd = () => {
    if (debounceId !== null) dependencies.cancel(debounceId);
    debounceId = dependencies.schedule(() => {
      debounceId = null;
      void loadCurrentArea();
    }, DATA_DEBOUNCE_MS);
  };

  map.on('moveend', handleMoveEnd);
  void loadCurrentArea();

  return {
    clearSelection() {
      layer.clearSelection();
    },
    setCollectedIds(nextCollectedIds) {
      if (destroyed) return;
      collectedIds = nextCollectedIds;
      renderGameState();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      requestVersion += 1;
      if (debounceId !== null) dependencies.cancel(debounceId);
      debounceId = null;
      map.off('moveend', handleMoveEnd);
      repository.abort();
      layer.destroy();
    },
  };
}

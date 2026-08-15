import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { NormalizedConfig } from '../config';
import { PoiRepository } from '../data/poi-repository';
import type { Poi, PokeMapEvent } from '../types';
import {
  createMapDataController,
  type MapDataController,
  type MapDataStatus,
} from './map-data-controller';
import { createMapAdapter } from './map-adapter';

export type MapStatus =
  | { readonly type: 'loading' }
  | { readonly type: 'ready' }
  | { readonly type: 'error'; readonly message: string };

interface UseMapLibreResult {
  readonly containerRef: RefObject<HTMLDivElement>;
  readonly status: MapStatus;
  readonly dataStatus: MapDataStatus | null;
  readonly selectedPoi: Poi | null;
  readonly clearSelectedPoi: () => void;
}

function emitSafely(config: NormalizedConfig, event: PokeMapEvent): void {
  try {
    config.onEvent?.(event);
  } catch {
    // Ошибка callback принадлежит host-странице и не должна ломать карту.
  }
}

export function useMapLibre(config: NormalizedConfig): UseMapLibreResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const dataControllerRef = useRef<MapDataController | null>(null);
  const [status, setStatus] = useState<MapStatus>({ type: 'loading' });
  const [dataStatus, setDataStatus] = useState<MapDataStatus | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);

  const clearSelectedPoi = useCallback(() => {
    dataControllerRef.current?.clearSelection();
    setSelectedPoi(null);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    setStatus({ type: 'loading' });
    setDataStatus(null);
    setSelectedPoi(null);
    const repository = new PoiRepository(config.apiBaseUrl);
    let adapter: ReturnType<typeof createMapAdapter> | null = null;
    let dataController: MapDataController | null = null;
    let readyBeforeAdapter = false;

    const initializeData = () => {
      if (!adapter) {
        readyBeforeAdapter = true;
        return;
      }
      if (dataController) return;

      setStatus({ type: 'ready' });
      emitSafely(config, { type: 'ready', city: config.city });
      dataController = createMapDataController(adapter.map, repository, {
        onStatus: setDataStatus,
        onLoaded: (result) => {
          emitSafely(config, {
            type: 'data-loaded',
            count: result.points.length,
            fromCache: result.fromCache,
          });
        },
        onError: (message) => {
          emitSafely(config, { type: 'error', source: 'data', message });
        },
        onPoiSelect: setSelectedPoi,
      });
      dataControllerRef.current = dataController;
    };

    adapter = createMapAdapter(container, {
      center: config.city.center,
      onReady: initializeData,
      onError: (message) => {
        setStatus({ type: 'error', message });
        emitSafely(config, { type: 'error', source: 'map', message });
      },
    });
    if (readyBeforeAdapter) initializeData();

    return () => {
      dataController?.destroy();
      if (dataControllerRef.current === dataController) dataControllerRef.current = null;
      repository.abort();
      adapter?.destroy();
    };
  }, [config]);

  return { containerRef, status, dataStatus, selectedPoi, clearSelectedPoi };
}

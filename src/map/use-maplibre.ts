import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { NormalizedConfig } from '../config';
import { PoiRepository } from '../data/poi-repository';
import {
  createGameController,
  snapshotGame,
  type GameController,
  type GameSnapshot,
} from '../game/game-controller';
import { createInitialGameState } from '../game/game';
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
  readonly game: GameSnapshot;
  readonly resetProgress: () => void;
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
  const gameControllerRef = useRef<GameController | null>(null);
  const [status, setStatus] = useState<MapStatus>({ type: 'loading' });
  const [dataStatus, setDataStatus] = useState<MapDataStatus | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const [game, setGame] = useState<GameSnapshot>(() =>
    snapshotGame(createInitialGameState(), Date.now()),
  );

  const clearSelectedPoi = useCallback(() => {
    dataControllerRef.current?.clearSelection();
    setSelectedPoi(null);
  }, []);

  const resetProgress = useCallback(() => {
    if (!gameControllerRef.current) return;
    gameControllerRef.current.reset();
    emitSafely(config, { type: 'progress-reset' });
  }, [config]);

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
    const gameController = createGameController({
      collectRadiusMeters: config.collectRadiusMeters,
      onChange: (snapshot) => {
        setGame(snapshot);
        dataController?.setCollectedIds(snapshot.state.collectedIds);
      },
      onCollection: (collection) => {
        emitSafely(config, {
          type: 'poi-collected',
          poi: collection.poi,
          awardedPoints: collection.awardedPoints,
          totalScore: collection.totalScore,
          combo: collection.combo,
        });
      },
      onStorageError: (message) => {
        emitSafely(config, { type: 'error', source: 'storage', message });
      },
    });
    gameControllerRef.current = gameController;

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
        collectRadiusMeters: config.collectRadiusMeters,
        onPlayerPosition: (points, player) =>
          gameController.update(points, player).state.collectedIds,
      });
      dataControllerRef.current = dataController;
      dataController.setCollectedIds(gameController.getSnapshot().state.collectedIds);
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
      gameController.destroy();
      if (gameControllerRef.current === gameController) gameControllerRef.current = null;
      dataController?.destroy();
      if (dataControllerRef.current === dataController) dataControllerRef.current = null;
      repository.abort();
      adapter?.destroy();
    };
  }, [config]);

  return {
    containerRef,
    status,
    dataStatus,
    selectedPoi,
    clearSelectedPoi,
    game,
    resetProgress,
  };
}

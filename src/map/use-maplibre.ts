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
import type { CityConfig } from '../types';
import { requestGeolocation } from './geolocation';
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

export type GeolocationStatus =
  | { readonly type: 'loading' }
  | { readonly type: 'error'; readonly message: string }
  | null;

type MoveMap = (center: CityConfig['center']) => void;

interface UseMapLibreResult {
  readonly containerRef: RefObject<HTMLDivElement>;
  readonly status: MapStatus;
  readonly dataStatus: MapDataStatus | null;
  readonly selectedPoi: Poi | null;
  readonly clearSelectedPoi: () => void;
  readonly game: GameSnapshot;
  readonly resetProgress: () => void;
  readonly activeCity: CityConfig;
  readonly moveToCity: (city: CityConfig) => void;
  readonly geolocationStatus: GeolocationStatus;
  readonly locatePlayer: () => void;
  readonly heatmapVisible: boolean;
  readonly toggleHeatmap: () => void;
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
  const moveMapRef = useRef<MoveMap | null>(null);
  const heatmapVisibleRef = useRef(false);
  const geolocationRequestRef = useRef(0);
  const [status, setStatus] = useState<MapStatus>({ type: 'loading' });
  const [dataStatus, setDataStatus] = useState<MapDataStatus | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const [game, setGame] = useState<GameSnapshot>(() =>
    snapshotGame(createInitialGameState(), Date.now()),
  );
  const [activeCity, setActiveCity] = useState<CityConfig>(config.city);
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>(null);
  const [heatmapVisible, setHeatmapVisible] = useState(false);

  const clearSelectedPoi = useCallback(() => {
    dataControllerRef.current?.clearSelection();
    setSelectedPoi(null);
  }, []);

  const resetProgress = useCallback(() => {
    if (!gameControllerRef.current) return;
    gameControllerRef.current.reset();
    emitSafely(config, { type: 'progress-reset' });
  }, [config]);

  const moveToCity = useCallback(
    (city: CityConfig) => {
      const moveMap = moveMapRef.current;
      if (!moveMap) return;
      geolocationRequestRef.current += 1;
      setActiveCity(city);
      setGeolocationStatus(null);
      moveMap(city.center);
      emitSafely(config, { type: 'city-changed', city });
    },
    [config],
  );

  const locatePlayer = useCallback(() => {
    const moveMap = moveMapRef.current;
    const environment = containerRef.current?.ownerDocument.defaultView?.navigator;
    if (!moveMap) return;

    const requestId = ++geolocationRequestRef.current;
    setGeolocationStatus({ type: 'loading' });
    void requestGeolocation(environment)
      .then((coordinates) => {
        const currentMoveMap = moveMapRef.current;
        if (requestId !== geolocationRequestRef.current || !currentMoveMap) return;
        const location = { name: 'Моя позиция', center: coordinates } satisfies CityConfig;
        setActiveCity(location);
        setGeolocationStatus(null);
        currentMoveMap(coordinates);
      })
      .catch((error: unknown) => {
        if (requestId !== geolocationRequestRef.current || !moveMapRef.current) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Не удалось получить геопозицию';
        setGeolocationStatus({ type: 'error', message });
        emitSafely(config, { type: 'error', source: 'geolocation', message });
      });
  }, [config]);

  const toggleHeatmap = useCallback(() => {
    setHeatmapVisible((current) => {
      const next = !current;
      heatmapVisibleRef.current = next;
      dataControllerRef.current?.setHeatmapVisible(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    setStatus({ type: 'loading' });
    setDataStatus(null);
    setSelectedPoi(null);
    setActiveCity(config.city);
    setGeolocationStatus(null);
    const repository = new PoiRepository(config.apiBaseUrl);
    let adapter: ReturnType<typeof createMapAdapter> | null = null;
    let dataController: MapDataController | null = null;
    let moveMap: MoveMap | null = null;
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
      moveMap = (center) => {
        adapter?.moveTo(center);
        dataController?.refresh(center);
      };
      moveMapRef.current = moveMap;
      dataController.setCollectedIds(gameController.getSnapshot().state.collectedIds);
      dataController.setHeatmapVisible(heatmapVisibleRef.current);
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
      geolocationRequestRef.current += 1;
      gameController.destroy();
      if (gameControllerRef.current === gameController) gameControllerRef.current = null;
      dataController?.destroy();
      if (dataControllerRef.current === dataController) dataControllerRef.current = null;
      if (moveMapRef.current === moveMap) moveMapRef.current = null;
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
    activeCity,
    moveToCity,
    geolocationStatus,
    locatePlayer,
    heatmapVisible,
    toggleHeatmap,
  };
}

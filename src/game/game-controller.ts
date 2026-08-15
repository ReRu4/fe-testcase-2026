import type { Coordinates, Poi } from '../types';
import {
  collectAvailable,
  createInitialGameState,
  getCombo,
  settleCombo,
  type CollectionResult,
  type GameState,
} from './game';
import { clearProgress, readProgress, saveProgress } from './storage';

const MAX_TIMEOUT_MS = 2_147_483_647;

export interface GameSnapshot {
  readonly state: GameState;
  readonly combo: number;
  readonly frozen: boolean;
}

export interface GameController {
  getSnapshot(): GameSnapshot;
  update(points: readonly Poi[], player: Coordinates): GameSnapshot;
  reset(): void;
  destroy(): void;
}

export interface GameControllerOptions {
  readonly collectRadiusMeters: number;
  readonly storage?: Storage;
  readonly now?: () => number;
  readonly schedule?: (callback: () => void, delayMs: number) => number;
  readonly cancel?: (handle: number) => void;
  readonly onChange: (snapshot: GameSnapshot) => void;
  readonly onCollection: (collection: CollectionResult) => void;
  readonly onStorageError: (message: string) => void;
}

function defaultSchedule(callback: () => void, delayMs: number): number {
  return globalThis.setTimeout(callback, delayMs) as unknown as number;
}

function defaultCancel(handle: number): void {
  globalThis.clearTimeout(handle);
}

export function snapshotGame(state: GameState, now: number): GameSnapshot {
  return {
    state,
    combo: getCombo(state),
    frozen: state.frozenUntil !== null && now < state.frozenUntil,
  };
}

export function createGameController(options: GameControllerOptions): GameController {
  const now = options.now ?? Date.now;
  const schedule = options.schedule ?? defaultSchedule;
  const cancel = options.cancel ?? defaultCancel;
  const loaded = readProgress(options.storage);
  let state = settleCombo(loaded.state, now());
  let timerId: number | null = null;
  let destroyed = false;

  if (loaded.error) options.onStorageError(loaded.error);

  const getSnapshot = () => snapshotGame(state, now());
  const notify = () => options.onChange(getSnapshot());
  const persist = () => {
    const error = saveProgress(state, options.storage);
    if (error) options.onStorageError(error);
  };
  const clearTimer = () => {
    if (timerId === null) return;
    cancel(timerId);
    timerId = null;
  };
  const scheduleNextChange = () => {
    clearTimer();
    if (destroyed || state.comboDeadlineAt === null) return;

    const currentTime = now();
    const nextChangeAt =
      state.frozenUntil !== null && currentTime < state.frozenUntil
        ? state.frozenUntil
        : state.comboDeadlineAt;
    const delayMs = Math.min(MAX_TIMEOUT_MS, Math.max(0, nextChangeAt - currentTime));

    timerId = schedule(() => {
      timerId = null;
      if (destroyed) return;

      const settled = settleCombo(state, now());
      if (settled !== state) {
        state = settled;
        persist();
      }
      notify();
      scheduleNextChange();
    }, delayMs);
  };

  if (state !== loaded.state) persist();
  notify();
  scheduleNextChange();

  return {
    getSnapshot,
    update(points, player) {
      if (destroyed) return getSnapshot();

      const result = collectAvailable(
        state,
        points,
        player,
        options.collectRadiusMeters,
        now(),
      );
      if (result.state !== state) {
        state = result.state;
        persist();
        notify();
        scheduleNextChange();
      }
      for (const collection of result.collections) options.onCollection(collection);
      return getSnapshot();
    },
    reset() {
      if (destroyed) return;
      clearTimer();
      state = createInitialGameState();
      const error = clearProgress(options.storage);
      if (error) options.onStorageError(error);
      notify();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimer();
    },
  };
}

import type { GameState } from './game';
import { createInitialGameState, MAX_COMBO_STEPS } from './game';

export const STORAGE_KEY = 'pokemap-widget:progress';
export const STORAGE_SCHEMA_VERSION = 1;

interface StoredProgressV1 {
  readonly version: 1;
  readonly score: number;
  readonly collectedIds: string[];
  readonly comboSteps: number;
  readonly comboDeadlineAt: number | null;
  readonly frozenUntil: number | null;
}

export interface ProgressLoadResult {
  readonly state: GameState;
  readonly error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableTimestamp(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function parseStoredProgress(value: unknown): GameState | null {
  if (!isRecord(value) || value.version !== STORAGE_SCHEMA_VERSION) return null;
  if (
    typeof value.score !== 'number' ||
    !Number.isSafeInteger(value.score) ||
    value.score < 0 ||
    typeof value.comboSteps !== 'number' ||
    !Number.isInteger(value.comboSteps) ||
    value.comboSteps < 0 ||
    value.comboSteps > MAX_COMBO_STEPS ||
    !Array.isArray(value.collectedIds) ||
    !value.collectedIds.every((id) => typeof id === 'string' && id.length > 0) ||
    !isNullableTimestamp(value.comboDeadlineAt) ||
    !isNullableTimestamp(value.frozenUntil) ||
    (value.comboSteps === 0 &&
      (value.comboDeadlineAt !== null || value.frozenUntil !== null)) ||
    (value.comboSteps > 0 && value.comboDeadlineAt === null) ||
    (value.frozenUntil !== null &&
      (value.comboDeadlineAt === null || value.frozenUntil > value.comboDeadlineAt))
  ) {
    return null;
  }

  return {
    score: value.score,
    collectedIds: new Set(value.collectedIds),
    comboSteps: value.comboSteps,
    comboDeadlineAt: value.comboDeadlineAt,
    frozenUntil: value.frozenUntil,
  };
}

function getStorage(storage: Storage | undefined): Storage {
  if (storage) return storage;
  if (typeof window !== 'undefined') return window.localStorage;
  return globalThis.localStorage;
}

function errorMessage(action: string): string {
  return `Не удалось ${action} локальный прогресс`;
}

export function readProgress(storage?: Storage): ProgressLoadResult {
  try {
    const raw = getStorage(storage).getItem(STORAGE_KEY);
    if (!raw) return { state: createInitialGameState(), error: null };

    const state = parseStoredProgress(JSON.parse(raw));
    return state
      ? { state, error: null }
      : { state: createInitialGameState(), error: 'Сохранённый прогресс повреждён' };
  } catch {
    return { state: createInitialGameState(), error: errorMessage('прочитать') };
  }
}

export function loadProgress(storage?: Storage): GameState {
  return readProgress(storage).state;
}

export function saveProgress(state: GameState, storage?: Storage): string | null {
  const payload: StoredProgressV1 = {
    version: STORAGE_SCHEMA_VERSION,
    score: state.score,
    collectedIds: [...state.collectedIds],
    comboSteps: state.comboSteps,
    comboDeadlineAt: state.comboDeadlineAt,
    frozenUntil: state.frozenUntil,
  };

  try {
    getStorage(storage).setItem(STORAGE_KEY, JSON.stringify(payload));
    return null;
  } catch {
    return errorMessage('сохранить');
  }
}

export function clearProgress(storage?: Storage): string | null {
  try {
    getStorage(storage).removeItem(STORAGE_KEY);
    return null;
  } catch {
    return errorMessage('сбросить');
  }
}

import type { GameState } from './game';
import { INITIAL_GAME_STATE } from './game';

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
    !Number.isFinite(value.score) ||
    value.score < 0 ||
    typeof value.comboSteps !== 'number' ||
    !Number.isInteger(value.comboSteps) ||
    value.comboSteps < 0 ||
    value.comboSteps > 10 ||
    !Array.isArray(value.collectedIds) ||
    !value.collectedIds.every((id) => typeof id === 'string') ||
    !isNullableTimestamp(value.comboDeadlineAt) ||
    !isNullableTimestamp(value.frozenUntil)
  ) {
    return null;
  }

  return {
    score: Math.floor(value.score),
    collectedIds: new Set(value.collectedIds),
    comboSteps: value.comboSteps,
    comboDeadlineAt: value.comboDeadlineAt,
    frozenUntil: value.frozenUntil,
  };
}

export function loadProgress(storage: Storage = localStorage): GameState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_GAME_STATE;
    return parseStoredProgress(JSON.parse(raw)) ?? INITIAL_GAME_STATE;
  } catch {
    return INITIAL_GAME_STATE;
  }
}

export function saveProgress(state: GameState, storage: Storage = localStorage): void {
  const payload: StoredProgressV1 = {
    version: STORAGE_SCHEMA_VERSION,
    score: state.score,
    collectedIds: [...state.collectedIds],
    comboSteps: state.comboSteps,
    comboDeadlineAt: state.comboDeadlineAt,
    frozenUntil: state.frozenUntil,
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode and exhausted quota must not break the widget.
  }
}

export function clearProgress(storage: Storage = localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable in an embedded or privacy-restricted context.
  }
}


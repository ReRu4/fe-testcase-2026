import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialGameState, type GameState } from '../src/game/game';
import {
  clearProgress,
  readProgress,
  saveProgress,
  STORAGE_KEY,
  STORAGE_SCHEMA_VERSION,
} from '../src/game/storage';
import { createMemoryStorage } from './memory-storage';

let storage: Storage;

beforeEach(() => {
  storage = createMemoryStorage();
});

describe('хранилище прогресса', () => {
  it('сохраняет и восстанавливает версионированное состояние', () => {
    const state: GameState = {
      score: 125,
      collectedIds: new Set(['first', 'second']),
      comboSteps: 2,
      comboDeadlineAt: 40_000,
      frozenUntil: 30_000,
    };

    expect(saveProgress(state, storage)).toBeNull();
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}').version).toBe(
      STORAGE_SCHEMA_VERSION,
    );
    expect(readProgress(storage)).toEqual({ state, error: null });
  });

  it.each([
    ['битый JSON', '{'],
    ['чужая версия', JSON.stringify({ version: 2 })],
    [
      'некорректные поля',
      JSON.stringify({
        version: 1,
        score: -1,
        collectedIds: [''],
        comboSteps: 50,
        comboDeadlineAt: null,
        frozenUntil: null,
      }),
    ],
  ])('отбрасывает %s', (_name, raw) => {
    storage.setItem(STORAGE_KEY, raw);
    const loaded = readProgress(storage);

    expect(loaded.state).toEqual(createInitialGameState());
    expect(loaded.error).not.toBeNull();
  });

  it('не выбрасывает исключение недоступного Storage', () => {
    const unavailable = {
      getItem() {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem() {
        throw new DOMException('denied', 'SecurityError');
      },
      removeItem() {
        throw new DOMException('denied', 'SecurityError');
      },
    } as unknown as Storage;

    expect(readProgress(unavailable).error).toContain('прочитать');
    expect(saveProgress(createInitialGameState(), unavailable)).toContain('сохранить');
    expect(clearProgress(unavailable)).toContain('сбросить');
  });
});

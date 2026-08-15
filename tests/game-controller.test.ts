import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameController } from '../src/game/game-controller';
import { saveProgress, STORAGE_KEY } from '../src/game/storage';
import type { Poi } from '../src/types';
import { createMemoryStorage } from './memory-storage';

function point(id: string, rarity: Poi['rarity'] = 'common'): Poi {
  const basePoints = { common: 10, rare: 25, epic: 60, legendary: 150 }[rarity];
  return {
    id,
    title: `Точка ${id}`,
    coordinates: [0, 0],
    articleUrl: `https://example.com/${id}`,
    rarity,
    basePoints,
  };
}

let storage: Storage;

beforeEach(() => {
  storage = createMemoryStorage();
});

describe('GameController', () => {
  it('восстанавливает прогресс и сразу нормализует просроченное комбо', () => {
    saveProgress(
      {
        score: 80,
        collectedIds: new Set(['saved']),
        comboSteps: 3,
        comboDeadlineAt: 5_000,
        frozenUntil: null,
      },
      storage,
    );
    const schedule = vi.fn(() => 1);
    const controller = createGameController({
      collectRadiusMeters: 50,
      storage,
      now: () => 5_000,
      schedule,
      onChange: vi.fn(),
      onCollection: vi.fn(),
      onStorageError: vi.fn(),
    });

    expect(controller.getSnapshot().state).toMatchObject({
      score: 80,
      comboSteps: 0,
      comboDeadlineAt: null,
    });
    expect(controller.getSnapshot().state.collectedIds).toEqual(new Set(['saved']));
    expect(schedule).not.toHaveBeenCalled();
    expect(storage.getItem(STORAGE_KEY)).toContain('"comboSteps":0');
  });

  it('сохраняет сбор, планирует сброс и восстанавливает x1.0 по абсолютному сроку', () => {
    let currentTime = 1_000;
    let nextTimer = 1;
    const timers = new Map<number, () => void>();
    const onChange = vi.fn();
    const onCollection = vi.fn();
    const controller = createGameController({
      collectRadiusMeters: 50,
      storage,
      now: () => currentTime,
      schedule: (callback) => {
        const id = nextTimer++;
        timers.set(id, callback);
        return id;
      },
      cancel: (id) => timers.delete(id),
      onChange,
      onCollection,
      onStorageError: vi.fn(),
    });

    const collected = controller.update([point('first')], [0, 0]);
    expect(collected.state.score).toBe(10);
    expect(collected.combo).toBe(1.2);
    expect(onCollection).toHaveBeenCalledWith(
      expect.objectContaining({ awardedPoints: 10, totalScore: 10, combo: 1.2 }),
    );
    expect(storage.getItem(STORAGE_KEY)).toContain('first');
    expect(timers.size).toBe(1);

    currentTime = 11_000;
    const timer = [...timers.values()][0];
    timers.clear();
    timer?.();

    expect(controller.getSnapshot().combo).toBe(1);
    expect(controller.getSnapshot().state.comboDeadlineAt).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ combo: 1, frozen: false }),
    );
  });

  it('отмечает freeze, очищает прогресс и отменяет таймер при destroy', () => {
    let currentTime = 0;
    const cancel = vi.fn();
    const onChange = vi.fn();
    const controller = createGameController({
      collectRadiusMeters: 50,
      storage,
      now: () => currentTime,
      schedule: vi.fn(() => 42),
      cancel,
      onChange,
      onCollection: vi.fn(),
      onStorageError: vi.fn(),
    });

    expect(controller.update([point('epic', 'epic')], [0, 0]).frozen).toBe(true);
    controller.reset();
    expect(controller.getSnapshot().state.score).toBe(0);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(cancel).toHaveBeenCalledWith(42);

    currentTime = 1;
    controller.update([point('second')], [0, 0]);
    controller.destroy();
    controller.destroy();
    expect(cancel).toHaveBeenLastCalledWith(42);
  });
});

import { describe, expect, it } from 'vitest';
import {
  collectAvailable,
  COMBO_FREEZE_MS,
  COMBO_TIMEOUT_MS,
  createInitialGameState,
  distanceMeters,
  getCombo,
  settleCombo,
  type GameState,
} from '../src/game/game';
import type { Poi, Rarity } from '../src/types';

const EARTH_RADIUS_METERS = 6_371_000;

function latitudeAtMeters(meters: number): number {
  return (meters / EARTH_RADIUS_METERS) * (180 / Math.PI);
}

function point(
  id: string,
  metersNorth = 0,
  rarity: Rarity = 'common',
  basePoints = 10,
): Poi {
  return {
    id,
    title: `Точка ${id}`,
    coordinates: [0, latitudeAtMeters(metersNorth)],
    articleUrl: `https://example.com/${id}`,
    rarity,
    basePoints,
  };
}

describe('игровые правила', () => {
  it('считает Haversine-дистанцию и включает границу радиуса', () => {
    expect(distanceMeters([0, 0], point('near', 49.999).coordinates)).toBeCloseTo(49.999, 6);
    expect(distanceMeters([0, 0], point('edge', 50).coordinates)).toBeCloseTo(50, 6);
    expect(distanceMeters([0, 0], point('far', 50.001).coordinates)).toBeCloseTo(50.001, 6);

    const result = collectAvailable(
      createInitialGameState(),
      [point('far', 50.001), point('edge', 50), point('near', 49.999)],
      [0, 0],
      50,
      0,
    );

    expect(result.collections.map(({ poi }) => poi.id)).toEqual(['near', 'edge']);
  });

  it('при равной дистанции собирает точки по стабильному ID и не собирает повторно', () => {
    const first = collectAvailable(
      createInitialGameState(),
      [point('b'), point('a')],
      [0, 0],
      50,
      0,
    );
    const second = collectAvailable(first.state, [point('a'), point('b')], [0, 0], 50, 1);

    expect(first.collections.map(({ poi }) => poi.id)).toEqual(['a', 'b']);
    expect(second.collections).toEqual([]);
  });

  it('начисляет очки по текущему комбо и ограничивает множитель x3.0', () => {
    const activeCombo: GameState = {
      ...createInitialGameState(),
      comboSteps: 1,
      comboDeadlineAt: 10_000,
    };
    const single = collectAvailable(activeCombo, [point('single')], [0, 0], 50, 0);

    expect(single.collections[0]).toMatchObject({ awardedPoints: 12, totalScore: 12, combo: 1.4 });

    const many = collectAvailable(
      createInitialGameState(),
      Array.from({ length: 12 }, (_, index) => point(String(index))),
      [0, 0],
      50,
      0,
    );

    expect(many.state.comboSteps).toBe(10);
    expect(getCombo(many.state)).toBe(3);
    expect(many.collections.at(-1)?.awardedPoints).toBe(30);
  });

  it('сбрасывает обычное комбо ровно через десять секунд', () => {
    const collected = collectAvailable(
      createInitialGameState(),
      [point('first')],
      [0, 0],
      50,
      1_000,
    ).state;

    expect(collected.comboDeadlineAt).toBe(1_000 + COMBO_TIMEOUT_MS);
    expect(settleCombo(collected, 10_999)).toBe(collected);
    expect(settleCombo(collected, 11_000)).toEqual({
      ...collected,
      comboSteps: 0,
      comboDeadlineAt: null,
      frozenUntil: null,
    });
  });

  it('замораживает комбо, сохраняет обычный сбор и продлевает новую заморозку', () => {
    const epic = collectAvailable(
      createInitialGameState(),
      [point('epic', 0, 'epic', 60)],
      [0, 0],
      50,
      0,
    ).state;
    const common = collectAvailable(epic, [point('common')], [0, 0], 50, 5_000).state;
    const legendary = collectAvailable(
      common,
      [point('legendary', 0, 'legendary', 150)],
      [0, 0],
      50,
      10_000,
    ).state;

    expect(epic.frozenUntil).toBe(COMBO_FREEZE_MS);
    expect(epic.comboDeadlineAt).toBe(COMBO_FREEZE_MS + COMBO_TIMEOUT_MS);
    expect(common.frozenUntil).toBe(COMBO_FREEZE_MS);
    expect(common.comboDeadlineAt).toBe(COMBO_FREEZE_MS + COMBO_TIMEOUT_MS);
    expect(legendary.frozenUntil).toBe(10_000 + COMBO_FREEZE_MS);
    expect(legendary.comboDeadlineAt).toBe(10_000 + COMBO_FREEZE_MS + COMBO_TIMEOUT_MS);
    expect(settleCombo(legendary, 49_999)).toBe(legendary);
    expect(settleCombo(legendary, 50_000).comboSteps).toBe(0);
  });
});

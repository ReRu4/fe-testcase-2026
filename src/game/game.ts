import type { Coordinates, Poi } from '../types';

const EARTH_RADIUS_METERS = 6_371_000;
export const COMBO_STEP = 0.2;
export const MAX_COMBO_STEPS = 10;
export const COMBO_TIMEOUT_MS = 10_000;
export const COMBO_FREEZE_MS = 30_000;

export interface GameState {
  readonly score: number;
  readonly collectedIds: ReadonlySet<string>;
  readonly comboSteps: number;
  readonly comboDeadlineAt: number | null;
  readonly frozenUntil: number | null;
}

export interface CollectionResult {
  readonly poi: Poi;
  readonly awardedPoints: number;
  readonly totalScore: number;
  readonly combo: number;
}

export function createInitialGameState(): GameState {
  return {
    score: 0,
    collectedIds: new Set<string>(),
    comboSteps: 0,
    comboDeadlineAt: null,
    frozenUntil: null,
  };
}

export const INITIAL_GAME_STATE: GameState = createInitialGameState();

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMeters(from: Coordinates, to: Coordinates): number {
  const [fromLongitude, fromLatitude] = from;
  const [toLongitude, toLatitude] = to;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const startLatitude = toRadians(fromLatitude);
  const endLatitude = toRadians(toLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function getCombo(state: GameState): number {
  return 1 + Math.min(MAX_COMBO_STEPS, Math.max(0, state.comboSteps)) * COMBO_STEP;
}

export function settleCombo(state: GameState, now: number): GameState {
  if (state.comboDeadlineAt === null || now < state.comboDeadlineAt) return state;

  return {
    ...state,
    comboSteps: 0,
    comboDeadlineAt: null,
    frozenUntil: null,
  };
}

export function collectAvailable(
  inputState: GameState,
  points: readonly Poi[],
  player: Coordinates,
  radiusMeters: number,
  now: number,
): { state: GameState; collections: CollectionResult[] } {
  let state = settleCombo(inputState, now);
  const candidates = points
    .filter((poi) => !state.collectedIds.has(poi.id))
    .map((poi) => ({ poi, distance: distanceMeters(player, poi.coordinates) }))
    .filter(({ distance }) => distance <= radiusMeters)
    .sort((left, right) => left.distance - right.distance || left.poi.id.localeCompare(right.poi.id));
  const collections: CollectionResult[] = [];

  for (const { poi } of candidates) {
    const currentCombo = getCombo(state);
    const awardedPoints = Math.floor(poi.basePoints * currentCombo);
    const isFreezePoint = poi.rarity === 'epic' || poi.rarity === 'legendary';
    const frozenUntil = isFreezePoint
      ? Math.max(state.frozenUntil ?? 0, now + COMBO_FREEZE_MS)
      : state.frozenUntil && state.frozenUntil > now
        ? state.frozenUntil
        : null;
    const collectedIds = new Set(state.collectedIds);
    collectedIds.add(poi.id);

    state = {
      score: state.score + awardedPoints,
      collectedIds,
      comboSteps: Math.min(MAX_COMBO_STEPS, state.comboSteps + 1),
      frozenUntil,
      comboDeadlineAt: (frozenUntil ?? now) + COMBO_TIMEOUT_MS,
    };
    collections.push({
      poi,
      awardedPoints,
      totalScore: state.score,
      combo: getCombo(state),
    });
  }

  return { state, collections };
}

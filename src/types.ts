export type Coordinates = readonly [longitude: number, latitude: number];

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Poi {
  readonly id: string;
  readonly title: string;
  readonly coordinates: Coordinates;
  readonly description?: string;
  readonly thumbnailUrl?: string;
  readonly articleUrl: string;
  readonly wikiType?: string;
  readonly rarity: Rarity;
  readonly basePoints: number;
}

export interface CityConfig {
  readonly name: string;
  /** Порядок MapLibre/GeoJSON: longitude, latitude. */
  readonly center: Coordinates;
}

export interface PokeMapConfig {
  readonly city?: CityConfig;
  readonly collectRadiusMeters?: number;
  readonly apiBaseUrl?: string;
  readonly onEvent?: (event: PokeMapEvent) => void;
}

export type PokeMapEvent =
  | { readonly type: 'ready'; readonly city: CityConfig }
  | { readonly type: 'data-loaded'; readonly count: number; readonly fromCache: boolean }
  | { readonly type: 'data-error'; readonly message: string }
  | {
      readonly type: 'poi-collected';
      readonly poi: Poi;
      readonly awardedPoints: number;
      readonly totalScore: number;
      readonly combo: number;
    }
  | { readonly type: 'progress-reset' }
  | { readonly type: 'city-changed'; readonly city: CityConfig };

export interface PokeMapHandle {
  readonly id: string;
  readonly target: HTMLElement;
}

export interface PokeMapApi {
  readonly version: string;
  mount(target: string | HTMLElement, config?: PokeMapConfig): PokeMapHandle;
  unmount(handle: PokeMapHandle): void;
}

declare global {
  interface Window {
    PokeMapWidget: PokeMapApi;
  }
}


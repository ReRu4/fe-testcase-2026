import type { CityConfig, PokeMapConfig } from './types';

export const WIDGET_VERSION = '1.0.0';
export const DEFAULT_API_BASE_URL = 'https://ru.wikipedia.org/w/api.php';
export const DEFAULT_COLLECT_RADIUS_METERS = 50;
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const FALLBACK_MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

export const CITIES = {
  moscow: { name: 'Москва', center: [37.6208, 55.7539] },
  saintPetersburg: { name: 'Санкт-Петербург', center: [30.3141, 59.9386] },
} as const satisfies Record<string, CityConfig>;

export interface NormalizedConfig {
  readonly city: CityConfig;
  readonly collectRadiusMeters: number;
  readonly apiBaseUrl: string;
  readonly onEvent?: PokeMapConfig['onEvent'];
}

export function normalizeConfig(config: PokeMapConfig = {}): NormalizedConfig {
  const radius = config.collectRadiusMeters;

  return {
    city: config.city ?? CITIES.moscow,
    collectRadiusMeters:
      typeof radius === 'number' && Number.isFinite(radius) && radius > 0
        ? radius
        : DEFAULT_COLLECT_RADIUS_METERS,
    apiBaseUrl: config.apiBaseUrl || DEFAULT_API_BASE_URL,
    onEvent: config.onEvent,
  };
}


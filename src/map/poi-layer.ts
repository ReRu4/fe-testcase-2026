import type {
  CircleLayerSpecification,
  GeoJSONSource,
  HeatmapLayerSpecification,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from 'maplibre-gl';
import { distanceMeters } from '../game/game';
import type { Coordinates, Poi } from '../types';

export const POI_SOURCE_ID = 'pokemap-pois';
export const POI_HEATMAP_LAYER_ID = 'pokemap-poi-heatmap';
export const POI_AVAILABLE_LAYER_ID = 'pokemap-poi-available';
export const POI_LAYER_ID = 'pokemap-poi-points';
export const POI_SELECTION_LAYER_ID = 'pokemap-poi-selection';

interface PoiFeatureProperties {
  readonly poiId: string;
  readonly rarity: Poi['rarity'];
  readonly status: 'default' | 'available' | 'collected';
}

export interface PoiRenderState {
  readonly player: Coordinates;
  readonly collectRadiusMeters: number;
  readonly collectedIds: ReadonlySet<string>;
}

export interface PoiLayer {
  setPoints(points: readonly Poi[], renderState: PoiRenderState): void;
  setHeatmapVisible(visible: boolean): void;
  clearSelection(): void;
  destroy(): void;
}

export interface PoiLayerScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

function createScheduler(map: MapLibreMap): PoiLayerScheduler {
  const view = map.getContainer().ownerDocument.defaultView;

  return {
    request(callback) {
      if (view?.requestAnimationFrame) return view.requestAnimationFrame(callback);
      return globalThis.setTimeout(() => callback(performance.now()), 16) as unknown as number;
    },
    cancel(handle) {
      if (view?.cancelAnimationFrame) {
        view.cancelAnimationFrame(handle);
      } else {
        globalThis.clearTimeout(handle);
      }
    },
  };
}

function pointStatus(point: Poi, renderState: PoiRenderState | null): PoiFeatureProperties['status'] {
  if (!renderState) return 'default';
  if (renderState.collectedIds.has(point.id)) return 'collected';
  return distanceMeters(renderState.player, point.coordinates) <= renderState.collectRadiusMeters
    ? 'available'
    : 'default';
}

function toFeatureCollection(points: readonly Poi[], renderState: PoiRenderState | null) {
  return {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature',
      id: point.id,
      geometry: {
        type: 'Point',
        coordinates: [...point.coordinates],
      },
      properties: {
        poiId: point.id,
        rarity: point.rarity,
        status: pointStatus(point, renderState),
      } satisfies PoiFeatureProperties,
    })),
  };
}

const POINT_LAYER: CircleLayerSpecification = {
  id: POI_LAYER_ID,
  type: 'circle',
  source: POI_SOURCE_ID,
  paint: {
    'circle-color': [
      'case',
      ['==', ['get', 'status'], 'collected'],
      '#94a3b8',
      [
        'match',
        ['get', 'rarity'],
        'rare',
        '#3b82f6',
        'epic',
        '#8b5cf6',
        'legendary',
        '#f59e0b',
        '#22c55e',
      ],
    ],
    'circle-radius': [
      'match',
      ['get', 'rarity'],
      'rare',
      7,
      'epic',
      8.5,
      'legendary',
      10,
      6,
    ],
    'circle-stroke-color': '#ffffff',
    'circle-stroke-width': 2,
    'circle-opacity': ['case', ['==', ['get', 'status'], 'collected'], 0.45, 0.94],
  },
};

const AVAILABLE_LAYER: CircleLayerSpecification = {
  id: POI_AVAILABLE_LAYER_ID,
  type: 'circle',
  source: POI_SOURCE_ID,
  filter: ['==', ['get', 'status'], 'available'],
  paint: {
    'circle-color': '#ffffff',
    'circle-radius': 16,
    'circle-blur': 0.35,
    'circle-opacity': 0.78,
    'circle-stroke-color': '#16a34a',
    'circle-stroke-width': 3,
  },
};

const HEATMAP_LAYER: HeatmapLayerSpecification = {
  id: POI_HEATMAP_LAYER_ID,
  type: 'heatmap',
  source: POI_SOURCE_ID,
  layout: { visibility: 'none' },
  paint: {
    'heatmap-weight': [
      'match',
      ['get', 'rarity'],
      'legendary',
      1,
      'epic',
      0.8,
      'rare',
      0.55,
      0.3,
    ],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 11, 0.65, 15, 1.35],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 18, 15, 32],
    'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.72, 16, 0.28],
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0,
      'rgba(59, 130, 246, 0)',
      0.25,
      'rgba(59, 130, 246, 0.7)',
      0.5,
      'rgba(139, 92, 246, 0.78)',
      0.75,
      'rgba(245, 158, 11, 0.86)',
      1,
      'rgba(220, 38, 38, 0.92)',
    ],
  },
};

const SELECTION_LAYER: CircleLayerSpecification = {
  id: POI_SELECTION_LAYER_ID,
  type: 'circle',
  source: POI_SOURCE_ID,
  filter: ['==', ['get', 'poiId'], ''],
  paint: {
    'circle-color': 'rgba(255, 255, 255, 0.3)',
    'circle-radius': 15,
    'circle-stroke-color': '#111827',
    'circle-stroke-width': 3,
  },
};

export function createPoiLayer(
  map: MapLibreMap,
  onPoiSelect: (poi: Poi | null) => void,
  scheduler: PoiLayerScheduler = createScheduler(map),
): PoiLayer {
  map.addSource(POI_SOURCE_ID, {
    type: 'geojson',
    data: toFeatureCollection([], null),
  });
  map.addLayer(HEATMAP_LAYER);
  map.addLayer(AVAILABLE_LAYER);
  map.addLayer(POINT_LAYER);
  map.addLayer(SELECTION_LAYER);

  const pointsById = new Map<string, Poi>();
  let pendingPoints: readonly Poi[] = [];
  let pendingRenderState: PoiRenderState | null = null;
  let selectedId: string | null = null;
  let frameId: number | null = null;
  let destroyed = false;

  const flushPoints = () => {
    frameId = null;
    if (destroyed) return;

    pointsById.clear();
    for (const point of pendingPoints) pointsById.set(point.id, point);

    const source = map.getSource(POI_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(toFeatureCollection(pendingPoints, pendingRenderState));

    if (selectedId && !pointsById.has(selectedId)) {
      selectedId = null;
      map.setFilter(POI_SELECTION_LAYER_ID, ['==', ['get', 'poiId'], '']);
      onPoiSelect(null);
    }
  };

  const handleClick = (event: MapLayerMouseEvent) => {
    const poiId = event.features?.[0]?.properties.poiId;
    if (typeof poiId !== 'string') return;

    const point = pointsById.get(poiId);
    if (!point) return;

    selectedId = poiId;
    map.setFilter(POI_SELECTION_LAYER_ID, ['==', ['get', 'poiId'], poiId]);
    onPoiSelect(point);
  };
  const handleMouseEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const handleMouseLeave = () => {
    map.getCanvas().style.cursor = '';
  };

  map.on('click', POI_LAYER_ID, handleClick);
  map.on('mouseenter', POI_LAYER_ID, handleMouseEnter);
  map.on('mouseleave', POI_LAYER_ID, handleMouseLeave);

  return {
    setPoints(points, renderState) {
      if (destroyed) return;
      pendingPoints = points;
      pendingRenderState = renderState;
      if (frameId === null) frameId = scheduler.request(flushPoints);
    },
    setHeatmapVisible(visible) {
      if (destroyed) return;
      map.setLayoutProperty(POI_HEATMAP_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
    },
    clearSelection() {
      if (destroyed || selectedId === null) return;
      selectedId = null;
      map.setFilter(POI_SELECTION_LAYER_ID, ['==', ['get', 'poiId'], '']);
      onPoiSelect(null);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (frameId !== null) scheduler.cancel(frameId);
      frameId = null;
      map.off('click', POI_LAYER_ID, handleClick);
      map.off('mouseenter', POI_LAYER_ID, handleMouseEnter);
      map.off('mouseleave', POI_LAYER_ID, handleMouseLeave);
      map.getCanvas().style.cursor = '';
      if (map.getLayer(POI_SELECTION_LAYER_ID)) map.removeLayer(POI_SELECTION_LAYER_ID);
      if (map.getLayer(POI_LAYER_ID)) map.removeLayer(POI_LAYER_ID);
      if (map.getLayer(POI_AVAILABLE_LAYER_ID)) map.removeLayer(POI_AVAILABLE_LAYER_ID);
      if (map.getLayer(POI_HEATMAP_LAYER_ID)) map.removeLayer(POI_HEATMAP_LAYER_ID);
      if (map.getSource(POI_SOURCE_ID)) map.removeSource(POI_SOURCE_ID);
      pointsById.clear();
    },
  };
}

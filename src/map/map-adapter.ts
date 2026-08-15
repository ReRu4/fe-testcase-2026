import {
  type ErrorEvent as MapLibreErrorEvent,
  type IControl,
  type Map as MapLibreMap,
  type MapOptions,
  Map,
  NavigationControl,
} from 'maplibre-gl';
import { FALLBACK_MAP_STYLE_URL, MAP_STYLE_URL } from '../config';
import type { Coordinates } from '../types';
import { calculateMapPixelRatio, observeMapGeometry } from './map-geometry';

const INITIAL_ZOOM = 14;

export interface MapAdapterOptions {
  readonly center: Coordinates;
  readonly onReady: () => void;
  readonly onError: (message: string) => void;
}

export interface MapAdapter {
  readonly map: MapLibreMap;
  moveTo(center: Coordinates): void;
  destroy(): void;
}

export interface MapAdapterDependencies {
  createMap(options: MapOptions): MapLibreMap;
  createNavigationControl(): IControl;
  observeGeometry(element: HTMLElement, map: MapLibreMap): () => void;
}

const DEFAULT_DEPENDENCIES: MapAdapterDependencies = {
  createMap: (options) => new Map(options),
  createNavigationControl: () =>
    new NavigationControl({ showCompass: false, visualizePitch: false }),
  observeGeometry: observeMapGeometry,
};

function errorMessage(event: MapLibreErrorEvent): string {
  return event.error instanceof Error && event.error.message
    ? event.error.message
    : 'Не удалось загрузить карту';
}

export function createMapAdapter(
  container: HTMLElement,
  options: MapAdapterOptions,
  dependencies: MapAdapterDependencies = DEFAULT_DEPENDENCIES,
): MapAdapter {
  const view = container.ownerDocument.defaultView;
  const pixelRatio = calculateMapPixelRatio(container, view?.devicePixelRatio ?? 1);
  const map = dependencies.createMap({
    container,
    style: MAP_STYLE_URL,
    center: [...options.center] as [number, number],
    zoom: INITIAL_ZOOM,
    pixelRatio,
    renderWorldCopies: false,
  });
  map.addControl(dependencies.createNavigationControl(), 'top-right');

  let destroyed = false;
  let ready = false;
  let fallbackApplied = false;

  const handleLoad = () => {
    if (destroyed || ready) return;
    ready = true;
    options.onReady();
  };
  const handleError = (event: MapLibreErrorEvent) => {
    if (destroyed || ready) return;
    if (!fallbackApplied) {
      fallbackApplied = true;
      map.setStyle(FALLBACK_MAP_STYLE_URL);
      return;
    }
    options.onError(errorMessage(event));
  };

  map.on('style.load', handleLoad);
  map.on('error', handleError);
  const stopObservingGeometry = dependencies.observeGeometry(container, map);

  return {
    map,
    moveTo(center) {
      if (destroyed) return;
      map.jumpTo({
        center: [...center] as [number, number],
        zoom: INITIAL_ZOOM,
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopObservingGeometry();
      map.off('style.load', handleLoad);
      map.off('error', handleError);
      map.remove();
    },
  };
}

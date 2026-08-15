import type { Map as MapLibreMap } from 'maplibre-gl';

const MIN_PIXEL_RATIO = 0.5;
const MAX_PIXEL_RATIO = 3;
const PIXEL_RATIO_EPSILON = 0.01;

export interface ElementScale {
  readonly x: number;
  readonly y: number;
}

type GeometryMap = Pick<MapLibreMap, 'getPixelRatio' | 'resize' | 'setPixelRatio'>;

function validScale(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function measureElementScale(element: HTMLElement): ElementScale {
  const rect = element.getBoundingClientRect();
  return {
    x: validScale(element.offsetWidth > 0 ? rect.width / element.offsetWidth : 1),
    y: validScale(element.offsetHeight > 0 ? rect.height / element.offsetHeight : 1),
  };
}

export function calculateMapPixelRatio(element: HTMLElement, devicePixelRatio: number): number {
  const scale = measureElementScale(element);
  const visualScale = Math.max(scale.x, scale.y);
  const requested = validScale(devicePixelRatio) * visualScale;
  return Math.min(MAX_PIXEL_RATIO, Math.max(MIN_PIXEL_RATIO, requested));
}

export function syncMapGeometry(
  element: HTMLElement,
  map: GeometryMap,
  devicePixelRatio: number,
): void {
  if (element.offsetWidth <= 0 || element.offsetHeight <= 0) return;

  const pixelRatio = calculateMapPixelRatio(element, devicePixelRatio);
  if (Math.abs(map.getPixelRatio() - pixelRatio) > PIXEL_RATIO_EPSILON) {
    map.setPixelRatio(pixelRatio);
  } else {
    map.resize({ source: 'pokemap-layout' });
  }
}

function composedParent(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

function collectAncestors(element: HTMLElement): Element[] {
  const ancestors: Element[] = [];
  let current: Element | null = element;
  while (current) {
    ancestors.push(current);
    current = composedParent(current);
  }
  return ancestors;
}

export function observeMapGeometry(element: HTMLElement, map: GeometryMap): () => void {
  const view = element.ownerDocument.defaultView;
  if (!view) return () => undefined;

  let frameId = 0;
  let destroyed = false;
  const schedule = () => {
    if (destroyed || frameId) return;
    frameId = view.requestAnimationFrame(() => {
      frameId = 0;
      if (!destroyed) syncMapGeometry(element, map, view.devicePixelRatio);
    });
  };

  const resizeObserver = view.ResizeObserver ? new view.ResizeObserver(schedule) : null;
  const mutationObserver = new view.MutationObserver(schedule);

  resizeObserver?.observe(element);
  for (const ancestor of collectAncestors(element)) {
    mutationObserver.observe(ancestor, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
  }
  schedule();

  return () => {
    destroyed = true;
    resizeObserver?.disconnect();
    mutationObserver.disconnect();
    if (frameId) view.cancelAnimationFrame(frameId);
    frameId = 0;
  };
}

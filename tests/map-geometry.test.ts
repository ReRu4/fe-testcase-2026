import { describe, expect, it, vi } from 'vitest';
import {
  calculateMapPixelRatio,
  measureElementScale,
  syncMapGeometry,
} from '../src/map/map-geometry';

function geometryElement(layoutWidth: number, layoutHeight: number, scale: number): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperties(element, {
    offsetWidth: { configurable: true, value: layoutWidth },
    offsetHeight: { configurable: true, value: layoutHeight },
  });
  element.getBoundingClientRect = () =>
    ({
      width: layoutWidth * scale,
      height: layoutHeight * scale,
      left: 0,
      top: 0,
      right: layoutWidth * scale,
      bottom: layoutHeight * scale,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    }) as DOMRect;
  return element;
}

describe('геометрия карты', () => {
  it('определяет масштаб transformed-предка по экранному размеру', () => {
    expect(measureElementScale(geometryElement(800, 420, 0.8))).toEqual({ x: 0.8, y: 0.8 });
    expect(measureElementScale(geometryElement(800, 420, 1.25))).toEqual({ x: 1.25, y: 1.25 });
  });

  it('подбирает backing pixel ratio под DPR и CSS scale', () => {
    expect(calculateMapPixelRatio(geometryElement(800, 420, 0.8), 1.5)).toBeCloseTo(1.2);
    expect(calculateMapPixelRatio(geometryElement(800, 420, 1.25), 1.5)).toBeCloseTo(1.875);
    expect(calculateMapPixelRatio(geometryElement(800, 420, 2), 2)).toBe(3);
  });

  it('меняет pixel ratio только при необходимости', () => {
    const element = geometryElement(800, 420, 1.25);
    const map = {
      getPixelRatio: vi.fn(() => 1.5),
      setPixelRatio: vi.fn(),
      resize: vi.fn(),
    };

    syncMapGeometry(element, map, 1.5);
    expect(map.setPixelRatio).toHaveBeenCalledWith(1.875);
    expect(map.resize).not.toHaveBeenCalled();

    map.getPixelRatio.mockReturnValue(1.875);
    syncMapGeometry(element, map, 1.5);
    expect(map.resize).toHaveBeenCalledWith({ source: 'pokemap-layout' });
  });
});

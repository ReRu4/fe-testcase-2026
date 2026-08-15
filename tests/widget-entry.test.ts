import { describe, expect, it } from 'vitest';
import { WidgetApp, WIDGET_VERSION } from '../src/widget';

describe('точка входа виджета', () => {
  it('экспортирует React-корень, версию и глобальное API', () => {
    expect(WidgetApp).toBeTypeOf('function');
    expect(WIDGET_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(window.PokeMapWidget.version).toBe(WIDGET_VERSION);
    expect(window.PokeMapWidget.mount).toBeTypeOf('function');
    expect(window.PokeMapWidget.unmount).toBeTypeOf('function');
  });
});

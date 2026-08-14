import { describe, expect, it } from 'vitest';
import { WidgetApp, WIDGET_VERSION } from '../src/widget';

describe('точка входа виджета', () => {
  it('экспортирует React-корень и версию', () => {
    expect(WidgetApp).toBeTypeOf('function');
    expect(WIDGET_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

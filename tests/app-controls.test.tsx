import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetApp } from '../src/app';
import { CITIES, normalizeConfig } from '../src/config';

const mocks = vi.hoisted(() => ({
  moveTo: vi.fn(),
  refresh: vi.fn(),
  setHeatmapVisible: vi.fn(),
  destroyMap: vi.fn(),
  destroyData: vi.fn(),
}));

vi.mock('../src/map/map-adapter', () => ({
  createMapAdapter: (
    _container: HTMLElement,
    options: { readonly onReady: () => void },
  ) => {
    queueMicrotask(options.onReady);
    return {
      map: {},
      moveTo: mocks.moveTo,
      destroy: mocks.destroyMap,
    };
  },
}));

vi.mock('../src/map/map-data-controller', () => ({
  createMapDataController: () => ({
    clearSelection: vi.fn(),
    refresh: mocks.refresh,
    setCollectedIds: vi.fn(),
    setHeatmapVisible: mocks.setHeatmapVisible,
    destroy: mocks.destroyData,
  }),
}));

vi.mock('../src/data/poi-repository', () => ({
  PoiRepository: class {
    public abort(): void {}
  },
}));

afterEach(() => {
  document.body.replaceChildren();
});

describe('управление картой', () => {
  it('перемещает карту и обновляет точки при выборе города', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const root = createRoot(target);

    await act(async () => {
      root.render(
        <StrictMode>
          <WidgetApp config={normalizeConfig()} />
        </StrictMode>,
      );
      await Promise.resolve();
    });

    const citySelect = target.querySelector<HTMLSelectElement>('select[aria-label="Город"]');
    expect(citySelect).not.toBeNull();

    act(() => {
      if (!citySelect) return;
      citySelect.value = 'saintPetersburg';
      citySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(mocks.moveTo).toHaveBeenCalledWith(CITIES.saintPetersburg.center);
    expect(mocks.refresh).toHaveBeenCalledWith(CITIES.saintPetersburg.center);

    act(() => root.unmount());
  });

  it('переключает видимость теплокарты', async () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const root = createRoot(target);

    await act(async () => {
      root.render(
        <StrictMode>
          <WidgetApp config={normalizeConfig()} />
        </StrictMode>,
      );
      await Promise.resolve();
    });

    const heatmapButton = Array.from(target.querySelectorAll('button')).find(
      (button) => button.textContent === 'Теплокарта',
    );
    expect(heatmapButton?.getAttribute('aria-pressed')).toBe('false');

    act(() => heatmapButton?.click());

    expect(heatmapButton?.getAttribute('aria-pressed')).toBe('true');
    expect(mocks.setHeatmapVisible).toHaveBeenLastCalledWith(true);

    act(() => root.unmount());
  });
});

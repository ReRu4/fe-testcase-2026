import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PokeMapHandle } from '../src/types';
import { createWidgetRuntime, type WidgetRuntime } from '../src/widget-runtime';

vi.mock('../src/map/map-adapter', () => ({
  createMapAdapter: () => ({ destroy: vi.fn() }),
}));

const runtimes: WidgetRuntime[] = [];

function createRuntime(): WidgetRuntime {
  const runtime = createWidgetRuntime(document);
  runtimes.push(runtime);
  return runtime;
}

async function flushDom(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  act(() => {
    for (const runtime of runtimes.splice(0)) runtime.stop();
  });
  document.body.replaceChildren();
});

describe('lifecycle виджета', () => {
  it('монтирует один Shadow DOM и повторно возвращает тот же handle', () => {
    const runtime = createRuntime();
    const target = document.createElement('div');
    document.body.appendChild(target);
    let firstHandle!: PokeMapHandle;
    let secondHandle!: PokeMapHandle;

    act(() => {
      firstHandle = runtime.api.mount(target, {
        city: { name: 'Тестовый город', center: [39.7, 47.2] },
      });
      secondHandle = runtime.api.mount(target);
    });

    expect(secondHandle).toBe(firstHandle);
    expect(Object.isFrozen(firstHandle)).toBe(true);
    expect(target.childElementCount).toBe(1);
    expect(runtime.getInstanceCount()).toBe(1);

    const hostRoot = target.firstElementChild as HTMLElement;
    expect(hostRoot.shadowRoot).not.toBeNull();
    expect(hostRoot.shadowRoot?.querySelectorAll('[data-pokemap-app]')).toHaveLength(1);
    expect(hostRoot.shadowRoot?.textContent).toContain('Подготовка карты');
    expect(hostRoot.shadowRoot?.querySelector('[aria-label]')?.getAttribute('aria-label')).toContain(
      'Тестовый город',
    );
  });

  it('после ручного unmount не монтирует тот же слот заново', async () => {
    const runtime = createRuntime();
    const target = document.createElement('div');
    target.dataset.widget = 'pokemap';
    document.body.appendChild(target);
    let handle!: PokeMapHandle;

    act(() => {
      handle = runtime.api.mount(target);
      runtime.start();
      runtime.api.unmount(handle);
      runtime.api.unmount(handle);
    });
    await flushDom();

    expect(target.childElementCount).toBe(0);
    expect(runtime.getInstanceCount()).toBe(0);

    act(() => {
      runtime.api.mount(target);
    });
    expect(target.childElementCount).toBe(1);
    expect(runtime.getInstanceCount()).toBe(1);
  });

  it('автоматически монтирует появившийся слот и очищает удалённый', async () => {
    const runtime = createRuntime();
    runtime.start();
    const target = document.createElement('div');
    target.dataset.widget = 'pokemap';

    act(() => {
      document.body.appendChild(target);
    });
    await flushDom();

    expect(target.childElementCount).toBe(1);
    expect(runtime.getInstanceCount()).toBe(1);

    act(() => {
      target.remove();
    });
    await flushDom();

    expect(target.childElementCount).toBe(0);
    expect(runtime.getInstanceCount()).toBe(0);
  });

  it('stop очищает ручной экземпляр даже без запуска auto-mount', () => {
    const runtime = createRuntime();
    const target = document.createElement('div');
    document.body.appendChild(target);

    act(() => {
      runtime.api.mount(target);
      runtime.stop();
    });

    expect(runtime.getInstanceCount()).toBe(0);
    expect(target.childElementCount).toBe(0);
  });

  it('выдерживает пять циклов пересоздания слота без накопления экземпляров', async () => {
    const runtime = createRuntime();
    runtime.start();

    for (let index = 0; index < 5; index += 1) {
      const target = document.createElement('div');
      target.dataset.widget = 'pokemap';
      act(() => document.body.appendChild(target));
      await flushDom();
      expect(runtime.getInstanceCount()).toBe(1);

      act(() => target.remove());
      await flushDom();
      expect(runtime.getInstanceCount()).toBe(0);
      expect(target.childElementCount).toBe(0);
    }
  });

  it('выдаёт понятные ошибки для некорректной цели', () => {
    const runtime = createRuntime();

    expect(() => runtime.api.mount('#missing')).toThrow('Контейнер не найден');
    expect(() => runtime.api.mount('[')).toThrow('Некорректный CSS-селектор');
    expect(() => runtime.api.mount(null as unknown as HTMLElement)).toThrow(
      'CSS-селектор или HTMLElement',
    );
  });
});

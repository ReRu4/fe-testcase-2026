import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WidgetApp } from './app';
import { normalizeConfig } from './config';
import { WIDGET_VERSION } from './config';
import type { PokeMapApi, PokeMapConfig, PokeMapHandle } from './types';
import { WIDGET_STYLES } from './widget-styles';

const SLOT_SELECTOR = '[data-widget="pokemap"]';

interface MountedInstance {
  readonly handle: PokeMapHandle;
  readonly target: HTMLElement;
  readonly hostRoot: HTMLDivElement;
  readonly reactRoot: Root;
  wasConnected: boolean;
}

export interface WidgetRuntime {
  readonly api: PokeMapApi;
  start(): void;
  stop(): void;
  getInstanceCount(): number;
}

function isHtmlElement(value: unknown, document: Document): value is HTMLElement {
  const HtmlElement = document.defaultView?.HTMLElement;
  return HtmlElement ? value instanceof HtmlElement : false;
}

function resolveTarget(target: string | HTMLElement, document: Document): HTMLElement {
  if (typeof target !== 'string') {
    if (!isHtmlElement(target, document)) {
      throw new TypeError('[PokeMapWidget] mount ожидает CSS-селектор или HTMLElement');
    }
    return target;
  }

  let element: Element | null;
  try {
    element = document.querySelector(target);
  } catch {
    throw new Error(`[PokeMapWidget] Некорректный CSS-селектор: ${target}`);
  }

  if (!isHtmlElement(element, document)) {
    throw new Error(`[PokeMapWidget] Контейнер не найден: ${target}`);
  }
  return element;
}

function createHostRoot(document: Document, id: string): HTMLDivElement {
  const hostRoot = document.createElement('div');
  hostRoot.dataset.pokemapInstance = id;
  hostRoot.style.display = 'block';
  hostRoot.style.width = '100%';
  hostRoot.style.minWidth = '0';
  hostRoot.style.minHeight = '420px';
  hostRoot.style.position = 'relative';
  hostRoot.style.boxSizing = 'border-box';
  hostRoot.style.contain = 'layout style';
  return hostRoot;
}

export function createWidgetRuntime(document: Document): WidgetRuntime {
  const MutationObserverConstructor = document.defaultView?.MutationObserver;
  if (!MutationObserverConstructor) {
    throw new Error('[PokeMapWidget] MutationObserver недоступен в этом окружении');
  }

  const instancesByHandle = new Map<PokeMapHandle, MountedInstance>();
  const instancesByTarget = new WeakMap<HTMLElement, MountedInstance>();
  const manuallyUnmounted = new WeakSet<HTMLElement>();
  let nextInstanceId = 1;
  let observer: MutationObserver | null = null;
  let started = false;

  function disposeInstance(instance: MountedInstance, suppressAutoMount: boolean): void {
    if (!instancesByHandle.has(instance.handle)) return;

    if (suppressAutoMount) manuallyUnmounted.add(instance.target);
    instancesByHandle.delete(instance.handle);
    instancesByTarget.delete(instance.target);

    try {
      instance.reactRoot.unmount();
    } finally {
      instance.hostRoot.remove();
    }
  }

  function mountElement(target: HTMLElement, config?: PokeMapConfig): PokeMapHandle {
    const existing = instancesByTarget.get(target);
    if (existing) return existing.handle;

    const id = `pokemap-${nextInstanceId++}`;
    const handle = Object.freeze({ id, target }) satisfies PokeMapHandle;
    const hostRoot = createHostRoot(document, id);
    const shadowRoot = hostRoot.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    const reactContainer = document.createElement('div');

    style.dataset.pokemapStyles = '';
    style.textContent = WIDGET_STYLES;
    reactContainer.dataset.pokemapReactRoot = '';
    shadowRoot.append(style, reactContainer);
    target.appendChild(hostRoot);

    const reactRoot = createRoot(reactContainer);
    const instance: MountedInstance = {
      handle,
      target,
      hostRoot,
      reactRoot,
      wasConnected: target.isConnected,
    };
    instancesByHandle.set(handle, instance);
    instancesByTarget.set(target, instance);

    try {
      reactRoot.render(
        <StrictMode>
          <WidgetApp config={normalizeConfig(config)} />
        </StrictMode>,
      );
    } catch (error) {
      disposeInstance(instance, false);
      throw error;
    }

    return handle;
  }

  function mount(target: string | HTMLElement, config?: PokeMapConfig): PokeMapHandle {
    const element = resolveTarget(target, document);
    manuallyUnmounted.delete(element);
    return mountElement(element, config);
  }

  function unmount(handle: PokeMapHandle): void {
    const instance = instancesByHandle.get(handle);
    if (instance) disposeInstance(instance, true);
  }

  function scan(): void {
    for (const slot of document.querySelectorAll(SLOT_SELECTOR)) {
      if (!isHtmlElement(slot, document) || manuallyUnmounted.has(slot)) continue;
      mountElement(slot);
    }

    for (const instance of [...instancesByHandle.values()]) {
      if (instance.target.isConnected) {
        instance.wasConnected = true;
      } else if (instance.wasConnected) {
        disposeInstance(instance, false);
      }
    }
  }

  const api = Object.freeze<PokeMapApi>({
    version: WIDGET_VERSION,
    mount,
    unmount,
  });

  return {
    api,
    start() {
      if (started) return;
      started = true;
      observer = new MutationObserverConstructor(scan);
      observer.observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-widget'],
      });
      scan();
    },
    stop() {
      if (started) {
        started = false;
        observer?.disconnect();
        observer = null;
      }
      for (const instance of [...instancesByHandle.values()]) {
        disposeInstance(instance, false);
      }
    },
    getInstanceCount() {
      return instancesByHandle.size;
    },
  };
}

export function installWidgetRuntime(window: Window): WidgetRuntime {
  const runtime = createWidgetRuntime(window.document);
  window.PokeMapWidget = runtime.api;
  runtime.start();
  return runtime;
}

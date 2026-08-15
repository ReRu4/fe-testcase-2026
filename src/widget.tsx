import { installWidgetRuntime } from './widget-runtime';

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installWidgetRuntime(window);
}

export { WidgetApp } from './app';
export { WIDGET_VERSION } from './config';
export type {
  PokeMapApi,
  PokeMapConfig,
  PokeMapEvent,
  PokeMapHandle,
} from './types';

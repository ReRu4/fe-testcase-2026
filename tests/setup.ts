import { createMemoryStorage } from './memory-storage';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: createMemoryStorage(),
});
